// =============================================================================
// apps/web/js/api/endpoints/books.js
// =============================================================================
// Funzioni tipate per gli endpoint /api/books/*.
// Ogni funzione corrisponde 1:1 a un endpoint REST e ritorna una Promise.
//
// Uso:
//   import { books } from '../api/index.js';
//   const { data } = await books.list({ limit: 20 });
//   const detail = await books.getById(1);
//   const created = await books.create({ title: 'X', author: 'Y', categoryIds: [1] });
// =============================================================================

import { apiClient } from '../apiClient.js';

export const books = {
  /**
   * GET /api/books — lista paginata con filtri.
   * @param {object} query - { limit, offset, q, category, ownerId, available, lat, lng, radius }
   * @returns {Promise<{data: Array, pagination: {total,limit,offset}}>}
   */
  /**
   * GET /api/books — lista paginata con filtri opzionali.
   * @param {object} query - filtri (categoryId, ownerId, available, q, sort, limit, offset)
   * @param {object} [options] - {cache: {ttlMs, key?}} per cache trasparente
   */
  list(query = {}, options = {}) {
    return apiClient.get('/api/books', { query, ...options });
  },

  /**
   * Tutti i libri che soddisfano la query, letti a pagine di 100 (il massimo
   * accettato dal server). Ritorna { data, pagination: { total }, place? }:
   * place e' il comune riconosciuto nel testo cercato (o null).
   * maxItems limita il numero di richieste in caso di cataloghi enormi.
   */
  async listAll(query = {}, { maxItems = 2000, ...options } = {}) {
    const PAGE = 100;
    const data = [];
    let total = Infinity;
    let place;
    for (let offset = 0; offset < total && data.length < maxItems; offset += PAGE) {
      // Con la cache, una chiave per pagina
      const cache = options.cache?.key
        ? { ...options.cache, key: `${options.cache.key}:offset=${offset}` }
        : options.cache;
      const res = await apiClient.get('/api/books', {
        query: { ...query, limit: PAGE, offset },
        ...options,
        cache,
      });
      data.push(...res.data);
      if (place === undefined) place = res.place;
      total = res.pagination?.total ?? data.length;
      if (res.data.length < PAGE) break;
    }
    return {
      data,
      pagination: { total: Number.isFinite(total) ? total : data.length },
      // Luogo riconosciuto nel testo cercato (comune), se c'e'
      ...(place !== undefined && { place }),
    };
  },

  /**
   * GET /api/books/:id — dettaglio di un libro.
   * @param {number} id
   * @param {object} [options] - {cache: {ttlMs, key?}} per cache trasparente
   */
  getById(id, options = {}) {
    return apiClient.get(`/api/books/${encodeURIComponent(id)}`, options);
  },

  /**
   * GET /api/books/nearby — libri vicino a coordinata, ordinati per distanza.
   * Usa PostGIS ST_DWithin lato server (molto piu' preciso di un bounding box).
   * @param {{lat:number, lng:number, radius:number, limit?:number, offset?:number}} params
   */
  nearby(params) {
    return apiClient.get('/api/books/nearby', { query: params });
  },

  /**
   * GET /api/books/:id/timeline — visualizzazioni, "mi piace" e richieste
   * di prestito per giorno (ultimi `days` giorni, predefinito 30).
   */
  timeline(id, days = 30) {
    return apiClient.get(`/api/books/${encodeURIComponent(id)}/timeline`, { query: { days } });
  },

  /**
   * POST /api/books — crea un nuovo libro (richiede auth).
   * @param {object} body - { title, author, year?, publisher?, pages?, description?, coverUrl?, categoryIds, tags? }
   */
  create(body) {
    return apiClient.post('/api/books', { body });
  },

  /**
   * PATCH /api/books/:id — modifica un libro (solo owner).
   */
  update(id, body) {
    return apiClient.patch(`/api/books/${encodeURIComponent(id)}`, { body });
  },

  /**
   * DELETE /api/books/:id — elimina un libro (solo owner).
   */
  remove(id) {
    return apiClient.delete(`/api/books/${encodeURIComponent(id)}`);
  },

  /**
   * POST /api/books/:id/views — incrementa il counter delle visualizzazioni.
   * Idempotente per lo stesso utente entro una finestra di tempo (debounce server-side).
   */
  trackView(id) {
    return apiClient.post(`/api/books/${encodeURIComponent(id)}/views`);
  },

  /**
   * POST /api/books/:id/like — aggiunge un like (richiede auth). Idempotente.
   */
  like(id) {
    return apiClient.post(`/api/books/${encodeURIComponent(id)}/like`);
  },

  /**
   * DELETE /api/books/:id/like — rimuove il like (richiede auth).
   */
  unlike(id) {
    return apiClient.delete(`/api/books/${encodeURIComponent(id)}/like`);
  },
};
