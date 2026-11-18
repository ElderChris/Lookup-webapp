// =============================================================================
// apps/web/js/api/queryClient.js
// =============================================================================
// Implementazione in-house di un query client con API compatibile con
// TanStack Query (@tanstack/query-core v5). Il nome dei metodi e la
// firma degli argomenti seguono la libreria ufficiale per permettere
// un swap 1:1 quando in Fase 3+ introdurremo un bundler.
//
// Feature coperte (subset di TanStack Query):
//   - QueryClient con fetchQuery / getQueryData / setQueryData /
//     invalidateQueries / refetchQueries
//   - mutation con optimistic update + rollback su errore
//   - dedup: chiamate concorrenti a stessa queryKey → 1 fetch
//   - refetchOnWindowFocus: refetch automatico al ritorno del tab
//   - retry: exponential backoff per errori infrastrutturali
//   - subscribe: event bus per componenti reattivi
//
// Feature TanStack Query NON coperte (yet):
//   - React hooks (useQuery, useMutation) — noi vanilla JS
//   - QueryDevtools panel — usiamo api-test.html
//   - Suspense mode, ssr, hydration — non necessari
//   - Infinite queries — nessun use case attuale
//
// Migrazione futura a TanStack vera:
//   - Ci serve un bundler (Vite/esbuild) in Fase 3+
//   - Sostituire questo file con `import { QueryClient } from '@tanstack/query-core'`
//   - L'API surface e' identica → nessun cambio nel codice utente
// =============================================================================

import { ApiError } from './apiClient.js';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Serializza una queryKey (array) in stringa deterministica. */
function hashKey(queryKey) {
  if (typeof queryKey === 'string') return queryKey;
  if (!Array.isArray(queryKey)) throw new Error('queryKey must be array or string');
  return JSON.stringify(queryKey, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      // Ordina le chiavi per determinismo
      return Object.keys(val)
        .sort()
        .reduce((acc, k) => {
          acc[k] = val[k];
          return acc;
        }, {});
    }
    return val;
  });
}

/** Verifica se una queryKey matcha un prefisso (per invalidazione by prefix). */
function matchKey(queryKeyHash, prefix) {
  if (typeof prefix === 'string') return queryKeyHash.startsWith(prefix);
  if (Array.isArray(prefix)) {
    const prefixHash = hashKey(prefix);
    // Match esatto o prefisso di array: "[a,b,c]" comincia con "[a,b"
    return queryKeyHash === prefixHash || queryKeyHash.startsWith(prefixHash.slice(0, -1) + ',');
  }
  return false;
}

/** Sleep utility */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Determina se un errore vale la pena ritentare (infrastrutturale, non business). */
function isRetryableError(err) {
  if (!(err instanceof ApiError)) return true; // errori non-ApiError → probabilmente network
  const retryable = ['NETWORK_ERROR', 'TIMEOUT', 'HTTP_500', 'HTTP_502', 'HTTP_503', 'HTTP_504'];
  return retryable.includes(err.code);
}

// -----------------------------------------------------------------------------
// QueryClient
// -----------------------------------------------------------------------------

export class QueryClient {
  constructor(options = {}) {
    this.defaults = {
      staleTime: options.staleTime ?? 0, // 0 = sempre stale (refetch dopo mount)
      cacheTime: options.cacheTime ?? 5 * 60_000, // 5 min → garbage collect
      retry: options.retry ?? 2, // 2 retry per default
      retryDelay: options.retryDelay ?? ((n) => Math.min(1000 * 2 ** n, 8000)),
      refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
    };
    // Map<hashedKey, { data, error, state, fetchedAt, staleTime, promise? }>
    this._queries = new Map();
    // Map<hashedKey, Set<(state) => void>>
    this._subscribers = new Map();
    // Setup window focus refetch listener
    if (this.defaults.refetchOnWindowFocus && typeof window !== 'undefined') {
      window.addEventListener('focus', () => this._onWindowFocus());
      // visibilitychange e' piu' affidabile di 'focus' su mobile
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this._onWindowFocus();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Core query API
  // ---------------------------------------------------------------------------

  /**
   * Fetch e cache di una query. Dedup: se la stessa key e' in-flight, ritorna
   * la stessa Promise. Se cached e non stale, ritorna il valore. Altrimenti
   * chiama queryFn con retry.
   *
   * @param {object} config
   * @param {any[] | string} config.queryKey - identificatore univoco
   * @param {() => Promise<T>} config.queryFn - fetcher
   * @param {number} [config.staleTime] - ms dopo cui il dato e' considerato stale
   * @param {number} [config.retry] - override retry
   * @returns {Promise<T>}
   */
  async fetchQuery(config) {
    const hash = hashKey(config.queryKey);
    const entry = this._queries.get(hash);
    const staleTime = config.staleTime ?? this.defaults.staleTime;
    const retry = config.retry ?? this.defaults.retry;

    // Cache hit fresh
    if (entry && entry.state === 'success' && entry.data !== undefined) {
      const age = Date.now() - entry.fetchedAt;
      if (age < staleTime) return entry.data;
    }

    // Dedup: chiamata in-flight con stessa key
    if (entry && entry.promise) return entry.promise;

    // Nuova fetch (con retry)
    const promise = this._fetchWithRetry(config.queryFn, retry).then(
      (data) => {
        this._setQueryState(hash, config.queryKey, {
          data,
          state: 'success',
          error: null,
          fetchedAt: Date.now(),
          staleTime,
        });
        return data;
      },
      (err) => {
        this._setQueryState(hash, config.queryKey, {
          error: err,
          state: 'error',
          fetchedAt: Date.now(),
          staleTime,
        });
        throw err;
      }
    );
    // Storia la promise per dedup
    this._setQueryState(hash, config.queryKey, {
      ...(entry || {}),
      state: 'loading',
      promise,
      queryFn: config.queryFn, // salviamo il queryFn per refetch on focus
      staleTime,
    });
    return promise;
  }

  async _fetchWithRetry(queryFn, maxRetries) {
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await queryFn();
      } catch (err) {
        lastErr = err;
        if (attempt === maxRetries || !isRetryableError(err)) throw err;
        const delay = this.defaults.retryDelay(attempt);
        console.debug(
          `[queryClient] retry ${attempt + 1}/${maxRetries} in ${delay}ms:`,
          err.code || err.message
        );
        await sleep(delay);
      }
    }
    throw lastErr;
  }

  /** Restituisce il dato cached (sync), o undefined se non presente. */
  getQueryData(queryKey) {
    const hash = hashKey(queryKey);
    const entry = this._queries.get(hash);
    return entry?.data;
  }

  /**
   * Aggiorna il dato cached direttamente (utile per optimistic updates).
   * Accetta valore o funzione updater: (oldValue) => newValue.
   */
  setQueryData(queryKey, updater) {
    const hash = hashKey(queryKey);
    const entry = this._queries.get(hash) || {};
    const oldValue = entry.data;
    const newValue = typeof updater === 'function' ? updater(oldValue) : updater;
    this._setQueryState(hash, queryKey, {
      ...entry,
      data: newValue,
      state: 'success',
      error: null,
      fetchedAt: Date.now(),
    });
    return newValue;
  }

  /**
   * Marca tutte le query che matchano il prefisso come stale + refetch.
   * @param {object} options
   * @param {any[]} options.queryKey - prefisso da matchare
   * @param {boolean} [options.refetch=true] - se refetch immediato (default true)
   */
  async invalidateQueries({ queryKey, refetch = true } = {}) {
    let count = 0;
    const toRefetch = [];
    for (const [hash, entry] of this._queries.entries()) {
      if (matchKey(hash, queryKey)) {
        // Marca come stale forzando fetchedAt a 0
        this._setQueryState(hash, entry.queryKey, { ...entry, fetchedAt: 0 });
        count++;
        if (refetch && entry.queryFn)
          toRefetch.push({
            queryKey: entry.queryKey,
            queryFn: entry.queryFn,
            staleTime: entry.staleTime,
          });
      }
    }
    // Refetch in parallelo (fire-and-forget dal punto di vista del chiamante)
    if (refetch && toRefetch.length > 0) {
      Promise.all(
        toRefetch.map((cfg) =>
          this.fetchQuery(cfg).catch((e) => {
            console.debug('[queryClient] refetch failed:', e.code || e.message);
          })
        )
      );
    }
    return count;
  }

  /**
   * Rimuove completamente le query dalla cache (garbage collect manuale).
   */
  removeQueries({ queryKey } = {}) {
    let count = 0;
    for (const hash of [...this._queries.keys()]) {
      if (matchKey(hash, queryKey)) {
        this._queries.delete(hash);
        this._subscribers.delete(hash);
        count++;
      }
    }
    return count;
  }

  /** Clear all */
  clear() {
    this._queries.clear();
    this._subscribers.clear();
  }

  // ---------------------------------------------------------------------------
  // Mutation API con optimistic updates
  // ---------------------------------------------------------------------------

  /**
   * Esegue una mutation con supporto optimistic:
   *   1. Chiama `onMutate(vars)` — puo' ritornare un context object (rollback data)
   *   2. Chiama `mutationFn(vars)`
   *   3. Se successo: chiama `onSuccess(data, vars, context)`
   *   4. Se errore: chiama `onError(err, vars, context)` per rollback
   *   5. Sempre: chiama `onSettled(data|null, err|null, vars, context)`
   *
   * @param {object} config
   * @param {(vars) => Promise<T>} config.mutationFn
   * @param {any} [config.variables]
   * @param {(vars) => any | Promise<any>} [config.onMutate] - per optimistic (setta context)
   * @param {(data, vars, ctx) => void} [config.onSuccess]
   * @param {(err, vars, ctx) => void} [config.onError]
   * @param {(data, err, vars, ctx) => void} [config.onSettled]
   * @returns {Promise<T>}
   */
  async mutate({ mutationFn, variables, onMutate, onSuccess, onError, onSettled }) {
    let context;
    try {
      if (onMutate) context = await onMutate(variables);
      const data = await mutationFn(variables);
      if (onSuccess) await onSuccess(data, variables, context);
      if (onSettled) await onSettled(data, null, variables, context);
      return data;
    } catch (err) {
      if (onError) await onError(err, variables, context);
      if (onSettled) await onSettled(null, err, variables, context);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Subscribe: componenti si iscrivono a stato di una queryKey
  // ---------------------------------------------------------------------------

  /**
   * Registra un callback che viene chiamato ad ogni cambio stato della query.
   * Ritorna funzione di unsubscribe.
   *
   * @param {any[]|string} queryKey
   * @param {(state: {data, error, state}) => void} listener
   * @returns {() => void}
   */
  subscribe(queryKey, listener) {
    const hash = hashKey(queryKey);
    if (!this._subscribers.has(hash)) this._subscribers.set(hash, new Set());
    this._subscribers.get(hash).add(listener);
    // Emit current state immediatamente
    const entry = this._queries.get(hash);
    if (entry) listener({ data: entry.data, error: entry.error, state: entry.state });
    return () => {
      const set = this._subscribers.get(hash);
      if (set) set.delete(listener);
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  _setQueryState(hash, queryKey, patch) {
    const prev = this._queries.get(hash) || {};
    const next = { ...prev, ...patch, queryKey };
    // Rimuovi promise se completato (success/error)
    if (patch.state && patch.state !== 'loading') delete next.promise;
    this._queries.set(hash, next);
    // Notifica subscribers
    const set = this._subscribers.get(hash);
    if (set && set.size > 0) {
      const state = { data: next.data, error: next.error, state: next.state };
      for (const fn of set) {
        try {
          fn(state);
        } catch (_) {
          /* swallow */
        }
      }
    }
  }

  _onWindowFocus() {
    // Refetch tutte le query staled quando il tab riguadagna focus
    let count = 0;
    for (const [hash, entry] of this._queries.entries()) {
      if (!entry.queryFn || !entry.staleTime) continue;
      const age = Date.now() - (entry.fetchedAt || 0);
      if (age >= entry.staleTime) {
        this.fetchQuery({
          queryKey: entry.queryKey,
          queryFn: entry.queryFn,
          staleTime: entry.staleTime,
        }).catch((e) => console.debug('[queryClient] focus refetch failed:', e.code || e.message));
        count++;
      }
    }
    if (count > 0) console.debug(`[queryClient] window focus → refetched ${count} stale queries`);
  }

  // ---------------------------------------------------------------------------
  // Debug utilities
  // ---------------------------------------------------------------------------

  /** Numero di queries attualmente cached */
  size() {
    return this._queries.size;
  }

  /** Snapshot dello stato per debug */
  snapshot() {
    const out = {};
    for (const [hash, entry] of this._queries.entries()) {
      out[hash] = {
        state: entry.state,
        hasData: entry.data !== undefined,
        error: entry.error?.code || entry.error?.message,
        ageMs: entry.fetchedAt ? Date.now() - entry.fetchedAt : null,
        staleTimeMs: entry.staleTime,
      };
    }
    return out;
  }
}

// -----------------------------------------------------------------------------
// Singleton default instance (analog to TanStack Query default client)
// -----------------------------------------------------------------------------

export const queryClient = new QueryClient({
  staleTime: 30 * 1000, // 30s default per la maggior parte delle query
  cacheTime: 5 * 60 * 1000,
  retry: 2,
  refetchOnWindowFocus: true,
});
