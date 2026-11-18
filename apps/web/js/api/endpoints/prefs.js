// =============================================================================
// apps/web/js/api/endpoints/prefs.js — Beta 2
// =============================================================================

import { apiClient } from '../apiClient.js';

/** Ritorna le proprie preferenze (auth required). */
export function getMe(options = {}) {
  return apiClient.get('/api/me/prefs', options);
}

/** Aggiorna una o piu' preferenze (auth required). */
export function updateMe(patch) {
  return apiClient.patch('/api/me/prefs', { body: patch });
}

/** Preferenze pubbliche di un utente (theme, motto, coverDesign, avatar). */
export function getPublic(userId, options = {}) {
  return apiClient.get(`/api/users/${encodeURIComponent(userId)}/prefs`, options);
}
