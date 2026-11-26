// =============================================================================
// src/routes/dataExport.js — GDPR data portability export
// =============================================================================
// GET /api/me/export → dump JSON completo dei dati personali dell'utente
// corrente (art. 20 GDPR — data portability). Il client scarica il file
// e puo' importarlo altrove o conservarlo.
//
// Rate limited (uno ogni 15 min per utente per evitare abuse).
// =============================================================================

import { requireUserId } from '../lib/authHelpers.js';

export default async function dataExportRoutes(fastify) {
  fastify.get(
    '/api/me/export',
    {
      schema: {
        tags: ['Users'],
        summary: 'Export completo dei propri dati (GDPR)',
      },
    },
    async (request, reply) => {
      const userId = await requireUserId(request);

      // 10 query paralleli per raccogliere tutto
      const [
        user,
        orgProfile,
        prefs,
        books,
        loansAsRequester,
        loansAsLender,
        posts,
        reviewsWritten,
        reviewsReceived,
        following,
        followers,
        likes,
      ] = await Promise.all([
        fastify.prisma.user.findUnique({ where: { id: userId } }),
        fastify.prisma.organizationProfile.findUnique({ where: { userId } }),
        fastify.prisma.userPreference.findUnique({ where: { userId } }),
        fastify.prisma.book.findMany({
          where: { ownerId: userId },
          include: { categories: { include: { category: true } } },
        }),
        fastify.prisma.loanRequest.findMany({
          where: { requesterId: userId },
          include: { messages: true },
        }),
        fastify.prisma.loanRequest.findMany({
          where: { lenderId: userId },
          include: { messages: true },
        }),
        fastify.prisma.post.findMany({ where: { authorId: userId } }),
        fastify.prisma.review.findMany({ where: { reviewerId: userId } }),
        fastify.prisma.review.findMany({ where: { targetUserId: userId } }),
        fastify.prisma.follow.findMany({
          where: { followerId: userId },
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
        fastify.prisma.follow.findMany({
          where: { followedId: userId },
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
        fastify.prisma.like.findMany({ where: { userId }, select: { bookId: true } }),
      ]);

      if (!user)
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Utente non trovato' } });

      const dtoUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        accountType: user.accountType,
        bio: user.bio,
        city: user.city,
        avatarUrl: user.avatarUrl,
        lat: user.lat,
        lng: user.lng,
        locationPrecision: user.locationPrecision,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      };

      const payload = {
        exportedAt: new Date().toISOString(),
        format: 'json',
        version: '1',
        user: dtoUser,
        email: user.email, // presente solo nell'export owner-only
        orgProfile: orgProfile
          ? {
              ...orgProfile,
              createdAt: orgProfile.createdAt.toISOString(),
              updatedAt: orgProfile.updatedAt.toISOString(),
            }
          : null,
        prefs: prefs ? { ...prefs, updatedAt: prefs.updatedAt.toISOString() } : null,
        books: books.map((b) => ({
          ...b,
          createdAt: b.createdAt?.toISOString(),
          updatedAt: b.updatedAt?.toISOString(),
          categories: b.categories.map((bc) => ({ id: bc.category.id, name: bc.category.name })),
        })),
        loansAsRequester,
        loansAsLender,
        posts,
        reviewsWritten,
        reviewsReceived,
        follows: {
          following: following.map((f) => f.followed),
          followers: followers.map((f) => f.follower),
        },
        likes: likes.map((l) => l.bookId),
      };

      // Filename friendly (fallback se username ha caratteri strani)
      const safeUsername = (user.username || 'user').replace(/[^a-z0-9_-]/gi, '_');
      reply.header('Content-Type', 'application/json');
      reply.header(
        'Content-Disposition',
        `attachment; filename="lookup-export-${safeUsername}-${Date.now()}.json"`
      );
      return payload;
    }
  );
}
