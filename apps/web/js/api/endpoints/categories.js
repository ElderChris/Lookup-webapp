// =============================================================================
// apps/web/js/api/endpoints/categories.js
// =============================================================================
// Generi dei libri (/api/categories): tassonomia del server con macro-aree
// e sottogeneri. all() li legge una sola volta per pagina.
// =============================================================================

import { apiClient } from '../apiClient.js';

let allPromise = null;

export const categories = {
  list() {
    return apiClient.get('/api/categories');
  },

  /** Tutti i generi ({ id, name, slug, parentId, parentName, booksCount }),
      letti una volta per pagina; in caso di errore si riprova alla chiamata
      successiva. */
  all() {
    if (!allPromise) {
      allPromise = this.list()
        .then((res) => res.data)
        .catch((err) => {
          allPromise = null;
          throw err;
        });
    }
    return allPromise;
  },

  slugsToIds(categoriesList, slugs) {
    const bySlug = new Map(categoriesList.map((c) => [c.slug, c.id]));
    return slugs.map((s) => bySlug.get(s)).filter((id) => typeof id === 'number');
  },
};
