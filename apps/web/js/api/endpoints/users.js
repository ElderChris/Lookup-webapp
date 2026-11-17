// =============================================================================
// apps/web/js/api/endpoints/users.js
// =============================================================================
// Funzioni tipate per gli endpoint /api/users/* + /api/me + reviews + follows.
// =============================================================================

import { apiClient } from '../apiClient.js';

export const users = {
  // ---------------------------------------------------------------------------
  // Profili
  // ---------------------------------------------------------------------------

  /**
   * GET /api/users/me — profilo privato (richiede auth).
   * Include email + preferences. Per il pubblico usare getById.
   */
  getMe() {
    return apiClient.get('/api/users/me');
  },

  /**
   * GET /api/users/:id — profilo pubblico (no auth richiesto).
   * Include counts (books, followers, following, reviewsReceived, avgRating).
   * Se chiamato con auth, include anche isFollowing.
   */
  getById(id, options = {}) {
    return apiClient.get(`/api/users/${encodeURIComponent(id)}`);
  },

  /**
   * PATCH /api/users/me — aggiorna il proprio profilo.
   * @param {object} body - { displayName?, bio?, city?, lat?, lng?, avatarUrl?,
   *                          preferences?, organization? }
   */
  updateMe(body) {
    return apiClient.patch('/api/users/me', { body });
  },

  // ---------------------------------------------------------------------------
  // Reviews
  // ---------------------------------------------------------------------------

  /**
   * GET /api/users/:id/reviews — recensioni (paginato).
   * @param {string} targetUserId
   * @param {{role?: 'received'|'written', limit?: number, offset?: number}} query
   */
  listReviews(targetUserId, query = {}) {
    return apiClient.get(`/api/users/${encodeURIComponent(targetUserId)}/reviews`, { query });
  },

  /**
   * Shortcut: recensioni SCRITTE da questo utente (verso altri).
   * Equivalente a `listReviews(userId, { role: 'written' })`.
   */
  listReviewsWritten(userId, query = {}) {
    return apiClient.get(`/api/users/${encodeURIComponent(userId)}/reviews`, {
      query: { ...query, role: 'written' },
    });
  },

  /**
   * POST /api/users/:id/reviews — crea o aggiorna la propria review (upsert).
   * @param {string} targetUserId
   * @param {{rating: number, text?: string}} body
   */
  createReview(targetUserId, body) {
    return apiClient.post(`/api/users/${encodeURIComponent(targetUserId)}/reviews`, { body });
  },

  /**
   * DELETE /api/users/:id/reviews/me — cancella la propria review.
   */
  deleteMyReview(targetUserId) {
    return apiClient.delete(`/api/users/${encodeURIComponent(targetUserId)}/reviews/me`);
  },

  // ---------------------------------------------------------------------------
  // Follow
  // ---------------------------------------------------------------------------

  /**
   * POST /api/users/:id/follow — inizia a seguire (idempotente).
   * Ritorna 204 No Content (nessun body).
   */
  follow(targetUserId) {
    return apiClient.post(`/api/users/${encodeURIComponent(targetUserId)}/follow`);
  },

  /**
   * DELETE /api/users/:id/follow — smette di seguire (idempotente).
   */
  unfollow(targetUserId) {
    return apiClient.delete(`/api/users/${encodeURIComponent(targetUserId)}/follow`);
  },

  /**
   * GET /api/users/:id/followers — lista followers (paginato).
   */
  listFollowers(targetUserId, query = {}) {
    return apiClient.get(`/api/users/${encodeURIComponent(targetUserId)}/followers`, { query });
  },

  /**
   * GET /api/users/:id/following — lista chi segue questo utente (paginato).
   */
  listFollowing(targetUserId, query = {}) {
    return apiClient.get(`/api/users/${encodeURIComponent(targetUserId)}/following`, { query });
  },
};
