// =============================================================================
// src/routes/library.js — Aggregato per profile page (Beta 2)
// =============================================================================
// Endpoint pesante che restituisce in un'unica request tutto cio' che serve
// per renderizzare profile.html: user + org profile + prefs + stats.
//
// Sostituisce il legacy API.getLibraryData (localStorage).
// Route:
//   GET /api/users/:id/library  → aggregato pubblico
//   GET /api/libraries          → librerie ordinate per vicinanza e attivita'
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
            libraryRole: true,
            lat: true,
            lng: true,
            locationPrecision: true,
            publicCity: true,
            publicLat: true,
            publicLng: true,
            role: true,
            status: true,
            createdAt: true,
          },
        }),
        fastify.prisma.organizationProfile.findUnique({ where: { userId: id } }),
        fastify.prisma.userPreference.findUnique({ where: { userId: id } }),
        fastify.prisma.book.count({ where: { ownerId: id, status: 'active' } }),
        fastify.prisma.book.count({ where: { ownerId: id, status: 'active', available: true } }),
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
              // Follow ha chiave composta (followerId, followedId): niente id
              select: { followerId: true },
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

      // Il proprietario vede la propria posizione reale; gli altri quella
      // pubblica, secondo la privacy scelta
      const isOwner = currentUserId === id;
      const dtoUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        accountType: user.accountType,
        bio: user.bio,
        city: isOwner ? user.city : user.publicCity,
        avatarUrl: user.avatarUrl,
        libraryRole: user.libraryRole,
        lat: isOwner ? user.lat : user.publicLat,
        lng: isOwner ? user.lng : user.publicLng,
        ...(isOwner ? { locationPrecision: user.locationPrecision } : {}),
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

  // ===========================================================================
  // GET /api/libraries — "Librerie vicino a te"
  // ===========================================================================
  // Librerie con almeno un volume, ordinate per un punteggio di vicinanza e
  // attivita' (stessa formula della versione prototipo):
  //   attivita' = volumi disponibili x 2 + bonus pubblicazione recente
  //               (max(0, 60 - giorni dall'ultimo volume) / 10)
  //   punteggio = distanza in km - attivita' x 0,4   (piu' basso = prima)
  // La distanza usa solo la posizione pubblica (privacy della posizione).
  // Senza lat/lng, o per librerie senza posizione pubblica, conta solo
  // l'attivita' (queste ultime seguono quelle con distanza).
  fastify.get(
    '/api/libraries',
    {
      schema: {
        tags: ['Users'],
        summary: "Librerie ordinate per vicinanza e attivita'",
        querystring: {
          type: 'object',
          properties: {
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 24 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { lat, lng, limit } = request.query;
      if ((lat == null) !== (lng == null)) {
        return reply.status(400).send({
          error: { code: 'INVALID_LOCATION', message: 'Indicare sia lat sia lng' },
        });
      }
      const currentUserId = await getCurrentUserId(request);
      const hasPoint = lat != null;

      const rows = await fastify.prisma.$queryRaw`
        SELECT
          u.id, u.username, u.display_name AS "displayName",
          u.account_type AS "accountType", u.public_city AS "city",
          u.bio, u.created_at AS "createdAt",
          op.org_category AS "orgCategory",
          p.theme, p.avatar_style AS "avatarStyle", p.avatar_symbol AS "avatarSymbol",
          p.cover_design AS "coverDesign", p.motto,
          COUNT(b.id)::int AS "booksCount",
          (COUNT(b.id) FILTER (WHERE b.available))::int AS "availableCount",
          COALESCE(SUM(b.view_count), 0)::int AS "totalViews",
          MAX(b.created_at) AS "lastAddedAt",
          (SELECT COUNT(*) FROM reviews r WHERE r.target_user_id = u.id)::int AS "reviewsCount",
          (SELECT AVG(r.rating) FROM reviews r WHERE r.target_user_id = u.id)::float AS "avgRating",
          CASE
            WHEN ${hasPoint} AND u.public_location IS NOT NULL THEN
              ST_Distance(
                u.public_location,
                ST_SetSRID(ST_MakePoint(${lng ?? 0}, ${lat ?? 0}), 4326)::geography
              ) / 1000.0
          END AS "distanceKm"
        FROM users u
        JOIN books b ON b.owner_id = u.id AND b.status = 'active'
        LEFT JOIN organization_profiles op ON op.user_id = u.id
        LEFT JOIN user_preferences p ON p.user_id = u.id
        WHERE u.status = 'active'
          AND u.role <> 'admin'
          AND u.id <> ${currentUserId ?? ''}
        GROUP BY u.id, op.org_category, p.theme, p.avatar_style, p.avatar_symbol,
                 p.cover_design, p.motto`;

      const now = Date.now();
      const libraries = rows.map((r) => {
        const lastDays = r.lastAddedAt
          ? Math.floor((now - new Date(r.lastAddedAt).getTime()) / 86_400_000)
          : null;
        const recencyBonus = lastDays !== null ? Math.max(0, 60 - lastDays) / 10 : 0;
        const activityIndex = r.availableCount * 2 + recencyBonus;
        const distanceKm = r.distanceKm == null ? null : Math.round(r.distanceKm * 100) / 100;
        return {
          ...r,
          distanceKm,
          lastAddedDays: lastDays,
          activityIndex: Math.round(activityIndex * 10) / 10,
          rankScore:
            distanceKm == null ? null : Math.round((distanceKm - activityIndex * 0.4) * 100) / 100,
        };
      });

      // Prima chi ha una distanza (per punteggio), poi gli altri per attivita'
      libraries.sort((a, b) => {
        if ((a.rankScore == null) !== (b.rankScore == null)) return a.rankScore == null ? 1 : -1;
        if (a.rankScore != null) return a.rankScore - b.rankScore;
        return b.activityIndex - a.activityIndex;
      });

      return {
        reference: hasPoint ? { lat, lng } : null,
        data: libraries.slice(0, limit),
      };
    }
  );
}
