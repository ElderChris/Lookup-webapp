// =============================================================================
// apps/web/js/api/endpoints/stats.js
// =============================================================================
// Funzioni tipate per gli endpoint /api/stats/*.
// Tutti gli endpoint sono pubblici (no auth richiesto).
// =============================================================================

import { apiClient } from '../apiClient.js';

export const stats = {
  /**
   * GET /api/stats/featured — top N libri "in tendenza" (default 10).
   * Calcolato come: recency_weight(loan_7d) + 0.5*like_7d + 0.2*view_total
   * Con diversity penalty: -30% per ripetizione categoria primaria.
   *
   * @param {{limit?: number, days?: number}} query
   *   limit 1-50 (default 10), days 1-90 (default 7)
   */
  featured(query = {}, options = {}) {
    return apiClient.get('/api/stats/featured', { query, ...options });
  },

  /**
   * GET /api/stats/overview — dati della pagina Statistiche in un'unica
   * risposta: kpi, activity (12 settimane), hierarchy, cooccurrence,
   * months + topBooks (andamento mensile), topUsers (classifiche).
   * @param {{limit?: number}} query
   */
  overview(query = {}, options = {}) {
    return apiClient.get('/api/stats/overview', { query, ...options });
  },

  /**
   * GET /api/stats/ridgeline — top N utenti × M settimane di attivita'.
   * Attivita' = post + loan + review per settimana.
   * Output: matrice user[]×week[] adatta a chart d3-ridgeline.
   *
   * @param {{users?: number, weeks?: number}} query
   *   users 1-50 (default 10), weeks 1-26 (default 8)
   */
  ridgeline(query = {}, options = {}) {
    return apiClient.get('/api/stats/ridgeline', { query, ...options });
  },

  /**
   * GET /api/stats/top-users — top N utenti per score composito.
   * Score = loan(peso 1.0) + review(0.8) + post(0.5) + ratingBonus(2.0)
   * Tutte le metriche normalizzate 0-1 sul max della popolazione.
   *
   * @param {{limit?: number}} query - limit 1-100 (default 20)
   */
  topUsers(query = {}, options = {}) {
    return apiClient.get('/api/stats/top-users', { query, ...options });
  },

  /**
   * GET /api/stats/bisac-cooccurrence — coppie di categorie co-occorrenti.
   * Self-join su book_categories per coppie (a < b) sullo stesso libro.
   * Output: array sparse [{a, b, count}] ordinato per count desc.
   *
   * @param {{minCount?: number, limit?: number}} query
   *   minCount >= 1 (default 2), limit 1-200 (default 50)
   */
  bisacCooccurrence(query = {}, options = {}) {
    return apiClient.get('/api/stats/bisac-cooccurrence', { query, ...options });
  },

  // ===========================================================================
  // Beta 2 — nuovi endpoint
  // ===========================================================================

  /**
   * GET /api/stats/global — Aggregato "quanti X ci sono nella piattaforma".
   * Usato per KPI in admin.html + landing.
   */
  global(options = {}) {
    return apiClient.get('/api/stats/global', options);
  },

  /**
   * GET /api/stats/activity-timeline — Serie temporale eventi giornalieri.
   * @param {{days?: number}} query - 1-90 (default 30)
   */
  activityTimeline(query = {}, options = {}) {
    return apiClient.get('/api/stats/activity-timeline', { query, ...options });
  },

  /**
   * GET /api/books/:id/timeline — Timeline attivita' su un singolo libro.
   * @param {number} bookId
   * @param {{days?: number}} query - 1-90 (default 30)
   */
  bookTimeline(bookId, query = {}, options = {}) {
    return apiClient.get(`/api/books/${bookId}/timeline`, { query, ...options });
  },
};
