// =============================================================================
// apps/web/js/api/endpoints/loans.js
// =============================================================================
// Funzioni tipate per gli endpoint /api/loans/* + /api/books/:id/loan-requests
// + /api/me/loans/* + messaggi interni al prestito.
//
// Include helper per la state machine: invece di passare action stringa
// (`accept`, `reject`, `mark_borrowed`, ecc.), il chiamante puo' usare
// metodi semantici (`accept(id)`, `markBorrowed(id)`, ecc.) che incapsulano
// l'action e fanno una sola PATCH.
// =============================================================================

import { apiClient } from '../apiClient.js';

/**
 * Stati validi del prestito (allineato con backend Prisma + Zod schema).
 * Utile per render condizionale dei bottoni UI.
 */
export const LOAN_STATUS = Object.freeze({
  REQUESTED: 'requested',
  CONFIRMED: 'confirmed',
  BORROWED: 'borrowed',
  RETURNING: 'returning',
  RETURNED: 'returned',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

/** Stati terminali (non producono ulteriori transizioni). */
export const LOAN_TERMINAL_STATUS = Object.freeze(['returned', 'rejected', 'cancelled']);

export const loans = {
  // ---------------------------------------------------------------------------
  // Creazione richiesta
  // ---------------------------------------------------------------------------

  /**
   * POST /api/books/:id/loan-requests — chiede in prestito un libro.
   * @param {number} bookId
   * @param {{message?: string, daysRequested?: number}} body
   *   daysRequested: Beta 7.1 — durata prestito richiesta (giorni). Default backend: 14.
   */
  request(bookId, body = {}) {
    return apiClient.post(`/api/books/${encodeURIComponent(bookId)}/loan-requests`, { body });
  },

  // ---------------------------------------------------------------------------
  // Liste personali
  // ---------------------------------------------------------------------------

  /**
   * GET /api/me/loans/sent — prestiti richiesti dall'utente loggato (paginato).
   * @param {{status?: string, limit?: number, offset?: number}} query
   */
  listSent(query = {}) {
    return apiClient.get('/api/me/loans/sent', { query });
  },

  /**
   * GET /api/me/loans/received — prestiti ricevuti come lender (paginato).
   */
  listReceived(query = {}) {
    return apiClient.get('/api/me/loans/received', { query });
  },

  // ---------------------------------------------------------------------------
  // Dettaglio
  // ---------------------------------------------------------------------------

  /**
   * GET /api/loans/:id — dettaglio del prestito (solo participants).
   */
  getById(loanId) {
    return apiClient.get(`/api/loans/${encodeURIComponent(loanId)}`);
  },

  // ---------------------------------------------------------------------------
  // State machine — PATCH con action
  // ---------------------------------------------------------------------------

  /**
   * Helper interno: PATCH /api/loans/:id con action specificata.
   * Preferire i metodi semantici sotto (accept, reject, ecc.).
   * @param {number} loanId
   * @param {string} action
   * @param {string} [reason] - opzionale, salvato solo per action='reject'
   */
  _transition(loanId, action, reason) {
    const body = { action };
    if (typeof reason === 'string' && reason.trim().length > 0) {
      body.reason = reason.trim();
    }
    return apiClient.patch(`/api/loans/${encodeURIComponent(loanId)}`, { body });
  },

  /** Accetta una richiesta (solo lender). requested → confirmed. */
  accept(loanId) {
    return loans._transition(loanId, 'accept');
  },

  /**
   * Rifiuta una richiesta (solo lender). requested → rejected.
   * @param {number} loanId
   * @param {string} [reason] - motivazione opzionale (max 1000 char).
   *   Lo UX raccomanda min 10 char ma il backend e' permissivo.
   */
  reject(loanId, reason) {
    return loans._transition(loanId, 'reject', reason);
  },

  /** Cancella una richiesta (solo requester, finche' requested). requested → cancelled. */
  cancel(loanId) {
    return loans._transition(loanId, 'cancel');
  },

  /** Marca come consegnato (solo lender). confirmed → borrowed (book.available=false). */
  markBorrowed(loanId) {
    return loans._transition(loanId, 'mark_borrowed');
  },

  /** Marca come in restituzione (solo requester). borrowed → returning. */
  markReturning(loanId) {
    return loans._transition(loanId, 'mark_returning');
  },

  /** Conferma restituzione (solo lender). returning → returned (book.available=true). */
  markReturned(loanId) {
    return loans._transition(loanId, 'mark_returned');
  },

  // ---------------------------------------------------------------------------
  // Messaggi (chat interna al prestito)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/loans/:id/messages — lista messaggi (paginato).
   */
  listMessages(loanId, query = {}) {
    return apiClient.get(`/api/loans/${encodeURIComponent(loanId)}/messages`, { query });
  },

  /**
   * POST /api/loans/:id/messages — invia un messaggio.
   * @param {number} loanId
   * @param {{body: string}} payload
   */
  sendMessage(loanId, { body }) {
    return apiClient.post(`/api/loans/${encodeURIComponent(loanId)}/messages`, {
      body: { body },
    });
  },
};
