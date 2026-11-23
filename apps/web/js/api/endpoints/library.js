// =============================================================================
// apps/web/js/api/endpoints/library.js
// =============================================================================

import { apiClient } from '../apiClient.js';

/**
 * Aggregato profilo pubblico: user + orgProfile + prefs + stats.
 * Usato da profile.html per popolare l'intera pagina in un'unica request.
 */
export function getByUser(userId, options = {}) {
  return apiClient.get(`/api/users/${encodeURIComponent(userId)}/library`, options);
}

/**
 * GET /api/libraries — librerie ordinate per vicinanza (posizione pubblica)
 * e attivita'. Senza lat/lng: solo per attivita'.
 * @param {{lat?: number, lng?: number, limit?: number}} query
 */
export function nearby(query = {}, options = {}) {
  return apiClient.get('/api/libraries', { query, ...options });
}

/**
 * Scarica il dump JSON dei propri dati (GDPR data portability).
 * Ritorna l'oggetto JSON parsed; il chiamante puo' passarlo a un Blob per
 * il download come file.
 */
export function exportMe(options = {}) {
  return apiClient.get('/api/me/export', options);
}
