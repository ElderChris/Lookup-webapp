// =============================================================================
// apps/web/js/api/apiClient.js
// =============================================================================
// Wrapper sopra fetch() per chiamare il backend Lookup (apps/api).
//
// Responsabilita':
//   - Costruzione URL (base + path + query string)
//   - Invio del cookie di sessione (credentials: 'include')
//   - Serializzazione body JSON
//   - Parsing response + gestione errori uniforme
//   - Mapping degli error code stabili del backend a eccezioni leggibili
//
// L'apiClient e' generico: non sa nulla degli endpoint specifici. Per
// chiamate tipate vedi `endpoints/*.js`.
//
// Uso base:
//   import { apiClient } from './apiClient.js';
//   const books = await apiClient.get('/api/books', { query: { limit: 10 } });
//   const created = await apiClient.post('/api/books', { body: { title, author, ... } });
// =============================================================================

/**
 * Configurazione del client. Modificabile a runtime via apiClient.configure({...}).
 */
const config = {
  // Base URL del backend.
  //   - Normalmente vuota: richieste relative `/api/...`, che nginx inoltra al
  //     container dell'API (stessa origine, nessun CORS).
  //   - Solo con un server statico di sviluppo senza proxy (python
  //     no-cache-server su :8765, Live Server su :5500) si chiama
  //     direttamente l'API su http://localhost:3000 (cross-origin, CORS).
  baseUrl: (() => {
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocalhost && ['8765', '5500'].includes(window.location.port)) {
      return 'http://localhost:3000';
    }
    return '';
  })(),

  // Timeout di default per le richieste (ms)
  timeoutMs: 15000,
};

// -----------------------------------------------------------------------------
// Tipo di errore standard ritornato dal backend
// -----------------------------------------------------------------------------

/**
 * Errore lanciato da apiClient quando la response non e' OK (>= 400).
 * Espone status, code (string stabile), message, details, raw.
 */
export class ApiError extends Error {
  constructor({ status, code, message, details, raw }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.raw = raw;
  }

  /** Convenience: true se l'errore e' un 4xx (errore client/validazione) */
  isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  /** Convenience: true se l'errore e' un 5xx (errore server) */
  isServerError() {
    return this.status >= 500;
  }
}

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

function buildUrl(path, query) {
  const url = new URL(config.baseUrl + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  // Se baseUrl e' assoluto (cross-origin), URL.toString() ritorna l'URL completo.
  // Se baseUrl e' vuoto (stesso origin), ritorna /api/... relativo.
  return config.baseUrl ? url.toString() : url.pathname + url.search;
}

function buildHeaders(extra) {
  return { 'Content-Type': 'application/json', ...extra };
}

async function parseError(res, raw) {
  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    /* body vuoto o non JSON */
  }
  const err = body?.error || {};
  return new ApiError({
    status: res.status,
    code: err.code || `HTTP_${res.status}`,
    message: err.message || res.statusText || `Errore HTTP ${res.status}`,
    details: err.details,
    raw: body,
  });
}

async function doFetch(method, path, options = {}) {
  const { query, body, headers: extraHeaders, signal: userSignal } = options;
  const url = buildUrl(path, query);

  // Timeout via AbortController, combinato con eventuale signal dell'utente
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  if (userSignal) {
    userSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: buildHeaders(extraHeaders),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: 'include', // per future sessioni cookie (Fase 3)
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError({
        status: 0,
        code: 'TIMEOUT',
        message: `Timeout dopo ${config.timeoutMs}ms su ${method} ${path}`,
      });
    }
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: `Errore di rete: ${err.message}`,
      raw: err,
    });
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw await parseError(res);
  }

  // 204 No Content
  if (res.status === 204) return null;

  // Tentativo parse JSON. Se fallisce (es. risposta vuota), ritorna null.
  try {
    return await res.json();
  } catch (_) {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Export pubblico
// -----------------------------------------------------------------------------

export const apiClient = {
  /** Setta o aggiorna la configurazione (es. dopo login). */
  configure(opts) {
    Object.assign(config, opts);
  },

  /** Getter readonly della config corrente (utile per debug). */
  getConfig() {
    return { ...config };
  },

  /**
   * GET con supporto cache opzionale.
   *
   * Esempi:
   *   apiClient.get('/api/categories');
   *   apiClient.get('/api/categories', { cache: { ttlMs: 3600_000 } });
   *   apiClient.get('/api/users/42', { cache: { ttlMs: 300_000, key: 'user:42' } });
   *
   * Se `options.cache` e' presente:
   *   - key = options.cache.key || autogenerata da method+path+query
   *   - hit: ritorna valore cached (Promise.resolve)
   *   - miss: chiama il backend, salva in cache con ttlMs, ritorna
   *
   * Errori non vengono mai cachati.
   */
  get(path, options = {}) {
    if (!options.cache) {
      return doFetch('GET', path, options);
    }
    // Import dinamico per evitare ciclo: apiClient ← cache ← (nothing).
    // In realta' non c'e' ciclo, ma manteniamo l'import lazy per ridurre
    // overhead se la cache non viene mai usata.
    return import('./cache.js').then(({ cache }) => {
      const key = options.cache.key || _autoCacheKey('GET', path, options.query);
      const ttlMs = options.cache.ttlMs;
      return cache.wrap(key, ttlMs, () => doFetch('GET', path, options));
    });
  },

  post(path, options) {
    return doFetch('POST', path, options);
  },
  patch(path, options) {
    return doFetch('PATCH', path, options);
  },
  put(path, options) {
    return doFetch('PUT', path, options);
  },
  delete(path, options) {
    return doFetch('DELETE', path, options);
  },
};

// Helper privato per generare cache key automatica
function _autoCacheKey(method, path, query) {
  const qp = query ? new URLSearchParams(query).toString() : '';
  return `${method} ${path}${qp ? '?' + qp : ''}`;
}
