// =============================================================================
// src/routes/users.js
// =============================================================================
// Endpoint REST per utenti, recensioni e follow.
//
//   GET    /api/users/me                      Profilo completo current user
//   GET    /api/users/:id                     Profilo pubblico
//   PATCH  /api/users/me                      Aggiorna profilo (incl. OrgProfile)
//
//   GET    /api/users/:id/reviews             Recensioni ricevute (paginated)
//   POST   /api/users/:id/reviews             Crea/aggiorna recensione (upsert)
//   DELETE /api/users/:targetId/reviews/me    Cancella propria recensione
//
//   POST   /api/users/:id/follow              Follow
//   DELETE /api/users/:id/follow              Unfollow
//   GET    /api/users/:id/followers           Lista follower (summary)
//   GET    /api/users/:id/following           Lista following (summary)
// =============================================================================

import { getCurrentUserId, requireUserId } from '../lib/authHelpers.js';
import { notifyNewFollower, notifyNewReview } from '../services/notifications.js';

// -----------------------------------------------------------------------------
// Helper: DTO
// -----------------------------------------------------------------------------

/**
 * DTO summary di un utente (per liste, follower, following, ecc).
 * Esclude bio, email, preferences. Ottimizzato per response veloci.
 */
function userSummaryDto(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    city: u.city,
    accountType: u.accountType,
    avatarUrl: u.avatarUrl,
  };
}

/**
 * DTO completo di un utente per profilo pubblico.
 * Include counts e organizationProfile se applicabile.
 */
function userPublicDto(u, counts = {}) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    city: u.city,
    lat: u.lat,
    lng: u.lng,
    accountType: u.accountType,
    avatarUrl: u.avatarUrl,
    libraryRole: u.libraryRole,
    publicProfile: u.publicProfile,
    createdAt: u.createdAt,
    counts: {
      books: counts.books ?? 0,
      followers: counts.followers ?? 0,
      following: counts.following ?? 0,
      reviewsReceived: counts.reviewsReceived ?? 0,
    },
    averageRating: counts.averageRating ?? null,
    organizationProfile: u.organizationProfile || null,
  };
}

/**
 * DTO privato (per /api/users/me): include email, preferenze.
 */
function userPrivateDto(u, counts = {}) {
  return {
    ...userPublicDto(u, counts),
    email: u.email,
    emailVerified: u.emailVerified,
    role: u.role,
    status: u.status,
    welcomeIndex: u.welcomeIndex,
    lastLoginAt: u.lastLoginAt,
    preferences: u.preferences || null,
  };
}

/**
 * DTO di una review con reviewer summary.
 */
function reviewDto(r) {
  return {
    id: r.id,
    targetUserId: r.targetUserId,
    reviewer: r.reviewer ? userSummaryDto(r.reviewer) : null,
    rating: r.rating,
    text: r.text,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// -----------------------------------------------------------------------------
// Helper: query counts + averageRating in parallelo per un user
// -----------------------------------------------------------------------------

async function fetchUserCounts(prisma, userId) {
  const [books, followers, following, reviewsAgg] = await Promise.all([
    prisma.book.count({ where: { ownerId: userId, status: 'active' } }),
    prisma.follow.count({ where: { followedId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
    prisma.review.aggregate({
      where: { targetUserId: userId },
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ]);

  return {
    books,
    followers,
    following,
    reviewsReceived: reviewsAgg._count._all,
    averageRating:
      reviewsAgg._avg.rating != null
        ? Math.round(reviewsAgg._avg.rating * 10) / 10 // 1 decimal
        : null,
  };
}

// -----------------------------------------------------------------------------
// Plugin Fastify
// -----------------------------------------------------------------------------

export default async function usersRoutes(fastify) {
  // ===========================================================================
  // GET /api/users/me — Profilo completo current user
  // ===========================================================================
  fastify.get('/api/users/me', async (request, reply) => {
    const userId = await requireUserId(request);

    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        organizationProfile: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Utente non trovato' },
      });
    }

    const counts = await fetchUserCounts(fastify.prisma, userId);
    return userPrivateDto(user, counts);
  });

  // ===========================================================================
  // GET /api/users/:id — Profilo pubblico (+ isFollowing se auth)
  // ===========================================================================
  fastify.get(
    '/api/users/:id',
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

      const user = await fastify.prisma.user.findUnique({
        where: { id },
        include: { organizationProfile: true },
      });

      if (!user || user.status === 'deleted') {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Utente con id ${id} non trovato` },
        });
      }

      if (!user.publicProfile && currentUserId !== id) {
        return reply.status(403).send({
          error: { code: 'PROFILE_PRIVATE', message: 'Profilo privato' },
        });
      }

      const counts = await fetchUserCounts(fastify.prisma, id);
      const dto = userPublicDto(user, counts);

      // Se auth, indica se current user segue questo profilo
      if (currentUserId && currentUserId !== id) {
        const follow = await fastify.prisma.follow.findUnique({
          where: { followerId_followedId: { followerId: currentUserId, followedId: id } },
        });
        dto.isFollowing = follow !== null;
      } else {
        dto.isFollowing = currentUserId === id ? null : false;
      }

      return dto;
    }
  );

  // ===========================================================================
  // PATCH /api/users/me — Aggiorna profilo (incl. OrgProfile se org)
  // ===========================================================================
  fastify.patch(
    '/api/users/me',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            // Campi User base
            displayName: { type: 'string', minLength: 1, maxLength: 100 },
            bio: { type: 'string', maxLength: 5000 },
            city: { type: 'string', maxLength: 150 },
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
            avatarUrl: { type: 'string', format: 'uri', maxLength: 500 },
            avatarDataUrl: { type: 'string', maxLength: 1_000_000 },
            publicProfile: { type: 'boolean' },
            // Campi OrganizationProfile (validi solo se accountType=='organization')
            organization: {
              type: 'object',
              properties: {
                legalName: { type: 'string', maxLength: 200 },
                orgCategory: { type: 'string', maxLength: 30 },
                contactPerson: { type: 'string', maxLength: 120 },
                website: { type: 'string', format: 'uri', maxLength: 300 },
                publicEmail: { type: 'string', format: 'email', maxLength: 255 },
                publicPhone: { type: 'string', maxLength: 30 },
                publicAddress: { type: 'string', maxLength: 200 },
                openingHours: { type: 'string', maxLength: 5000 },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const userId = await requireUserId(request);
      const { organization, ...userPatch } = request.body;

      const current = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { accountType: true, organizationProfile: { select: { userId: true } } },
      });

      if (!current) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Utente non trovato' },
        });
      }

      if (organization && current.accountType !== 'organization') {
        return reply.status(400).send({
          error: {
            code: 'INVALID_FIELD',
            message: 'Il campo "organization" è valido solo per account type "organization"',
          },
        });
      }

      // Transazione: update User + upsert OrganizationProfile atomici
      const updated = await fastify.prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: userId },
          data: userPatch,
          include: {
            preferences: true,
            organizationProfile: true,
          },
        });

        if (organization) {
          // upsert: aggiorna se esiste, crea se manca (es. legalName obbligatorio al create)
          if (u.organizationProfile) {
            await tx.organizationProfile.update({
              where: { userId },
              data: organization,
            });
          } else {
            if (!organization.legalName) {
              throw Object.assign(
                new Error('legalName è obbligatorio per creare un profilo organizzazione'),
                { statusCode: 400, code: 'MISSING_FIELD' }
              );
            }
            await tx.organizationProfile.create({
              data: { userId, ...organization },
            });
          }
          // ricarica con orgProfile aggiornato
          return tx.user.findUnique({
            where: { id: userId },
            include: { preferences: true, organizationProfile: true },
          });
        }

        return u;
      });

      const counts = await fetchUserCounts(fastify.prisma, userId);
      return userPrivateDto(updated, counts);
    }
  );

  // ===========================================================================
  // GET /api/users/:id/reviews — Recensioni ricevute (paginated)
  // ===========================================================================
  fastify.get(
    '/api/users/:id/reviews',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            role: { type: 'string', enum: ['received', 'written'], default: 'received' },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { limit, offset, role } = request.query;

      // Beta 3 (Opzione W): role='received' → reviews su questo utente (default)
      //                     role='written'  → reviews scritte da questo utente
      const whereClause = role === 'written' ? { reviewerId: id } : { targetUserId: id };

      const [reviews, total, agg] = await Promise.all([
        fastify.prisma.review.findMany({
          where: whereClause,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: {
              select: {
                id: true,
                username: true,
                displayName: true,
                city: true,
                accountType: true,
                avatarUrl: true,
              },
            },
          },
        }),
        fastify.prisma.review.count({ where: whereClause }),
        fastify.prisma.review.aggregate({
          where: whereClause,
          _avg: { rating: true },
        }),
      ]);

      return {
        data: reviews.map(reviewDto),
        pagination: { total, limit, offset },
        averageRating: agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null,
      };
    }
  );

  // ===========================================================================
  // POST /api/users/:id/reviews — Crea/aggiorna recensione (upsert)
  // ===========================================================================
  fastify.post(
    '/api/users/:id/reviews',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['rating', 'text'],
          properties: {
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            text: { type: 'string', minLength: 1, maxLength: 2000 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const targetUserId = request.params.id;
      const reviewerId = await requireUserId(request);
      const { rating, text } = request.body;

      if (reviewerId === targetUserId) {
        return reply.status(400).send({
          error: { code: 'SELF_REVIEW', message: 'Non puoi recensire te stesso' },
        });
      }

      const target = await fastify.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, status: true },
      });
      if (!target || target.status === 'deleted') {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Utente con id ${targetUserId} non trovato` },
        });
      }

      // Upsert: crea o aggiorna basandosi su unique (targetUserId, reviewerId)
      const review = await fastify.prisma.review.upsert({
        where: { targetUserId_reviewerId: { targetUserId, reviewerId } },
        create: { targetUserId, reviewerId, rating, text },
        update: { rating, text },
        include: {
          reviewer: {
            select: {
              id: true,
              username: true,
              displayName: true,
              city: true,
              accountType: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Notifica al target (non-blocking)
      await notifyNewReview(
        { prisma: fastify.prisma, log: request.log },
        {
          reviewerId,
          targetUserId,
          rating,
          reviewerDisplayName: review.reviewer.displayName,
        }
      );

      return reply.status(201).send(reviewDto(review));
    }
  );

  // ===========================================================================
  // DELETE /api/users/:targetId/reviews/me — Cancella propria recensione
  // ===========================================================================
  fastify.delete(
    '/api/users/:targetId/reviews/me',
    {
      schema: {
        params: {
          type: 'object',
          properties: { targetId: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['targetId'],
        },
      },
    },
    async (request, reply) => {
      const targetUserId = request.params.targetId;
      const reviewerId = await requireUserId(request);

      try {
        await fastify.prisma.review.delete({
          where: { targetUserId_reviewerId: { targetUserId, reviewerId } },
        });
        return reply.status(204).send();
      } catch (err) {
        if (err.code === 'P2025') {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'Nessuna recensione tua su questo utente' },
          });
        }
        throw err;
      }
    }
  );

  // ===========================================================================
  // POST /api/users/:id/follow — Follow
  // ===========================================================================
  fastify.post(
    '/api/users/:id/follow',
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
      const followedId = request.params.id;
      const followerId = await requireUserId(request);

      if (followerId === followedId) {
        return reply.status(400).send({
          error: { code: 'SELF_FOLLOW', message: 'Non puoi seguire te stesso' },
        });
      }

      const target = await fastify.prisma.user.findUnique({
        where: { id: followedId },
        select: { id: true, status: true },
      });
      if (!target || target.status === 'deleted') {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Utente con id ${followedId} non trovato` },
        });
      }

      // Idempotente: se esiste già, non errore
      const result = await fastify.prisma.follow.upsert({
        where: { followerId_followedId: { followerId, followedId } },
        create: { followerId, followedId },
        update: {},
      });

      // Notifica al followed (solo se follow NUOVO: createdAt = now)
      // Heuristic: se createdAt e updatedAt-equivalent sono nei 2s, è nuovo
      const isNew = Date.now() - new Date(result.createdAt).getTime() < 2000;
      if (isNew) {
        const follower = await fastify.prisma.user.findUnique({
          where: { id: followerId },
          select: { displayName: true },
        });
        await notifyNewFollower(
          { prisma: fastify.prisma, log: request.log },
          {
            actorId: followerId,
            followedId,
            actorDisplayName: follower.displayName,
          }
        );
      }

      return reply.status(204).send();
    }
  );

  // ===========================================================================
  // DELETE /api/users/:id/follow — Unfollow
  // ===========================================================================
  fastify.delete(
    '/api/users/:id/follow',
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
      const followedId = request.params.id;
      const followerId = await requireUserId(request);

      try {
        await fastify.prisma.follow.delete({
          where: { followerId_followedId: { followerId, followedId } },
        });
      } catch (err) {
        if (err.code !== 'P2025') throw err;
        // se non c'era già, idempotente: 204 lo stesso
      }
      return reply.status(204).send();
    }
  );

  // ===========================================================================
  // GET /api/users/:id/followers — Lista follower (summary)
  // ===========================================================================
  fastify.get(
    '/api/users/:id/followers',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
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
      const { id } = request.params;
      const { limit, offset } = request.query;

      const [follows, total] = await Promise.all([
        fastify.prisma.follow.findMany({
          where: { followedId: id },
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            follower: {
              select: {
                id: true,
                username: true,
                displayName: true,
                city: true,
                accountType: true,
                avatarUrl: true,
              },
            },
          },
        }),
        fastify.prisma.follow.count({ where: { followedId: id } }),
      ]);

      return {
        data: follows.map((f) => ({ ...userSummaryDto(f.follower), followedAt: f.createdAt })),
        pagination: { total, limit, offset },
      };
    }
  );

  // ===========================================================================
  // GET /api/users/:id/following — Lista following (summary)
  // ===========================================================================
  fastify.get(
    '/api/users/:id/following',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
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
      const { id } = request.params;
      const { limit, offset } = request.query;

      const [follows, total] = await Promise.all([
        fastify.prisma.follow.findMany({
          where: { followerId: id },
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            followed: {
              select: {
                id: true,
                username: true,
                displayName: true,
                city: true,
                accountType: true,
                avatarUrl: true,
              },
            },
          },
        }),
        fastify.prisma.follow.count({ where: { followerId: id } }),
      ]);

      return {
        data: follows.map((f) => ({ ...userSummaryDto(f.followed), followedAt: f.createdAt })),
        pagination: { total, limit, offset },
      };
    }
  );
}
