// =============================================================================
// apps/web/js/api/endpoints/posts.js
// =============================================================================
// Funzioni tipate per gli endpoint /api/posts/* + reactions + reports.
// =============================================================================

import { apiClient } from '../apiClient.js';

/** Motivi di segnalazione ammessi dal server (harassment: solo storico). */
export const REPORT_REASON = Object.freeze({
  OFFENSIVE: 'offensive',
  SPAM: 'spam',
  OFF_TOPIC: 'off-topic',
  VIOLENCE: 'violence',
  OTHER: 'other',
});

export const posts = {
  // ---------------------------------------------------------------------------
  // Lista / feed
  // ---------------------------------------------------------------------------

  /**
   * GET /api/posts — lista pubblica (discovery, no auth).
   * @param {{authorId?: number, limit?: number, offset?: number}} query
   */
  list(query = {}, options = {}) {
    return apiClient.get('/api/posts', { query, ...options });
  },

  /**
   * GET /api/posts/feed — feed personalizzato (richiede auth).
   * Include propri post + post degli utenti seguiti.
   */
  feed(query = {}, options = {}) {
    return apiClient.get('/api/posts/feed', { query, ...options });
  },

  /**
   * GET /api/posts/:id — dettaglio post con aggregato reactions.
   * Se auth, include myReactions[].
   */
  getById(postId) {
    return apiClient.get(`/api/posts/${encodeURIComponent(postId)}`);
  },

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /**
   * POST /api/posts — crea un post (richiede auth, max 500 char).
   * @param {{content: string}} body
   */
  create(body) {
    return apiClient.post('/api/posts', { body });
  },

  /**
   * DELETE /api/posts/:id — soft-delete (solo author, status diventa 'removed').
   */
  remove(postId) {
    return apiClient.delete(`/api/posts/${encodeURIComponent(postId)}`);
  },

  // ---------------------------------------------------------------------------
  // Reactions
  // ---------------------------------------------------------------------------

  /**
   * POST /api/posts/:id/reactions — reazione (una per utente: sostituisce
   * la precedente).
   * @param {string} postId
   * @param {string} emoji - una fra 👍 ❤️ 👏 🤔
   */
  react(postId, emoji) {
    return apiClient.post(`/api/posts/${encodeURIComponent(postId)}/reactions`, {
      body: { emoji },
    });
  },

  /**
   * DELETE /api/posts/:id/reactions/:emoji — rimuove la propria reaction.
   */
  unreact(postId, emoji) {
    return apiClient.delete(
      `/api/posts/${encodeURIComponent(postId)}/reactions/${encodeURIComponent(emoji)}`
    );
  },

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------

  /**
   * POST /api/posts/:id/report — segnala un post (richiede auth).
   * @param {string} postId
   * @param {{reason: string, note?: string}} body - reason in REPORT_REASON enum
   */
  report(postId, body) {
    return apiClient.post(`/api/posts/${encodeURIComponent(postId)}/report`, { body });
  },
};
