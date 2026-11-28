// =============================================================================
// src/routes/loans.js
// =============================================================================
// Endpoint REST per richieste di prestito e messaggi nel thread.
//
//   POST   /api/books/:id/loan-requests   Crea richiesta (auth, no self-loan)
//   GET    /api/me/loans/sent             Richieste fatte come requester
//   GET    /api/me/loans/received         Richieste ricevute come lender
//   GET    /api/loans/:id                 Dettaglio (participant only)
//   PATCH  /api/loans/:id                 Transizione di stato (action)
//   POST   /api/loans/:id/messages        Aggiungi messaggio
//   POST   /api/loans/:id/read            Segna come letti i messaggi
//   GET    /api/loans/:id/messages        Storico messaggi (paginated)
//
// State machine (vedi commento in schema.prisma LoanRequest):
//   requested → confirmed → borrowed → returning → returned (T)
//             ↘ rejected (T)
//             ↘ cancelled (T)   (cancel possibile anche da confirmed)
// =============================================================================

import { requireUserId } from '../lib/authHelpers.js';
import {
  notifyBookAvailable,
  notifyLoanRequested,
  notifyLoanStatusChange,
  notifyNewLoanMessage,
} from '../services/notifications.js';
import { loansCreated, loansTransitions } from '../lib/metrics.js';
import { ACTIVE_LOAN_STATUSES } from '../lib/loanStatus.js';

// -----------------------------------------------------------------------------
// State machine: definizione transizioni ammesse
// -----------------------------------------------------------------------------

const TRANSITIONS = {
  accept: {
    from: ['requested'],
    by: 'lender',
    to: 'confirmed',
    timestampField: 'confirmedAt',
  },
  reject: {
    from: ['requested'],
    by: 'lender',
    to: 'rejected',
    timestampField: 'rejectedAt',
  },
  cancel: {
    from: ['requested', 'confirmed'],
    by: 'either',
    to: 'cancelled',
    timestampField: 'cancelledAt',
  },
  mark_borrowed: {
    from: ['confirmed'],
    by: 'lender',
    to: 'borrowed',
    timestampField: 'borrowedAt',
    bookAvailable: false,
  },
  mark_returning: {
    from: ['borrowed'],
    by: 'requester',
    to: 'returning',
    timestampField: 'returningAt',
  },
  mark_returned: {
    from: ['returning'],
    by: 'lender',
    to: 'returned',
    timestampField: 'returnedAt',
    bookAvailable: true,
  },
};

// -----------------------------------------------------------------------------
// Helper: DTO
// -----------------------------------------------------------------------------

function userSummaryDto(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    city: u.publicCity ?? null,
    accountType: u.accountType,
    avatarUrl: u.avatarUrl,
  };
}

function loanDto(loan, currentUserId, unreadCount = 0) {
  const role = currentUserId === loan.requesterId ? 'requester' : 'lender';
  return {
    id: loan.id,
    status: loan.status,
    role,
    book: loan.book
      ? {
          id: loan.book.id,
          title: loan.book.title,
          author: loan.book.author,
          coverUrl: loan.book.coverUrl,
          available: loan.book.available,
          // 'removed': ritirato dal proprietario dopo la fine del prestito
          status: loan.book.status,
        }
      : null,
    requester: userSummaryDto(loan.requester),
    lender: userSummaryDto(loan.lender),
    message: loan.message,
    rejectReason: loan.rejectReason ?? null,
    // durata prestito + deadline + flag reminder (per UI countdown)
    daysRequested: loan.daysRequested ?? null,
    deadline: loan.deadline ?? null,
    reminderSentAt: loan.reminderSentAt ?? null,
    timestamps: {
      requested: loan.requestedAt,
      confirmed: loan.confirmedAt,
      borrowed: loan.borrowedAt,
      returning: loan.returningAt,
      returned: loan.returnedAt,
      rejected: loan.rejectedAt,
      cancelled: loan.cancelledAt,
    },
    messagesCount: loan._count?.messages ?? 0,
    // Messaggi dell'altro partecipante non ancora letti da chi chiede
    unreadCount,
  };
}

/**
 * Messaggi non letti per l'utente, per ciascun prestito indicato: messaggi
 * dell'altro partecipante successivi all'ultima lettura dell'utente
 * (requester_last_read_at o lender_last_read_at a seconda del ruolo).
 * Una sola query per tutta la lista.
 *
 * @returns {Promise<Map<number, number>>} loanId → non letti
 */
async function unreadCounts(prisma, userId, loanIds) {
  const counts = new Map();
  if (loanIds.length === 0) return counts;
  const rows = await prisma.$queryRaw`
    SELECT m.loan_id AS "loanId", COUNT(*)::int AS "unread"
    FROM loan_messages m
    JOIN loan_requests l ON l.id = m.loan_id
    WHERE m.loan_id = ANY(${loanIds}::int[])
      AND m.sender_id <> ${userId}
      AND m.created_at > COALESCE(
        CASE WHEN l.requester_id = ${userId} THEN l.requester_last_read_at
             ELSE l.lender_last_read_at END,
        'epoch'::timestamptz)
    GROUP BY m.loan_id`;
  for (const r of rows) counts.set(Number(r.loanId), Number(r.unread));
  return counts;
}

function loanMessageDto(msg) {
  return {
    id: msg.id,
    sender: userSummaryDto(msg.sender),
    body: msg.body,
    createdAt: msg.createdAt,
  };
}

// -----------------------------------------------------------------------------
// Helper: include standard per loan queries
// -----------------------------------------------------------------------------

const LOAN_INCLUDE = {
  book: {
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
      available: true,
      ownerId: true,
      status: true,
    },
  },
  requester: {
    select: {
      id: true,
      username: true,
      displayName: true,
      publicCity: true,
      accountType: true,
      avatarUrl: true,
    },
  },
  lender: {
    select: {
      id: true,
      username: true,
      displayName: true,
      publicCity: true,
      accountType: true,
      avatarUrl: true,
    },
  },
  _count: { select: { messages: true } },
};

// -----------------------------------------------------------------------------
// Helper: verifica che l'utente sia partecipante del prestito
// -----------------------------------------------------------------------------

function getRole(loan, userId) {
  if (loan.requesterId === userId) return 'requester';
  if (loan.lenderId === userId) return 'lender';
  return null;
}

function requireParticipant(loan, userId) {
  const role = getRole(loan, userId);
  if (!role) {
    const err = new Error('Non sei partecipante di questo prestito');
    err.statusCode = 403;
    err.code = 'NOT_PARTICIPANT';
    throw err;
  }
  return role;
}

// -----------------------------------------------------------------------------
// Plugin Fastify
// -----------------------------------------------------------------------------

export default async function loansRoutes(fastify) {
  // ===========================================================================
  // POST /api/books/:id/loan-requests — Crea richiesta
  // ===========================================================================
  fastify.post(
    '/api/books/:id/loan-requests',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            message: { type: 'string', maxLength: 2000 },
            // durata prestito richiesta (default 14 giorni), da 5 a 28 come
            // nella finestra di richiesta e nei termini di utilizzo. Usata dal
            // job overdue-loans per calcolare la deadline al passaggio a 'borrowed'.
            daysRequested: { type: 'integer', minimum: 5, maximum: 28 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const bookId = request.params.id;
      const requesterId = await requireUserId(request);
      const { message, daysRequested } = request.body || {};

      // Carica book per validazione
      const book = await fastify.prisma.book.findUnique({
        where: { id: bookId },
        select: {
          id: true,
          ownerId: true,
          status: true,
          loanPolicy: true,
          available: true,
          owner: { select: { status: true, acceptsLoans: true } },
        },
      });
      // Solo volumi pubblicati di account attivi
      if (!book || book.status !== 'active' || book.owner.status !== 'active') {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Libro con id ${bookId} non trovato` },
        });
      }
      if (book.loanPolicy !== 'loan') {
        return reply.status(400).send({
          error: {
            code: 'NOT_LOANABLE',
            message: `Questo libro non è prestabile (policy: ${book.loanPolicy})`,
          },
        });
      }
      if (book.ownerId === requesterId) {
        return reply.status(400).send({
          error: { code: 'SELF_LOAN', message: 'Non puoi richiedere in prestito un tuo libro' },
        });
      }
      // Il proprietario ha messo in pausa i prestiti (impostazioni del profilo)
      if (!book.owner.acceptsLoans) {
        return reply.status(409).send({
          error: {
            code: 'LOANS_PAUSED',
            message: 'Il proprietario non accetta richieste di prestito in questo periodo',
          },
        });
      }

      // Verifica niente prestiti attivi già esistenti per (book, requester)
      const existing = await fastify.prisma.loanRequest.findFirst({
        where: {
          bookId,
          requesterId,
          status: { in: ACTIVE_LOAN_STATUSES },
        },
        select: { id: true, status: true },
      });
      if (existing) {
        return reply.status(409).send({
          error: {
            code: 'LOAN_ALREADY_ACTIVE',
            message: `Hai già una richiesta attiva su questo libro (id ${existing.id}, stato ${existing.status})`,
          },
        });
      }

      // Crea richiesta + incrementa book.requestCount in transazione
      const [loan] = await fastify.prisma.$transaction([
        fastify.prisma.loanRequest.create({
          data: {
            bookId,
            requesterId,
            lenderId: book.ownerId,
            message: message || null,
            status: 'requested',
            // durata richiesta, usata per calcolare deadline al mark_borrowed
            daysRequested: daysRequested || null,
          },
          include: LOAN_INCLUDE,
        }),
        fastify.prisma.book.update({
          where: { id: bookId },
          data: { requestCount: { increment: 1 } },
        }),
      ]);

      // Notifica al lender (non-blocking)
      await notifyLoanRequested(
        { prisma: fastify.prisma, log: request.log },
        {
          requesterId,
          lenderId: book.ownerId,
          bookId,
          loanId: loan.id,
          bookTitle: loan.book.title,
          requesterDisplayName: loan.requester.displayName,
        }
      );

      // metrics — nuovo prestito creato
      loansCreated.inc();

      return reply.status(201).send(loanDto(loan, requesterId));
    }
  );

  // ===========================================================================
  // GET /api/me/loans/sent — Richieste fatte come requester
  // ===========================================================================
  fastify.get(
    '/api/me/loans/sent',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' }, // CSV es: "requested,confirmed,borrowed"
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const userId = await requireUserId(request);
      const { status, limit, offset } = request.query;

      const where = { requesterId: userId };
      if (status) {
        where.status = {
          in: status
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        };
      }

      const [loans, total] = await Promise.all([
        fastify.prisma.loanRequest.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { requestedAt: 'desc' },
          include: LOAN_INCLUDE,
        }),
        fastify.prisma.loanRequest.count({ where }),
      ]);
      const unread = await unreadCounts(
        fastify.prisma,
        userId,
        loans.map((l) => l.id)
      );

      return {
        data: loans.map((l) => loanDto(l, userId, unread.get(l.id) ?? 0)),
        pagination: { total, limit, offset },
      };
    }
  );

  // ===========================================================================
  // GET /api/me/loans/received — Richieste ricevute come lender
  // ===========================================================================
  fastify.get(
    '/api/me/loans/received',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' }, // CSV
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const userId = await requireUserId(request);
      const { status, limit, offset } = request.query;

      const where = { lenderId: userId };
      if (status) {
        where.status = {
          in: status
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        };
      }

      const [loans, total] = await Promise.all([
        fastify.prisma.loanRequest.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { requestedAt: 'desc' },
          include: LOAN_INCLUDE,
        }),
        fastify.prisma.loanRequest.count({ where }),
      ]);
      const unread = await unreadCounts(
        fastify.prisma,
        userId,
        loans.map((l) => l.id)
      );

      return {
        data: loans.map((l) => loanDto(l, userId, unread.get(l.id) ?? 0)),
        pagination: { total, limit, offset },
      };
    }
  );

  // ===========================================================================
  // GET /api/loans/:id — Dettaglio (participant only)
  // ===========================================================================
  fastify.get(
    '/api/loans/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = await requireUserId(request);

      const loan = await fastify.prisma.loanRequest.findUnique({
        where: { id },
        include: LOAN_INCLUDE,
      });
      if (!loan) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Prestito con id ${id} non trovato` },
        });
      }

      requireParticipant(loan, userId);
      const unread = await unreadCounts(fastify.prisma, userId, [loan.id]);
      return loanDto(loan, userId, unread.get(loan.id) ?? 0);
    }
  );

  // ===========================================================================
  // PATCH /api/loans/:id — Transizione di stato (action+role validation)
  // ===========================================================================
  fastify.patch(
    '/api/loans/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              enum: [
                'accept',
                'reject',
                'cancel',
                'mark_borrowed',
                'mark_returning',
                'mark_returned',
              ],
            },
            // motivazione opzionale, valutata solo per action='reject'.
            // Validation lato UI (min 10 char) ma il backend e' permissivo:
            // accetta qualsiasi stringa <= 1000 char per non bloccare casi
            // edge (es. shadow integration vecchia che non passa reason).
            reason: { type: 'string', maxLength: 1000 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = await requireUserId(request);
      const { action, reason } = request.body;

      const loan = await fastify.prisma.loanRequest.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          requesterId: true,
          lenderId: true,
          bookId: true,
          daysRequested: true,
        },
      });
      if (!loan) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Prestito con id ${id} non trovato` },
        });
      }

      const role = requireParticipant(loan, userId);
      const transition = TRANSITIONS[action];
      // (l'enum nel JSON schema garantisce che action sia valida)

      // 1. Validazione stato corrente
      if (!transition.from.includes(loan.status)) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_TRANSITION',
            message: `Azione "${action}" non consentita da stato "${loan.status}". Stati ammessi: ${transition.from.join(', ')}`,
          },
        });
      }

      // 2. Validazione ruolo
      if (transition.by !== 'either' && transition.by !== role) {
        return reply.status(403).send({
          error: {
            code: 'WRONG_ROLE',
            message: `Solo il "${transition.by}" può eseguire "${action}", tu sei "${role}"`,
          },
        });
      }

      // 3. Applica transizione + side effect su book.available in transazione
      // salva rejectReason quando action='reject' e reason fornita.
      const updateData = {
        status: transition.to,
        [transition.timestampField]: new Date(),
      };
      if (action === 'reject' && typeof reason === 'string' && reason.trim().length > 0) {
        updateData.rejectReason = reason.trim();
      }
      // quando il libro passa a 'borrowed', calcola la deadline
      // (borrowedAt + daysRequested giorni) per abilitare il job overdue-loans.
      // Se daysRequested non e' valorizzato (prestiti creati prima della durata), usa 14 giorni default.
      if (action === 'mark_borrowed') {
        const days = loan.daysRequested || 14;
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + days);
        updateData.deadline = deadline;
        // reset reminderSentAt in caso il libro riparta dopo essere stato returned
        updateData.reminderSentAt = null;
      }

      const ops = [
        fastify.prisma.loanRequest.update({
          where: { id },
          data: updateData,
          include: LOAN_INCLUDE,
        }),
      ];
      if (typeof transition.bookAvailable === 'boolean') {
        ops.push(
          fastify.prisma.book.update({
            where: { id: loan.bookId },
            data: { available: transition.bookAvailable },
          })
        );
      }

      const [updated] = await fastify.prisma.$transaction(ops);

      // metrics — transizione di stato
      loansTransitions.labels(action).inc();

      // Notifica all'altro partecipante (non-blocking)
      const recipientId = role === 'requester' ? loan.lenderId : loan.requesterId;
      await notifyLoanStatusChange(
        { prisma: fastify.prisma, log: request.log },
        {
          action,
          actorId: userId,
          recipientId,
          bookId: loan.bookId,
          loanId: updated.id,
          bookTitle: updated.book.title,
          actorDisplayName:
            role === 'requester' ? updated.requester.displayName : updated.lender.displayName,
        }
      );

      // Volume di nuovo disponibile: avviso a chi gli ha messo "mi piace"
      if (action === 'mark_returned') {
        await notifyBookAvailable(
          { prisma: fastify.prisma, log: request.log },
          { bookId: loan.bookId, excludeUserIds: [loan.requesterId] }
        );
      }

      const unread = await unreadCounts(fastify.prisma, userId, [updated.id]);
      return loanDto(updated, userId, unread.get(updated.id) ?? 0);
    }
  );

  // ===========================================================================
  // POST /api/loans/:id/messages — Aggiungi messaggio (participant only)
  // ===========================================================================
  fastify.post(
    '/api/loans/:id/messages',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['body'],
          properties: {
            body: { type: 'string', minLength: 1, maxLength: 2000 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = await requireUserId(request);
      const { body } = request.body;

      const loan = await fastify.prisma.loanRequest.findUnique({
        where: { id },
        select: {
          id: true,
          requesterId: true,
          lenderId: true,
          book: { select: { title: true } },
        },
      });
      if (!loan) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Prestito con id ${id} non trovato` },
        });
      }
      requireParticipant(loan, userId);

      const msg = await fastify.prisma.loanMessage.create({
        data: { loanId: id, senderId: userId, body },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              publicCity: true,
              accountType: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Notifica all'altro partecipante (non-blocking)
      const recipientId = loan.requesterId === userId ? loan.lenderId : loan.requesterId;
      await notifyNewLoanMessage(
        { prisma: fastify.prisma, log: request.log },
        {
          senderId: userId,
          recipientId,
          loanId: id,
          bookTitle: loan.book.title,
          senderDisplayName: msg.sender.displayName,
          preview: body,
        }
      );

      return reply.status(201).send(loanMessageDto(msg));
    }
  );

  // ===========================================================================
  // GET /api/loans/:id/messages — Storico messaggi (paginated)
  // ===========================================================================
  fastify.get(
    '/api/loans/:id/messages',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = await requireUserId(request);
      const { limit, offset } = request.query;

      const loan = await fastify.prisma.loanRequest.findUnique({
        where: { id },
        select: { id: true, requesterId: true, lenderId: true },
      });
      if (!loan) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Prestito con id ${id} non trovato` },
        });
      }
      requireParticipant(loan, userId);

      const [messages, total] = await Promise.all([
        fastify.prisma.loanMessage.findMany({
          where: { loanId: id },
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'asc' }, // chronological per conversazione
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
                publicCity: true,
                accountType: true,
                avatarUrl: true,
              },
            },
          },
        }),
        fastify.prisma.loanMessage.count({ where: { loanId: id } }),
      ]);

      return {
        data: messages.map(loanMessageDto),
        pagination: { total, limit, offset },
      };
    }
  );

  // ===========================================================================
  // POST /api/loans/:id/read — Segna come letti i messaggi della chat
  // ===========================================================================
  fastify.post(
    '/api/loans/:id/read',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = await requireUserId(request);
      const loan = await fastify.prisma.loanRequest.findUnique({
        where: { id },
        select: { id: true, requesterId: true, lenderId: true },
      });
      if (!loan) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Prestito con id ${id} non trovato` },
        });
      }
      const role = requireParticipant(loan, userId);
      await fastify.prisma.loanRequest.update({
        where: { id },
        data:
          role === 'requester'
            ? { requesterLastReadAt: new Date() }
            : { lenderLastReadAt: new Date() },
      });
      return { loanId: id, unreadCount: 0 };
    }
  );
}
