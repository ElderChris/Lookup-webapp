// =============================================================================
// apps/web/js/api/cache.js
// =============================================================================
// Cache in-memory con TTL e invalidation per il layer API.
//
// Use case:
//   - Categorie BISAC (TTL lungo, ~1h): fetched al boot, usate da add-book
//   - Profili utente (TTL medio, ~5min): condivisi tra pagine
//   - Liste libri per utente (TTL breve, ~30s): invalidate dopo create/edit
//   - Dettagli libro (TTL breve, ~30s): freshness per like counts
//
// Disegno:
//   - Storage in-memory (Map) — nessun localStorage, la cache muore col tab
//   - Chiavi namespaced: "categories:list", "user:42", "books:list:owner=1"
//   - TTL per chiave, scadenza lazy (alla get)
//   - Invalidation per chiave esatta o per pattern prefix
//   - Event bus minimale per UI reattiva (futuro): emette 'set' e 'invalidate'
// =============================================================================

const _store = new Map(); // key → { value, expiresAt }
const _listeners = new Set();

function now() {
  return Date.now();
}

function emit(event, key) {
  for (const fn of _listeners) {
    try {
      fn(event, key);
    } catch (_) {
      /* swallow listener errors */
    }
  }
}

export const cache = {
  /**
   * Restituisce il valore se presente e non scaduto, altrimenti undefined.
   * @param {string} key
   * @returns {any | undefined}
   */
  get(key) {
    const entry = _store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt < now()) {
      _store.delete(key);
      emit('expire', key);
      return undefined;
    }
    return entry.value;
  },

  /**
   * Salva un valore con scadenza opzionale.
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlMs] - TTL in ms; se omesso, mai scade (fino a invalidate manuale)
   */
  set(key, value, ttlMs) {
    const expiresAt = typeof ttlMs === 'number' && ttlMs > 0 ? now() + ttlMs : null;
    _store.set(key, { value, expiresAt });
    emit('set', key);
    return value;
  },

  /**
   * Verifica presenza (e non-scadenza) senza ritornare il valore.
   */
  has(key) {
    return this.get(key) !== undefined;
  },

  /**
   * Invalidate per chiave esatta o per pattern prefix (passare "namespace:").
   * @param {string} keyOrPrefix
   * @returns {number} numero di chiavi cancellate
   */
  invalidate(keyOrPrefix) {
    if (_store.has(keyOrPrefix)) {
      _store.delete(keyOrPrefix);
      emit('invalidate', keyOrPrefix);
      return 1;
    }
    // Pattern: tratta come prefix se finisce con ":"
    if (keyOrPrefix.endsWith(':') || keyOrPrefix.endsWith('*')) {
      const prefix = keyOrPrefix.replace(/\*$/, '');
      let count = 0;
      for (const k of [..._store.keys()]) {
        if (k.startsWith(prefix)) {
          _store.delete(k);
          emit('invalidate', k);
          count++;
        }
      }
      return count;
    }
    return 0;
  },

  /**
   * Cancella tutto. Usato in test o al logout.
   */
  clear() {
    const n = _store.size;
    _store.clear();
    emit('clear', null);
    return n;
  },

  /**
   * Numero di chiavi attualmente in cache (incluse scadute non ancora rimosse).
   */
  size() {
    return _store.size;
  },

  /**
   * Lista delle chiavi attualmente in cache. Utile per debug.
   */
  keys() {
    return [..._store.keys()];
  },

  /**
   * Registra un listener per eventi 'set' | 'invalidate' | 'expire' | 'clear'.
   * Ritorna funzione di unsubscribe.
   */
  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  /**
   * Helper: wrap di una funzione async con cache. Se il valore e' in cache,
   * ritorna quello; altrimenti chiama `fn()`, salva il risultato, lo ritorna.
   *
   * Uso:
   *   const cats = await cache.wrap('categories:list', 3600_000,
   *     () => categories.list().then(r => r.data));
   *
   * @param {string} key
   * @param {number} ttlMs
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async wrap(key, ttlMs, fn) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await fn();
    this.set(key, value, ttlMs);
    return value;
  },
};

// TTL costanti suggerite per i diversi domini (in ms)
export const CACHE_TTL = Object.freeze({
  CATEGORIES: 60 * 60 * 1000, // 1 ora — cambiano raramente
  USER_PROFILE: 5 * 60 * 1000, // 5 min — bilancia freshness e roundtrip
  BOOKS_LIST: 30 * 1000, // 30 sec — vogliamo riflettere create/edit veloci
  BOOK_DETAIL: 30 * 1000, // 30 sec — counter views/likes freschi
  STATS: 5 * 60 * 1000, // 5 min — featured/ridgeline non urgenti
  LOANS: 15 * 1000, // 15 sec — la state machine cambia spesso
});
