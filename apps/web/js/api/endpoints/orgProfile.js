// =============================================================================
// apps/web/js/api/endpoints/orgProfile.js — Beta 2
// =============================================================================

import { apiClient } from '../apiClient.js';

/** Profilo organizzazione di un utente (404 se non esiste). */
export function getByUser(userId, options = {}) {
  return apiClient.get(`/api/users/${encodeURIComponent(userId)}/org-profile`, options);
}

/** Mio profilo organizzazione (auth required, 404 se non esiste). */
export function getMe(options = {}) {
  return apiClient.get('/api/me/org-profile', options);
}

/** Crea o aggiorna il proprio profilo organizzazione (owner + accountType=organization). */
export function updateMe(patch) {
  return apiClient.patch('/api/me/org-profile', { body: patch });
}

/** Rimuovi il proprio profilo organizzazione. */
export function deleteMe() {
  return apiClient.delete('/api/me/org-profile');
}
