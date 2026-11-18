// =============================================================================
// apps/web/js/api/endpoints/notifications.js
// =============================================================================
// Funzioni tipate per gli endpoint /api/me/notifications/*.
// Le notifiche sono generate cross-cutting da follow/review/loan/message/reaction.
// =============================================================================

import { apiClient } from '../apiClient.js';

/** Tipi di notifica emessi dal backend (allineato con Zod NotificationType). */
export const NOTIFICATION_TYPE = Object.freeze({
  NEW_FOLLOWER: 'new_follower',
  NEW_REVIEW: 'new_review',
  POST_REACTION: 'post_reaction',
  LOAN_REQUEST: 'loan_request',
  LOAN_ACCEPTED: 'loan_accepted',
  LOAN_REJECTED: 'loan_rejected',
  LOAN_BORROWED: 'loan_borrowed',
  LOAN_RETURNING: 'loan_returning',
  LOAN_RETURNED: 'loan_returned',
  LOAN_CANCELLED: 'loan_cancelled',
  LOAN_MESSAGE: 'loan_message',
});

export const notifications = {
  /**
   * GET /api/me/notifications — lista paginata con unreadCount aggregato.
   * @param {{unreadOnly?: boolean, limit?: number, offset?: number}} query
   */
  list(query = {}) {
    return apiClient.get('/api/me/notifications', { query });
  },

  /**
   * PATCH /api/me/notifications/:id/read — marca singola come letta.
   */
  markRead(notificationId) {
    return apiClient.patch(`/api/me/notifications/${encodeURIComponent(notificationId)}/read`);
  },

  /**
   * POST /api/me/notifications/read-all — marca tutte come lette.
   * Ritorna { markedAsRead: <count> }.
   */
  markAllRead() {
    return apiClient.post('/api/me/notifications/read-all');
  },

  /**
   * DELETE /api/me/notifications/:id — cancella una notifica (owner only).
   */
  remove(notificationId) {
    return apiClient.delete(`/api/me/notifications/${encodeURIComponent(notificationId)}`);
  },
};
