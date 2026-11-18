// =============================================================================
// packages/shared/src/schemas/notifications.js
// =============================================================================
// Schemi Zod per gli endpoint /api/me/notifications/*.
// =============================================================================

import { z } from 'zod';
import {
  IntId, IsoDateTime, PaginationQuery, PaginatedResponse, UserSummaryDto,
} from './common.js';

// -----------------------------------------------------------------------------
// Tipi di notifica generati dal backend
// -----------------------------------------------------------------------------

export const NotificationType = z.enum([
  'new_follower',          // qualcuno ha iniziato a seguirti
  'new_review',            // qualcuno ti ha recensito
  'post_reaction',         // qualcuno ha reagito al tuo post
  'loan_request',          // qualcuno ha richiesto un tuo libro in prestito
  'loan_accepted',         // il lender ha accettato la tua richiesta
  'loan_rejected',         // il lender ha rifiutato
  'loan_borrowed',         // marcato come consegnato
  'loan_returning',        // marcato come in restituzione
  'loan_returned',         // marcato come restituito
  'loan_cancelled',        // requester ha cancellato
  'loan_message',          // nuovo messaggio sul prestito
]);

// -----------------------------------------------------------------------------
// DTO
// -----------------------------------------------------------------------------

export const NotificationDto = z.object({
  id: IntId,
  type: NotificationType,
  isRead: z.boolean(),
  createdAt: IsoDateTime,
  /** Utente che ha generato l'evento (null per notifiche di sistema) */
  actor: UserSummaryDto.nullable(),
  /** Payload contestuale (dipende dal type), es. { bookId, postId, loanId } */
  payload: z.record(z.string(), z.unknown()).nullable(),
});

// -----------------------------------------------------------------------------
// Query / Response
// -----------------------------------------------------------------------------

export const ListNotificationsQuery = PaginationQuery.extend({
  unreadOnly: z.coerce.boolean().optional(),
});

/** Response del GET include unreadCount in piu' rispetto al wrapping standard */
export const ListNotificationsResponse = z.object({
  data: z.array(NotificationDto),
  pagination: z.object({
    total: z.number().int().min(0),
    limit: z.number().int().positive(),
    offset: z.number().int().min(0),
  }),
  unreadCount: z.number().int().min(0),
});

export const MarkReadResponse = z.object({
  id: IntId,
  isRead: z.literal(true),
});

export const MarkAllReadResponse = z.object({
  markedAsRead: z.number().int().min(0),
});
