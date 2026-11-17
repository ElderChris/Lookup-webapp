// =============================================================================
// apps/web/js/api/fallback.js
// =============================================================================
// Helper per gestire graziosamente il caso "backend non disponibile" durante
// la migrazione progressiva delle pagine. Il prototipo deve continuare a
// funzionare con dati mock (Storage / SAMPLE_*) anche se l'API e' giu'.
//
// Uso tipico in una page:
//
//   import { withApiFallback } from '/js/api/fallback.js';
//   import { books } from '/js/api/index.js';
//
//   const items = await withApiFallback(
//     () => books.list({ limit: 20 }).then(r => r.data),
//     () => Storage.get('books', SAMPLE_BOOKS),
//     { onFallback: (err) => showBanner('Demo offline: dati locali in uso') },
//   );
// =============================================================================

import { ApiError } from './apiClient.js';

/**
 * Codici errore che triggerano il fallback (errori "infrastrutturali",
 * non errori di business).
 */
const FALLBACK_CODES = new Set([
  'NETWORK_ERROR', // fetch fallito (backend giu', CORS, DNS, offline)
  'TIMEOUT', // backend troppo lento (timeout AbortController)
  'HTTP_500', // errore server (no DB, crash interno)
  'HTTP_502', // bad gateway (nginx OK ma backend giu')
  'HTTP_503', // service unavailable
  'HTTP_504', // gateway timeout
]);

/**
 * Esegue `apiCall()`; se fallisce per problemi infrastrutturali, esegue
 * `localFallback()` invece. Errori di business (4xx) vengono rilanciati
 * cosi' come sono — il chiamante deve gestire 401/403/404/409.
 *
 * @param {() => Promise<T>} apiCall - funzione che chiama il backend
 * @param {() => T | Promise<T>} localFallback - funzione di fallback (Storage o SAMPLE_*)
 * @param {object} [opts]
 * @param {(err: ApiError) => void} [opts.onFallback] - callback eseguita quando si usa il fallback
 * @returns {Promise<T>}
 */
export async function withApiFallback(apiCall, localFallback, opts = {}) {
  try {
    return await apiCall();
  } catch (err) {
    const shouldFallback = err instanceof ApiError && FALLBACK_CODES.has(err.code);
    if (!shouldFallback) throw err;

    if (opts.onFallback) {
      try {
        opts.onFallback(err);
      } catch (_) {
        /* non far esplodere il callback */
      }
    }
    return await localFallback();
  }
}

/**
 * Variante con risultato "wrapped": ritorna { data, source: 'api' | 'fallback', error? }.
 * Utile quando l'UI vuole mostrare un badge "offline" persistente.
 */
export async function withApiFallbackWrapped(apiCall, localFallback) {
  try {
    const data = await apiCall();
    return { data, source: 'api', error: null };
  } catch (err) {
    if (err instanceof ApiError && FALLBACK_CODES.has(err.code)) {
      const data = await localFallback();
      return { data, source: 'fallback', error: err };
    }
    throw err;
  }
}
