// =============================================================================
// src/routes/posts.js
// =============================================================================
// Endpoint REST per posts (micro-blog di libreria), reazioni emoji, report.
//
//   GET    /api/posts                          Lista pubblica recente (discovery)
//   GET    /api/posts/feed                     Feed personalizzato (auth)
//   GET    /api/posts/:id                      Dettaglio con reactions aggregate
//   POST   /api/posts                          Crea (auth, max 500 char, almeno un volume)
//   DELETE /api/posts/:id                      Soft-delete (author only)
//   POST   /api/posts/:id/reactions            Reazione (auth, una per utente)
//   DELETE /api/posts/:id/reactions/:emoji     Rimuovi reaction
//   POST   /api/posts/:id/report               Segnala (auth, una volta, non i propri)
// =============================================================================

import crypto from 'node:crypto';
import { getCurrentUserId, requireUserId } from '../lib/authHelpers.js';
import { notifyPostReaction } from '../services/notifications.js';

// -----------------------------------------------------------------------------
// Helper: generazione ID post (compatto, URL-safe)
// -----------------------------------------------------------------------------
// Formato: `p_<12 byte base64url>` = ~18 char totali, fits in VarChar(40)
function generatePostId() {
  return 'p_' + crypto.randomBytes(12).toString('base64url');
}

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

/**
 * DTO post con reactions aggregate per emoji.
 * @param {object} post - record Prisma con `reactions` array opzionale
 * @param {number|null} currentUserId - per calcolare `myReactions[]`
 */
function postDto(post, currentUserId = null) {
  // Aggrega reactions per emoji: { '👍': 3, '❤️': 1 }
  const reactionsByEmoji = {};
  const myReactions = [];
  for (const r of post.reactions || []) {
    reactionsByEmoji[r.emoji] = (reactionsByEmoji[r.emoji] || 0) + 1;
    if (currentUserId && r.userId === currentUserId) myReactions.push(r.emoji);
  }

  return {
    id: post.id,
    author: userSummaryDto(post.author),
    content: post.content,
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    reactionsByEmoji,
    reactionsCount: (post.reactions || []).length,
    myReactions,
    // Segnalato dall'utente corrente (incluso solo se autenticato)
    reportedByMe: (post.reports || []).length > 0,
  };
}

// Reazioni ammesse (una per utente per post, come nell'interfaccia)
export const REACTION_EMOJI = ['👍', '❤️', '👏', '🤔'];

// Motivi di segnalazione (harassment resta per le segnalazioni esistenti)
export const REPORT_REASONS = ['offensive', 'spam', 'off-topic', 'violence', 'other', 'harassment'];

const POST_INCLUDE = {
  author: {
    select: {
      id: true,
      username: true,
      displayName: true,
      publicCity: true,
      accountType: true,
      avatarUrl: true,
    },
  },
  reactions: { select: { emoji: true, userId: true } }, // serve per aggregato + myReactions
};

/** Include dei post; con utente autenticato anche le sue segnalazioni. */
function postInclude(currentUserId) {
  return currentUserId
    ? {
        ...POST_INCLUDE,
        reports: { where: { reporterId: currentUserId }, select: { id: true } },
      }
    : POST_INCLUDE;
}

// -----------------------------------------------------------------------------
// Plugin Fastify
// -----------------------------------------------------------------------------

export default async function postsRoutes(fastify) {
  // ===========================================================================
  // GET /api/posts — Lista pubblica recente (discovery)
  // ===========================================================================
  fastify.get(
    '/api/posts',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            authorId: { type: 'string', minLength: 1, maxLength: 40 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const { authorId, limit, offset } = request.query;
      const currentUserId = await getCurrentUserId(request);

      const where = { status: 'active' };
      if (authorId) where.authorId = authorId;

      const [posts, total] = await Promise.all([
        fastify.prisma.post.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: postInclude(currentUserId),
        }),
        fastify.prisma.post.count({ where }),
      ]);

      return {
        data: posts.map((p) => postDto(p, currentUserId)),
        pagination: { total, limit, offset },
      };
    }
  );

  // ===========================================================================
  // GET /api/posts/feed — Feed personalizzato (auth required)
  // ===========================================================================
  fastify.get(
    '/api/posts/feed',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const userId = await requireUserId(request);
      const { limit, offset } = request.query;

      // Recupera IDs degli utenti seguiti + se stesso
      const followed = await fastify.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followedId: true },
      });
      const authorIds = [userId, ...followed.map((f) => f.followedId)];

      const where = { authorId: { in: authorIds }, status: 'active' };

      const [posts, total] = await Promise.all([
        fastify.prisma.post.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: postInclude(userId),
        }),
        fastify.prisma.post.count({ where }),
      ]);

      return {
        data: posts.map((p) => postDto(p, userId)),
        pagination: { total, limit, offset },
        feedSize: authorIds.length, // utile al frontend per messaggi "segui altri utenti"
      };
    }
  );

  // ===========================================================================
  // GET /api/posts/:id — Dettaglio
  // ===========================================================================
  fastify.get(
    '/api/posts/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const currentUserId = await getCurrentUserId(request);

      const post = await fastify.prisma.post.findUnique({
        where: { id },
        include: postInclude(currentUserId),
      });
      if (!post || post.status !== 'active') {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Post con id ${id} non trovato` },
        });
      }

      return postDto(post, currentUserId);
    }
  );

  // ===========================================================================
  // POST /api/posts — Crea
  // ===========================================================================
  fastify.post(
    '/api/posts',
    {
      schema: {
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 500 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const userId = await requireUserId(request);
      const content = request.body.content.trim();

      if (!content) {
        return reply.status(400).send({
          error: { code: 'EMPTY_CONTENT', message: 'Il post non può essere vuoto' },
        });
      }
      // Si pubblica sulla propria libreria: serve almeno un volume
      const booksCount = await fastify.prisma.book.count({
        where: { ownerId: userId, status: 'active' },
      });
      if (booksCount === 0) {
        return reply.status(403).send({
          error: {
            code: 'NO_BOOKS',
            message: 'Per pubblicare un post devi prima aggiungere almeno un volume',
          },
        });
      }

      const post = await fastify.prisma.post.create({
        data: {
          id: generatePostId(),
          authorId: userId,
          content,
        },
        include: postInclude(userId),
      });

      return reply.status(201).send(postDto(post, userId));
    }
  );

  // ===========================================================================
  // DELETE /api/posts/:id — Soft-delete (author only)
  // ===========================================================================
  // Soft-delete via status='removed' invece di hard delete: mantiene integrità
  // referenziale di reactions e reports (entrambi cascade ON DELETE, ma con
  // soft-delete possiamo recuperare in caso di errore + ricostruire history).
  fastify.delete(
    '/api/posts/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = await requireUserId(request);

      const post = await fastify.prisma.post.findUnique({
        where: { id },
        select: { authorId: true, status: true },
      });
      if (!post || post.status === 'removed') {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Post con id ${id} non trovato` },
        });
      }
      if (post.authorId !== userId) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: "Non sei l'autore di questo post" },
        });
      }

      await fastify.prisma.post.update({
        where: { id },
        data: { status: 'removed' },
      });
      return reply.status(204).send();
    }
  );

  // ===========================================================================
  // POST /api/posts/:id/reactions — Upsert reaction
  // ===========================================================================
  fastify.post(
    '/api/posts/:id/reactions',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['emoji'],
          properties: {
            emoji: { type: 'string', enum: REACTION_EMOJI },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { emoji } = request.body;
      const userId = await requireUserId(request);

      // Verifica esistenza + carica info per notifica
      const post = await fastify.prisma.post.findUnique({
        where: { id },
        select: {
          id: true,
          authorId: true,
          status: true,
          content: true,
        },
      });
      if (!post || post.status !== 'active') {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Post con id ${id} non trovato` },
        });
      }

      // Una reazione per utente: la nuova sostituisce le altre (idempotente)
      await fastify.prisma.$transaction([
        fastify.prisma.postReaction.deleteMany({
          where: { postId: id, userId, emoji: { not: emoji } },
        }),
        fastify.prisma.postReaction.upsert({
          where: { postId_userId_emoji: { postId: id, userId, emoji } },
          create: { postId: id, userId, emoji },
          update: {},
        }),
      ]);

      // Notifica all'autore (skip se reactor === author per emit())
      const reactor = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      });
      await notifyPostReaction(
        { prisma: fastify.prisma, log: request.log },
        {
          reactorId: userId,
          authorId: post.authorId,
          emoji,
          reactorDisplayName: reactor.displayName,
          postPreview: post.content,
        }
      );

      // Conta tutte le reactions correnti per ritorno
      const reactionsCount = await fastify.prisma.postReaction.count({ where: { postId: id } });
      return { reacted: true, postId: id, emoji, reactionsCount };
    }
  );

  // ===========================================================================
  // DELETE /api/posts/:id/reactions/:emoji — Rimuovi reaction (idempotente)
  // ===========================================================================
  fastify.delete(
    '/api/posts/:id/reactions/:emoji',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', minLength: 1, maxLength: 40 },
            emoji: { type: 'string', minLength: 1, maxLength: 16 },
          },
          required: ['id', 'emoji'],
        },
      },
    },
    async (request) => {
      const { id, emoji } = request.params;
      const userId = await requireUserId(request);

      try {
        await fastify.prisma.postReaction.delete({
          where: { postId_userId_emoji: { postId: id, userId, emoji } },
        });
      } catch (err) {
        if (err.code !== 'P2025') throw err;
        // idempotente: se non c'era, OK lo stesso
      }

      const reactionsCount = await fastify.prisma.postReaction.count({ where: { postId: id } });
      return { reacted: false, postId: id, emoji, reactionsCount };
    }
  );

  // ===========================================================================
  // POST /api/posts/:id/report — Segnala post
  // ===========================================================================
  fastify.post(
    '/api/posts/:id/report',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', enum: REPORT_REASONS },
            note: { type: 'string', maxLength: 2000 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { reason, note } = request.body;
      const reporterId = await requireUserId(request);

      const post = await fastify.prisma.post.findUnique({
        where: { id },
        select: { id: true, status: true, authorId: true },
      });
      if (!post || post.status !== 'active') {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Post con id ${id} non trovato` },
        });
      }
      if (post.authorId === reporterId) {
        return reply.status(400).send({
          error: { code: 'SELF_REPORT', message: 'Non puoi segnalare un tuo post' },
        });
      }
      const already = await fastify.prisma.postReport.count({
        where: { postId: id, reporterId },
      });
      if (already > 0) {
        return reply.status(409).send({
          error: { code: 'ALREADY_REPORTED', message: 'Hai già segnalato questo post' },
        });
      }

      const report = await fastify.prisma.postReport.create({
        data: { postId: id, reporterId, reason, note: note || null },
      });

      return reply.status(201).send({
        id: report.id,
        postId: id,
        reason: report.reason,
        createdAt: report.createdAt,
      });
    }
  );
}
