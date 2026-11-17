// =============================================================================
// apps/web/js/api/endpoints/categories.js
// =============================================================================
// Funzioni tipate per /api/categories (Fase 1g.2).
// Lista flat di categorie BISAC, non paginate.
//
// In Fase 2c verranno usate per mappare slug → id quando il frontend
// crea/modifica un libro (sostituendo l'hard-coded [1] di Fase 2b.3).
// =============================================================================

import { apiClient } from '../apiClient.js';

export const categories = {
  /**
   * GET /api/categories — lista flat di tutte le categorie BISAC.
   * No paginazione (poche righe), no auth richiesto.
   * Ritorna { data: [{ id, name, slug, description }] }
   */
  list() {
    return apiClient.get('/api/categories');
  },

  /**
   * Helper: mappa slug → id usando una lista gia' fetched.
   * @param {Array} categoriesList - risultato di `categories.list().data`
   * @param {Array<string>} slugs - es. ['narrativa', 'gialli']
   * @returns {Array<number>} ids - es. [1, 5]
   */
  slugsToIds(categoriesList, slugs) {
    const bySlug = new Map(categoriesList.map((c) => [c.slug, c.id]));
    return slugs.map((s) => bySlug.get(s)).filter((id) => typeof id === 'number');
  },
};
