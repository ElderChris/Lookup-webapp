// =============================================================================
// src/routes/notifications.js
// =============================================================================
// Endpoint REST per la gestione delle notifiche del current user.
//
//   GET    /api/me/notifications              Lista paginata + unreadCount
//   PATCH  /api/me/notifications/:id/read     Marca singola come letta
//   POST   /api/me/notifications/read-all     Marca tutte come lette
//   DELETE /api/me/notifications/:id          Cancella (cleanup)
//
// Le notifiche vengono CREATE da altri endpoint via src/services/notifications.js
// (es. POST follow → notifyNewFollower → INSERT notification).
// =============================================================================

import { requireUserId } from '../lib/authHelpers.js';

// -----------------------------------------------------------------------------
// Helper: DTO
// -----------------------------------------------------------------------------

function userSummaryDto(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    accountType: u.accountType,
  };
}

function notificationDto(n) {
  return {
    id: n.id,
    type: n.type,
    message: n.message,
    actor: userSummaryDto(n.actor),
    book: n.book ? { id: n.book.id, title: n.book.title, coverUrl: n.book.coverUrl } : null,
    createdAt: n.createdAt,
    readAt: n.readAt,
    isRead: n.readAt !== null,
  };
}

const NOTIFICATION_INCLUDE = {
  actor: {
    select: { id: true, username: true, displayName: true, avatarUrl: true, accountType: true },
  },
  book: { select: { id: true, title: true, coverUrl: true } },
};

// -----------------------------------------------------------------------------
// Plugin Fastify
// -----------------------------------------------------------------------------

export default async function notificationsRoutes(fastify) {
  // ===========================================================================
  // GET /api/me/notifications — Lista paginata + unreadCount
  // ===========================================================================
  fastify.get(
    '/api/me/notifications',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            // unread-only filter: ?unreadOnly=true
            unreadOnly: { type: 'boolean', default: false },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const userId = await requireUserId(request);
      const { unreadOnly, limit, offset } = request.query;

      const where = { userId };
      if (unreadOnly) where.readAt = null;

      const [notifications, total, unreadCount] = await Promise.all([
        fastify.prisma.notification.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: NOTIFICATION_INCLUDE,
        }),
        fastify.prisma.notification.count({ where }),
        fastify.prisma.notification.count({ where: { userId, readAt: null } }),
      ]);

      return {
        data: notifications.map(notificationDto),
        pagination: { total, limit, offset },
        unreadCount,
      };
    }
  );

  // ===========================================================================
  // PATCH /api/me/notifications/:id/read — Marca singola come letta
  // ===========================================================================
  fastify.patch(
    '/api/me/notifications/:id/read',
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

      const n = await fastify.prisma.notification.findUnique({
        where: { id },
        select: { id: true, userId: true, readAt: true },
      });
      if (!n) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Notifica con id ${id} non trovata` },
        });
      }
      if (n.userId !== userId) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Questa notifica non è tua' },
        });
      }

      // Se già letta, restituiamo lo stato corrente (idempotente)
      if (n.readAt) {
        return { id, isRead: true, readAt: n.readAt };
      }

      const updated = await fastify.prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
        select: { id: true, readAt: true },
      });
      return { id: updated.id, isRead: true, readAt: updated.readAt };
    }
  );

  // ===========================================================================
  // POST /api/me/notifications/read-all — Marca tutte come lette
  // ===========================================================================
  fastify.post('/api/me/notifications/read-all', async (request) => {
    const userId = await requireUserId(request);

    const result = await fastify.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { markedAsRead: result.count };
  });

  // ===========================================================================
  // DELETE /api/me/notifications/:id — Cancella
  // ===========================================================================
  fastify.delete(
    '/api/me/notifications/:id',
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

      const n = await fastify.prisma.notification.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });
      if (!n) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Notifica con id ${id} non trovata` },
        });
      }
      if (n.userId !== userId) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Questa notifica non è tua' },
        });
      }

      await fastify.prisma.notification.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
