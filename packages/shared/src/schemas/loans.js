// =============================================================================
// packages/shared/src/schemas/loans.js
// =============================================================================
// Schemi Zod per gli endpoint /api/loans/* + /api/books/:id/loan-requests.
// Include la state machine completa.
// =============================================================================

import { z } from 'zod';
import {
  IntId, IsoDateTime, PaginationQuery, PaginatedResponse, UserSummaryDto,
} from './common.js';

// -----------------------------------------------------------------------------
// State machine
// -----------------------------------------------------------------------------

/**
 * Stati possibili di un prestito.
 * Transizioni valide (vedi src/routes/loans.js per dettaglio):
 *
 *   requested ──accept──> confirmed ──mark_borrowed──> borrowed
 *      │  └──cancel──> cancelled                            │
 *      └──reject──> rejected                          mark_returning
 *                                                           │
 *                                                       returning
 *                                                           │
 *                                                     mark_returned
 *                                                           │
 *                                                       returned
 */
export const LoanStatus = z.enum([
  'requested',
  'confirmed',
  'borrowed',
  'returning',
  'returned',
  'rejected',
  'cancelled',
]);

/** Azioni di transizione (campo `action` del PATCH) */
export const LoanAction = z.enum([
  'accept',
  'reject',
  'cancel',
  'mark_borrowed',
  'mark_returning',
  'mark_returned',
]);

/** Ruolo dell'utente rispetto al prestito */
export const LoanRole = z.enum(['requester', 'lender']);

// -----------------------------------------------------------------------------
// DTO
// -----------------------------------------------------------------------------

/** Riferimento "leggero" al libro (sub-DTO per evitare cicli) */
const BookRefDto = z.object({
  id: IntId,
  title: z.string(),
  author: z.string(),
  coverUrl: z.string().url().nullable(),
  available: z.boolean(),
});

export const LoanDto = z.object({
  id: IntId,
  status: LoanStatus,
  role: LoanRole,                  // ruolo del chiamante autenticato
  message: z.string().nullable(),  // messaggio iniziale del requester
  rejectReason: z.string().nullable(), // Fase 1g.2: motivazione del rifiuto (lender)
  requestedAt: IsoDateTime,
  confirmedAt: IsoDateTime.nullable(),
  borrowedAt: IsoDateTime.nullable(),
  returningAt: IsoDateTime.nullable(),
  returnedAt: IsoDateTime.nullable(),
  rejectedAt: IsoDateTime.nullable(),
  cancelledAt: IsoDateTime.nullable(),
  book: BookRefDto,
  requester: UserSummaryDto,
  lender: UserSummaryDto,
});

// -----------------------------------------------------------------------------
// Request bodies
// -----------------------------------------------------------------------------

export const CreateLoanRequestBody = z.object({
  message: z.string().max(500).optional(),
});

export const PatchLoanBody = z.object({
  action: LoanAction,
  // Fase 1g.2: motivazione opzionale, valutata solo per action='reject'.
  // Il backend la accetta ma la salva solo quando action='reject';
  // negli altri casi viene ignorata.
  reason: z.string().max(1000).optional(),
});

// -----------------------------------------------------------------------------
// Messages (chat interna al prestito)
// -----------------------------------------------------------------------------

export const LoanMessageDto = z.object({
  id: IntId,
  body: z.string(),
  createdAt: IsoDateTime,
  author: UserSummaryDto,
});

export const CreateLoanMessageBody = z.object({
  body: z.string().min(1).max(2000),
});

// -----------------------------------------------------------------------------
// Query strings + responses
// -----------------------------------------------------------------------------

export const ListLoansQuery = PaginationQuery.extend({
  status: LoanStatus.optional(),
});

export const ListLoansResponse = PaginatedResponse(LoanDto);
export const ListLoanMessagesResponse = PaginatedResponse(LoanMessageDto);
