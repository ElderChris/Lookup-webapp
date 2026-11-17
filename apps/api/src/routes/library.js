// =============================================================================
// src/routes/library.js — Aggregato per profile page (Beta 2)
// =============================================================================
// Endpoint pesante che restituisce in un'unica request tutto cio' che serve
// per renderizzare profile.html: user + org profile + prefs + stats.
//
// Sostituisce il legacy API.getLibraryData (localStorage).
// Route:
//   GET /api/users/:id/library  → aggregato pubblico
// =============================================================================

import { getCurrentUserId } from '../lib/authHelpers.js';

export default async function libraryRoutes(fastify) {
  fastify.get(
    '/api/users/:id/library',
    {
      schema: {
        tags: ['Users'],
        summary: 'Aggregato profilo utente (per profile page)',
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

      // 8 query paralleli — indicizzate, veloci
      const [
        user,
        orgProfile,
        prefs,
        booksCount,
        booksAvailable,
        loansAgg,
        followsAgg,
        reviewsAgg,
        isFollowingRow,
      ] = await Promise.all([
        fastify.prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            username: true,
            displayName: true,
            accountType: true,
            bio: true,
            city: true,
            avatarUrl: true,
            avatarDataUrl: true,
            lat: true,
            lng: true,
            role: true,
            status: true,
            createdAt: true,
          },
        }),
        fastify.prisma.organizationProfile.findUnique({ where: { userId: id } }),
        fastify.prisma.userPreference.findUnique({ where: { userId: id } }),
        fastify.prisma.book.count({ where: { ownerId: id } }),
        fastify.prisma.book.count({ where: { ownerId: id, available: true } }),
        // Aggregate loans as either lender (owner) or requester
        fastify.prisma.$queryRawUnsafe(
          `
          SELECT
            SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END)::int AS completed,
            SUM(CASE WHEN status IN ('requested','confirmed','borrowed','returning') THEN 1 ELSE 0 END)::int AS active
          FROM loan_requests WHERE lender_id = $1 OR requester_id = $1
        `,
          id
        ),
        Promise.all([
          fastify.prisma.follow.count({ where: { followedId: id } }),
          fastify.prisma.follow.count({ where: { followerId: id } }),
        ]),
        fastify.prisma.$queryRawUnsafe(
          `
          SELECT COUNT(*)::int AS cnt, AVG(rating)::float AS avg_rating
          FROM reviews WHERE target_user_id = $1
        `,
          id
        ),
        currentUserId && currentUserId !== id
          ? fastify.prisma.follow.findFirst({
              where: { followerId: currentUserId, followedId: id },
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);

      if (!user)
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Utente non trovato' } });

      const [followersCount, followingCount] = followsAgg;
      const loanRow = loansAgg[0] || { completed: 0, active: 0 };
      const reviewRow = reviewsAgg[0] || { cnt: 0, avg_rating: null };

      // Reuse dto helpers (inline per semplicita')
      const dtoUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        accountType: user.accountType,
        bio: user.bio,
        city: user.city,
        avatarUrl: user.avatarUrl || user.avatarDataUrl,
        lat: user.lat,
        lng: user.lng,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      };

      const dtoOrg = orgProfile
        ? {
            userId: orgProfile.userId,
            legalName: orgProfile.legalName,
            orgCategory: orgProfile.orgCategory,
            contactPerson: orgProfile.contactPerson,
            website: orgProfile.website,
            publicEmail: orgProfile.publicEmail,
            publicPhone: orgProfile.publicPhone,
            publicAddress: orgProfile.publicAddress,
            openingHours: orgProfile.openingHours,
            createdAt: orgProfile.createdAt.toISOString(),
            updatedAt: orgProfile.updatedAt.toISOString(),
          }
        : null;

      const dtoPrefs = prefs
        ? {
            userId: prefs.userId,
            viewMode: prefs.viewMode,
            theme: prefs.theme,
            avatarStyle: prefs.avatarStyle,
            avatarSymbol: prefs.avatarSymbol,
            motto: prefs.motto,
            sortBy: prefs.sortBy,
            coverDesign: prefs.coverDesign,
            showEmail: prefs.showEmail,
            updatedAt: prefs.updatedAt.toISOString(),
          }
        : null;

      return {
        user: dtoUser,
        orgProfile: dtoOrg,
        prefs: dtoPrefs,
        stats: {
          booksCount,
          booksAvailable,
          completedLoansCount: loanRow.completed || 0,
          activeLoansCount: loanRow.active || 0,
          followersCount,
          followingCount,
          reviewsReceivedCount: reviewRow.cnt || 0,
          avgRatingReceived: reviewRow.avg_rating,
        },
        isFollowing: currentUserId ? Boolean(isFollowingRow) : null,
      };
    }
  );
}
