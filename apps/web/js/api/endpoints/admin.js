// =============================================================================
// apps/web/js/api/endpoints/admin.js
// =============================================================================
// Wrapper delle route /api/admin/*. Richiedono session con role='admin'.
// =============================================================================

import { apiClient } from '../apiClient.js';

/** Lista utenti con filtri (admin only). */
export function listUsers(query = {}, options = {}) {
  return apiClient.get('/api/admin/users', { query, ...options });
}

/** Aggiorna utente cross-user (admin only). */
export function updateUser(userId, patch) {
  return apiClient.patch(`/api/admin/users/${encodeURIComponent(userId)}`, { body: patch });
}

/** Elimina definitivamente un utente e i suoi dati (admin only). */
export function deleteUser(userId) {
  return apiClient.delete(`/api/admin/users/${encodeURIComponent(userId)}`);
}

/** Lista posts con report attivi (moderation queue). */
export function listReports(query = {}, options = {}) {
  return apiClient.get('/api/admin/reports', { query, ...options });
}

/** Dismiss tutti i report di un post (admin only). */
export function clearPostReports(postId) {
  return apiClient.post(`/api/admin/posts/${encodeURIComponent(postId)}/clear-reports`);
}

/** Elimina post override author (admin only). */
export function deletePost(postId) {
  return apiClient.delete(`/api/admin/posts/${encodeURIComponent(postId)}`);
}

/** Tutti i volumi, qualunque stato (admin only). */
export function listBooks(query = {}, options = {}) {
  return apiClient.get('/api/admin/books', { query, ...options });
}

/** Modifica un libro come admin (owner override). */
export function updateBookAs(bookId, patch) {
  return apiClient.patch(`/api/admin/books/${bookId}`, { body: patch });
}

/** Elimina un libro come admin (owner override). */
export function deleteBookAs(bookId) {
  return apiClient.delete(`/api/admin/books/${bookId}`);
}

/**
 * Consulta il log azioni admin.
 * @param {{adminId?: string, action?: string, targetType?: string, targetId?: string, limit?: number, offset?: number}} query
 */
export function auditLog(query = {}, options = {}) {
  return apiClient.get('/api/admin/audit-log', { query, ...options });
}

/**
 * Beta 7: stato delle queue background jobs.
 * Ritorna counts (waiting/active/completed/failed) + next runs per ogni queue.
 */
export function jobsStatus(options = {}) {
  return apiClient.get('/api/admin/jobs', options);
}

/**
 * Beta 7: trigger manuale di un job.
 * @param {'overdue-loans' | 'retention' | 'upcoming-deadline'} queueName
 *   'upcoming-deadline' e' stato aggiunto in Beta 7.1
 */
export function runJob(queueName) {
  return apiClient.post(`/api/admin/jobs/${queueName}/run`);
}
