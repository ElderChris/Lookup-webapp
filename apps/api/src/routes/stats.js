// =============================================================================
// src/routes/stats.js
// =============================================================================
// Endpoint statistici/aggregati per la home page e dashboard editoriali.
//
//   GET /api/stats/featured            Top 10 libri trend (7gg, diversity penalty)
//   GET /api/stats/ridgeline           Top 10 utenti x 8 settimane di attivita'
//   GET /api/stats/top-users           Top 20 utenti multi-metrica
//   GET /api/stats/bisac-cooccurrence  Matrice sparse coppie di categorie
//
// Tutti i dati sono pubblici (no auth). Nessuna cache lato server: se le
// aggregazioni piu' costose (featured, ridgeline) diventassero lente, si puo'
// aggiungere una cache Redis con TTL di 5-15 minuti.
// =============================================================================

// -----------------------------------------------------------------------------
// Helpers
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
 * Restituisce la data di inizio settimana ISO (lunedi 00:00 UTC).
 */
function startOfIsoWeek(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay() || 7; // dom=7
  if (day !== 1) d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

/**
 * Formatta una data come "2026-W22" (anno + ISO week number).
 */
function isoWeekLabel(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// -----------------------------------------------------------------------------
// Plugin Fastify
// -----------------------------------------------------------------------------

export default async function statsRoutes(fastify) {
  // ===========================================================================
  // GET /api/stats/featured
  // ===========================================================================
  // Top 10 libri "in tendenza" calcolati come:
  //   score = recency_weight(loan) * loanCount_7d
  //         + 0.5 * likeCount_7d
  //         + 0.2 * viewCount_total
  //
  // Diversity penalty: dopo aver scelto un libro, i successivi della stessa
  // categoria primaria ricevono -30% al score. Garantisce variety nella lista.
  fastify.get(
    '/api/stats/featured',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
            days: { type: 'integer', minimum: 1, maximum: 90, default: 7 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const { limit, days } = request.query;
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      // Carica tutti i libri attivi con counts aggregati dalle relazioni
      // del periodo recente. Query Prisma con groupBy + lookup.
      const books = await fastify.prisma.book.findMany({
        where: { status: 'active', owner: { status: 'active' } },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              publicCity: true,
              accountType: true,
              avatarUrl: true,
            },
          },
          categories: {
            where: { isPrimary: true },
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
        },
      });

      // Aggrega in batch i count recenti (un Promise.all per evitare N+1)
      const bookIds = books.map((b) => b.id);
      const [loansAgg, likesAgg] = await Promise.all([
        fastify.prisma.loanRequest.groupBy({
          by: ['bookId'],
          where: { bookId: { in: bookIds }, requestedAt: { gte: since } },
          _count: { _all: true },
        }),
        fastify.prisma.like.groupBy({
          by: ['bookId'],
          where: { bookId: { in: bookIds }, createdAt: { gte: since } },
          _count: { _all: true },
        }),
      ]);

      const loanMap = Object.fromEntries(loansAgg.map((r) => [r.bookId, r._count._all]));
      const likeMap = Object.fromEntries(likesAgg.map((r) => [r.bookId, r._count._all]));

      // Calcola score raw per ogni libro
      const scored = books.map((b) => {
        const loanCount = loanMap[b.id] || 0;
        const likeCount = likeMap[b.id] || 0;
        const primaryCategoryId = b.categories[0]?.categoryId ?? null;
        const primaryCategoryName = b.categories[0]?.category?.name ?? null;

        // Recency weight: 1.5 se ha avuto loan recenti, 1.0 altrimenti
        const recencyWeight = loanCount > 0 ? 1.5 : 1.0;
        const rawScore = recencyWeight * loanCount + 0.5 * likeCount + 0.2 * b.viewCount;

        return {
          book: b,
          primaryCategoryId,
          primaryCategoryName,
          loanCount,
          likeCount,
          viewCount: b.viewCount,
          rawScore,
        };
      });

      // Ordina per score e applica diversity penalty
      scored.sort((a, b) => b.rawScore - a.rawScore);

      const selected = [];
      const categoryUsage = {}; // category id -> count
      for (const candidate of scored) {
        if (selected.length >= limit) break;
        const catUsage = categoryUsage[candidate.primaryCategoryId] || 0;
        const penalty = Math.pow(0.7, catUsage); // -30% per volta che la categoria appare
        candidate.finalScore = candidate.rawScore * penalty;
        selected.push(candidate);
        if (candidate.primaryCategoryId != null) {
          categoryUsage[candidate.primaryCategoryId] = catUsage + 1;
        }
      }

      // Riordina per finalScore decrescente (dopo penalty)
      selected.sort((a, b) => b.finalScore - a.finalScore);

      return {
        windowDays: days,
        data: selected.map((s) => ({
          id: s.book.id,
          title: s.book.title,
          author: s.book.author,
          coverUrl: s.book.coverUrl,
          available: s.book.available,
          owner: userSummaryDto(s.book.owner),
          primaryCategory: s.primaryCategoryId
            ? { id: s.primaryCategoryId, name: s.primaryCategoryName }
            : null,
          metrics: {
            loanCount: s.loanCount,
            likeCount: s.likeCount,
            viewCount: s.viewCount,
            score: Math.round(s.finalScore * 100) / 100,
          },
        })),
      };
    }
  );

  // ===========================================================================
  // GET /api/stats/ridgeline
  // ===========================================================================
  // Top N utenti (default 10) per attivita' totale, ognuno con un breakdown
  // a settimane (default 8). Pensato per il chart ridgeline d3 in dashboard.
  //
  // Attivita' = post creati + loan-request inviati + recensioni scritte.
  fastify.get(
    '/api/stats/ridgeline',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            users: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
            weeks: { type: 'integer', minimum: 1, maximum: 26, default: 8 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const { users: nUsers, weeks: nWeeks } = request.query;
      const startWeek = startOfIsoWeek(new Date());
      startWeek.setUTCDate(startWeek.getUTCDate() - 7 * (nWeeks - 1));

      // Query aggregata cross-table via raw SQL (piu' performante di N queries Prisma)
      const rows = await fastify.prisma.$queryRawUnsafe(
        `
        WITH activity AS (
          SELECT author_id AS user_id, created_at AS at FROM posts WHERE created_at >= $1 AND status = 'active'
          UNION ALL
          SELECT requester_id, requested_at FROM loan_requests WHERE requested_at >= $1
          UNION ALL
          SELECT reviewer_id, created_at FROM reviews WHERE created_at >= $1
        ),
        weekly AS (
          SELECT
            user_id,
            DATE_TRUNC('week', at)::date AS week_start,
            COUNT(*)::int AS events
          FROM activity
          GROUP BY user_id, DATE_TRUNC('week', at)
        ),
        top_users AS (
          SELECT user_id, SUM(events)::int AS total
          FROM weekly
          GROUP BY user_id
          ORDER BY total DESC
          LIMIT $2
        )
        SELECT
          w.user_id AS "userId",
          w.week_start AS "weekStart",
          w.events,
          tu.total AS "userTotal",
          u.display_name AS "displayName",
          u.username,
          u.account_type AS "accountType",
          u.avatar_url AS "avatarUrl"
        FROM weekly w
        JOIN top_users tu ON tu.user_id = w.user_id
        JOIN users u ON u.id = w.user_id
        ORDER BY tu.total DESC, w.user_id, w.week_start;
      `,
        startWeek,
        nUsers
      );

      // Riorganizza in struttura [{userId, ... , weeks: [{week: label, count}]}]
      const byUser = new Map();
      for (const r of rows) {
        const key = r.userId;
        if (!byUser.has(key)) {
          byUser.set(key, {
            userId: key,
            username: r.username,
            displayName: r.displayName,
            accountType: r.accountType,
            avatarUrl: r.avatarUrl,
            total: Number(r.userTotal),
            weeksMap: new Map(),
          });
        }
        byUser.get(key).weeksMap.set(isoWeekLabel(r.weekStart), Number(r.events));
      }

      // Riempi le settimane mancanti con 0 per avere righe complete
      const weekLabels = [];
      for (let i = 0; i < nWeeks; i++) {
        const d = new Date(startWeek);
        d.setUTCDate(d.getUTCDate() + i * 7);
        weekLabels.push(isoWeekLabel(d));
      }

      const data = [...byUser.values()]
        .sort((a, b) => b.total - a.total)
        .map((u) => ({
          userId: u.userId,
          username: u.username,
          displayName: u.displayName,
          accountType: u.accountType,
          avatarUrl: u.avatarUrl,
          total: u.total,
          weeks: weekLabels.map((label) => ({ week: label, count: u.weeksMap.get(label) || 0 })),
        }));

      return {
        weekLabels,
        windowWeeks: nWeeks,
        data,
      };
    }
  );

  // ===========================================================================
  // GET /api/stats/top-users
  // ===========================================================================
  // Top N utenti per score composito multi-metrica:
  //   loan_score    = peso 1.0 * tot prestiti (sent + received)
  //   review_score  = peso 0.8 * tot recensioni scritte
  //   post_score    = peso 0.5 * tot post pubblicati
  //   rating_bonus  = peso 2.0 * avgRating ricevuto (0-5)
  //
  // Tutti gli score normalizzati 0-1 sul max della metrica, poi sommati.
  fastify.get(
    '/api/stats/top-users',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const { limit } = request.query;

      // Query aggregata via raw SQL
      const rows = await fastify.prisma.$queryRawUnsafe(`
        WITH user_metrics AS (
          SELECT
            u.id,
            u.username,
            u.display_name,
            u.public_city AS city,
            u.account_type,
            u.avatar_url,
            (
              SELECT COUNT(*) FROM loan_requests lr
              WHERE lr.requester_id = u.id OR lr.lender_id = u.id
            )::int AS loan_count,
            (SELECT COUNT(*) FROM reviews r WHERE r.reviewer_id = u.id)::int AS review_count,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status = 'active')::int AS post_count,
            COALESCE(
              (SELECT AVG(rating)::float FROM reviews WHERE target_user_id = u.id),
              0
            ) AS avg_rating
          FROM users u
          WHERE u.status = 'active'
        )
        SELECT * FROM user_metrics
        WHERE loan_count + review_count + post_count + (avg_rating::int) > 0
      `);

      // Normalizza ogni metrica sul max
      const maxLoan = Math.max(1, ...rows.map((r) => r.loan_count));
      const maxReview = Math.max(1, ...rows.map((r) => r.review_count));
      const maxPost = Math.max(1, ...rows.map((r) => r.post_count));

      const scored = rows.map((r) => {
        const loanScore = (r.loan_count / maxLoan) * 1.0;
        const reviewScore = (r.review_count / maxReview) * 0.8;
        const postScore = (r.post_count / maxPost) * 0.5;
        const ratingBonus = (r.avg_rating / 5) * 2.0;
        const totalScore = loanScore + reviewScore + postScore + ratingBonus;

        return {
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          city: r.city,
          accountType: r.account_type,
          avatarUrl: r.avatar_url,
          metrics: {
            loanCount: r.loan_count,
            reviewCount: r.review_count,
            postCount: r.post_count,
            avgRating: Math.round(r.avg_rating * 10) / 10,
            score: Math.round(totalScore * 100) / 100,
          },
        };
      });

      scored.sort((a, b) => b.metrics.score - a.metrics.score);
      return { data: scored.slice(0, limit) };
    }
  );

  // ===========================================================================
  // GET /api/stats/bisac-cooccurrence
  // ===========================================================================
  // Matrice sparse di coppie di categorie BISAC che appaiono spesso insieme
  // sullo stesso libro. Utile per chart heatmap o sankey per esplorare
  // affinita' tematiche (es. "Filosofia" co-occorre spesso con "Storia").
  //
  // Output: array di {a: {id, name}, b: {id, name}, count} ordinato per count desc.
  fastify.get(
    '/api/stats/bisac-cooccurrence',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            minCount: { type: 'integer', minimum: 1, maximum: 100, default: 2 },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const { minCount, limit } = request.query;

      // Self-join su book_categories per generare coppie (a < b) sullo stesso libro
      const rows = await fastify.prisma.$queryRawUnsafe(
        `
        SELECT
          LEAST(bc1.category_id, bc2.category_id) AS a_id,
          GREATEST(bc1.category_id, bc2.category_id) AS b_id,
          ca.name AS a_name,
          cb.name AS b_name,
          COUNT(*)::int AS cnt
        FROM book_categories bc1
        JOIN book_categories bc2 ON bc1.book_id = bc2.book_id AND bc1.category_id < bc2.category_id
        JOIN categories ca ON ca.id = LEAST(bc1.category_id, bc2.category_id)
        JOIN categories cb ON cb.id = GREATEST(bc1.category_id, bc2.category_id)
        GROUP BY a_id, b_id, ca.name, cb.name
        HAVING COUNT(*) >= $1
        ORDER BY cnt DESC, a_id, b_id
        LIMIT $2
      `,
        minCount,
        limit
      );

      return {
        minCount,
        data: rows.map((r) => ({
          a: { id: Number(r.a_id), name: r.a_name },
          b: { id: Number(r.b_id), name: r.b_name },
          count: r.cnt,
        })),
      };
    }
  );

  // ===========================================================================
  // GET /api/stats/global — Aggregato "quanti X ci sono"
  // ===========================================================================
  // Query O(N) leggere. Usate da admin.html per KPI + landing/pubbliche.
  fastify.get(
    '/api/stats/global',
    {
      schema: {
        tags: ['Stats'],
        summary: 'Statistiche aggregate globali (utenti/libri/prestiti/...)',
      },
    },
    async () => {
      // 8 count paralleli — tutti indicizzati, veloci
      const [
        totalUsers,
        usersPerson,
        usersOrg,
        usersActive,
        usersPending,
        usersSuspended,
        usersDeleted,
        totalBooks,
        booksAvailable,
        totalPosts,
        totalReviews,
        totalFollows,
        totalLikes,
        loanCountsRaw,
        publicRaw,
      ] = await Promise.all([
        fastify.prisma.user.count(),
        fastify.prisma.user.count({ where: { accountType: 'person' } }),
        fastify.prisma.user.count({ where: { accountType: 'organization' } }),
        fastify.prisma.user.count({ where: { status: 'active' } }),
        fastify.prisma.user.count({ where: { status: 'pending' } }),
        fastify.prisma.user.count({ where: { status: 'suspended' } }),
        fastify.prisma.user.count({ where: { status: 'deleted' } }),
        fastify.prisma.book.count(),
        fastify.prisma.book.count({ where: { available: true } }),
        fastify.prisma.post.count(),
        fastify.prisma.review.count(),
        fastify.prisma.follow.count(),
        fastify.prisma.like.count(),
        fastify.prisma.$queryRawUnsafe(`
          SELECT status, COUNT(*)::int AS cnt FROM loan_requests GROUP BY status
        `),
        // Contatori pubblici della home: solo volumi attivi e utenti attivi
        fastify.prisma.$queryRawUnsafe(`
          SELECT
            (SELECT COUNT(*) FROM books WHERE status = 'active' AND owner_id IN (SELECT id FROM users WHERE status = 'active'))::int AS books,
            (SELECT COUNT(*) FROM users WHERE status = 'active' AND role <> 'admin')::int AS readers,
            (SELECT COUNT(DISTINCT bc.category_id) FROM book_categories bc
               JOIN books b ON b.id = bc.book_id AND b.status = 'active' AND b.owner_id IN (SELECT id FROM users WHERE status = 'active'))::int AS categories,
            (SELECT COALESCE(SUM(view_count), 0) FROM books WHERE status = 'active' AND owner_id IN (SELECT id FROM users WHERE status = 'active'))::int AS views
        `),
      ]);

      const loansByStatus = {};
      let totalLoans = 0;
      for (const r of loanCountsRaw) {
        loansByStatus[r.status] = r.cnt;
        totalLoans += r.cnt;
      }

      return {
        totalUsers,
        usersByType: { person: usersPerson, organization: usersOrg },
        usersByStatus: {
          active: usersActive,
          pending: usersPending,
          suspended: usersSuspended,
          deleted: usersDeleted,
        },
        totalBooks,
        booksAvailable,
        totalLoans,
        loansByStatus,
        totalPosts,
        totalReviews,
        totalFollows,
        totalLikes,
        // Per i contatori della home
        publicCounters: publicRaw[0],
      };
    }
  );

  // ===========================================================================
  // GET /api/stats/activity-timeline — Serie temporale eventi
  // ===========================================================================
  // Aggregato giornaliero di eventi (signup, book add, loan, post, review)
  // sugli ultimi N giorni. Usato per il grafico "attivita' recente" in admin.
  fastify.get(
    '/api/stats/activity-timeline',
    {
      schema: {
        tags: ['Stats'],
        summary: 'Timeline attivita' + ' recente (aggregato giornaliero)',
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 90, default: 30 },
          },
        },
      },
    },
    async (request) => {
      const { days = 30 } = request.query;
      const now = new Date();
      const to = new Date(now);
      to.setUTCHours(23, 59, 59, 999);
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - (days - 1));
      from.setUTCHours(0, 0, 0, 0);

      // 5 aggregation queries paralleli usando DATE_TRUNC('day')
      const [signups, books, loans, posts, reviews] = await Promise.all([
        fastify.prisma.$queryRawUnsafe(
          `
          SELECT to_char(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS cnt
          FROM users WHERE created_at >= $1 AND created_at <= $2 GROUP BY d
        `,
          from,
          to
        ),
        fastify.prisma.$queryRawUnsafe(
          `
          SELECT to_char(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS cnt
          FROM books WHERE created_at >= $1 AND created_at <= $2 GROUP BY d
        `,
          from,
          to
        ),
        fastify.prisma.$queryRawUnsafe(
          `
          SELECT to_char(DATE_TRUNC('day', requested_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS cnt
          FROM loan_requests WHERE requested_at >= $1 AND requested_at <= $2 GROUP BY d
        `,
          from,
          to
        ),
        fastify.prisma.$queryRawUnsafe(
          `
          SELECT to_char(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS cnt
          FROM posts WHERE created_at >= $1 AND created_at <= $2 GROUP BY d
        `,
          from,
          to
        ),
        fastify.prisma.$queryRawUnsafe(
          `
          SELECT to_char(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS cnt
          FROM reviews WHERE created_at >= $1 AND created_at <= $2 GROUP BY d
        `,
          from,
          to
        ),
      ]);

      // Costruisci una mappa d -> {signups, books, loans, posts, reviews}
      const bucket = new Map();
      const fill = (rows, key) => {
        for (const r of rows) {
          if (!bucket.has(r.d))
            bucket.set(r.d, { date: r.d, signups: 0, books: 0, loans: 0, posts: 0, reviews: 0 });
          bucket.get(r.d)[key] = r.cnt;
        }
      };
      fill(signups, 'signups');
      fill(books, 'books');
      fill(loans, 'loans');
      fill(posts, 'posts');
      fill(reviews, 'reviews');

      // Riempi anche i giorni "vuoti" con zeri, per un grafico continuo
      const series = [];
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        series.push(
          bucket.get(key) || { date: key, signups: 0, books: 0, loans: 0, posts: 0, reviews: 0 }
        );
      }

      return {
        days,
        from: from.toISOString(),
        to: to.toISOString(),
        series,
      };
    }
  );

  // ===========================================================================
  // GET /api/books/:id/timeline — Timeline attivita' su un singolo libro
  // ===========================================================================
  // views + likes + loan_requests giornalieri per un libro specifico.
  // Nota: registrato in stats.js perche' e' un'aggregazione stats-like,
  // ma il path e' /api/books/:id/timeline per coerenza semantica.
  fastify.get(
    '/api/books/:id/timeline',
    {
      schema: {
        tags: ['Stats'],
        summary: 'Timeline attivita' + ' su un singolo libro (views/likes/loans)',
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 90, default: 30 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { days = 30 } = request.query;
      const book = await fastify.prisma.book.findUnique({ where: { id }, select: { id: true } });
      if (!book)
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Libro non trovato' } });

      const now = new Date();
      const to = new Date(now);
      to.setUTCHours(23, 59, 59, 999);
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - (days - 1));
      from.setUTCHours(0, 0, 0, 0);

      // Visualizzazioni dal conteggio giornaliero anonimo (book_view_days,
      // dal 22 nov 2026), mi piace e richieste di prestito per giorno
      const [views, likes, loans] = await Promise.all([
        fastify.prisma.$queryRawUnsafe(
          `
          SELECT to_char(day, 'YYYY-MM-DD') AS d, SUM(count)::int AS cnt
          FROM book_view_days WHERE book_id = $1 AND day >= $2::date AND day <= $3::date GROUP BY d
        `,
          id,
          from,
          to
        ),
        fastify.prisma.$queryRawUnsafe(
          `
          SELECT to_char(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS cnt
          FROM book_likes WHERE book_id = $1 AND created_at >= $2 AND created_at <= $3 GROUP BY d
        `,
          id,
          from,
          to
        ),
        fastify.prisma.$queryRawUnsafe(
          `
          SELECT to_char(DATE_TRUNC('day', requested_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS cnt
          FROM loan_requests WHERE book_id = $1 AND requested_at >= $2 AND requested_at <= $3 GROUP BY d
        `,
          id,
          from,
          to
        ),
      ]);

      const bucket = new Map();
      const fill = (rows, key) => {
        for (const r of rows) {
          if (!bucket.has(r.d)) bucket.set(r.d, { date: r.d, views: 0, likes: 0, loanRequests: 0 });
          bucket.get(r.d)[key] = r.cnt;
        }
      };
      fill(views, 'views');
      fill(likes, 'likes');
      fill(loans, 'loanRequests');

      const series = [];
      let totalViews = 0,
        totalLikes = 0,
        totalLoans = 0;
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        const point = bucket.get(key) || { date: key, views: 0, likes: 0, loanRequests: 0 };
        series.push(point);
        totalViews += point.views;
        totalLikes += point.likes;
        totalLoans += point.loanRequests;
      }

      return {
        bookId: id,
        windowDays: days,
        series,
        totals: {
          views: totalViews,
          likes: totalLikes,
          loanRequests: totalLoans,
        },
      };
    }
  );

  // ===========================================================================
  // GET /api/stats/overview — Dati della pagina Statistiche (pubblico)
  // ===========================================================================
  // Un'unica risposta calcolata dal database, al posto di molte chiamate con i
  // conti nel browser: indicatori, attivita' per settimana (12), generi per
  // macro-area con sottogeneri, intersezioni fra macro-aree, libri piu'
  // richiesti con andamento mensile (12 mesi), classifiche degli utenti.
  fastify.get(
    '/api/stats/overview',
    {
      schema: {
        tags: ['Stats'],
        summary: 'Statistiche aggregate della piattaforma',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const { limit } = request.query;
      const q = (sql, ...params) => fastify.prisma.$queryRawUnsafe(sql, ...params);

      const [kpiRows, activity, macroRows, childRows, coRows, macros, users] = await Promise.all([
        q(`
          SELECT
            (SELECT COUNT(*) FROM books WHERE status = 'active' AND owner_id IN (SELECT id FROM users WHERE status = 'active'))::int AS "totalBooks",
            (SELECT COUNT(*) FROM users WHERE status = 'active' AND role <> 'admin')::int AS "totalUsers",
            (SELECT COUNT(*) FROM users WHERE status = 'active' AND role <> 'admin'
               AND library_role = 'curator')::int AS "curatorsCount",
            (SELECT COUNT(*) FROM users WHERE status = 'active' AND role <> 'admin'
               AND library_role = 'borrower')::int AS "borrowersCount",
            (SELECT COUNT(*) FROM loan_requests)::int AS "totalLoans",
            (SELECT COUNT(*) FROM loan_requests WHERE status = 'returned')::int AS "completedLoans",
            (SELECT COUNT(*) FROM loan_requests
               WHERE status IN ('requested','confirmed','borrowed','returning'))::int AS "activeLoans",
            (SELECT COUNT(*) FROM reviews)::int AS "totalReviews",
            (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews)::float AS "avgRating",
            (SELECT COUNT(*) FROM loan_messages)::int AS "totalMessages",
            (SELECT COUNT(*) FROM notifications)::int AS "totalNotifications",
            (SELECT COALESCE(SUM(view_count), 0) FROM books WHERE status = 'active' AND owner_id IN (SELECT id FROM users WHERE status = 'active'))::int AS "totalViews"
        `),
        // 12 settimane (da lunedi'), la corrente compresa
        q(`
          WITH weeks AS (
            SELECT generate_series(
              date_trunc('week', now()) - interval '11 weeks',
              date_trunc('week', now()),
              interval '1 week'
            ) AS w
          )
          SELECT w AS "weekStart",
            (SELECT COUNT(*) FROM books b WHERE b.status = 'active' AND b.owner_id IN (SELECT id FROM users WHERE status = 'active')
               AND b.created_at >= w AND b.created_at < w + interval '1 week')::int AS books,
            (SELECT COUNT(*) FROM loan_requests l
               WHERE l.requested_at >= w AND l.requested_at < w + interval '1 week')::int AS loans,
            (SELECT COUNT(*) FROM reviews r
               WHERE r.created_at >= w AND r.created_at < w + interval '1 week')::int AS reviews,
            (SELECT COUNT(*) FROM loan_messages m
               WHERE m.created_at >= w AND m.created_at < w + interval '1 week')::int AS messages
          FROM weeks ORDER BY w
        `),
        // Libri per macro-area (un libro conta una volta per macro-area)
        q(`
          WITH bc AS (
            SELECT DISTINCT b.id AS book_id, c.id AS cat_id, COALESCE(c.parent_id, c.id) AS macro_id
            FROM books b
            JOIN book_categories x ON x.book_id = b.id
            JOIN categories c ON c.id = x.category_id
            WHERE b.status = 'active' AND b.owner_id IN (SELECT id FROM users WHERE status = 'active')
          )
          SELECT m.name, COUNT(DISTINCT bc.book_id)::int AS count
          FROM bc JOIN categories m ON m.id = bc.macro_id
          GROUP BY m.name ORDER BY count DESC, m.name
        `),
        // Sottogeneri con almeno un libro
        q(`
          SELECT m.name AS macro, c.name, COUNT(DISTINCT b.id)::int AS count
          FROM books b
          JOIN book_categories x ON x.book_id = b.id
          JOIN categories c ON c.id = x.category_id AND c.parent_id IS NOT NULL
          JOIN categories m ON m.id = c.parent_id
          WHERE b.status = 'active' AND b.owner_id IN (SELECT id FROM users WHERE status = 'active')
          GROUP BY m.name, c.name ORDER BY count DESC, c.name
        `),
        // Intersezioni fra macro-aree nello stesso libro (diagonale: totale)
        q(`
          WITH bm AS (
            SELECT DISTINCT b.id AS book_id, COALESCE(c.parent_id, c.id) AS macro_id
            FROM books b
            JOIN book_categories x ON x.book_id = b.id
            JOIN categories c ON c.id = x.category_id
            WHERE b.status = 'active' AND b.owner_id IN (SELECT id FROM users WHERE status = 'active')
          )
          SELECT ma.name AS a, mb.name AS b, COUNT(*)::int AS count
          FROM bm a1 JOIN bm b1 ON a1.book_id = b1.book_id
          JOIN categories ma ON ma.id = a1.macro_id
          JOIN categories mb ON mb.id = b1.macro_id
          GROUP BY ma.name, mb.name
        `),
        q(`SELECT name FROM categories WHERE parent_id IS NULL ORDER BY sort_order, name`),
        // Utenti attivi con le metriche delle classifiche
        q(`
          SELECT u.id, u.display_name AS name, u.username, u.public_city AS city,
            (SELECT COUNT(*) FROM books b WHERE b.owner_id = u.id AND b.status = 'active' AND b.owner_id IN (SELECT id FROM users WHERE status = 'active'))::int AS "booksCount",
            (SELECT COUNT(*) FROM loan_requests l WHERE l.status = 'returned'
               AND (l.requester_id = u.id OR l.lender_id = u.id))::int AS "completedLoans",
            (SELECT COUNT(*) FROM reviews r WHERE r.reviewer_id = u.id)::int AS "reviewsWritten",
            (SELECT COUNT(*) FROM user_follows f WHERE f.followed_id = u.id)::int AS followers
          FROM users u
          WHERE u.status = 'active' AND u.role <> 'admin'
        `),
      ]);

      // --- Indicatori ---
      const k = kpiRows[0];
      const kpi = {
        ...k,
        avgViewsPerBook: k.totalBooks ? Math.round(k.totalViews / k.totalBooks) : 0,
      };

      // --- Generi: macro-aree con i sottogeneri ---
      const childrenByMacro = new Map();
      for (const r of childRows) {
        if (!childrenByMacro.has(r.macro)) childrenByMacro.set(r.macro, []);
        childrenByMacro.get(r.macro).push({ name: r.name, count: r.count });
      }
      const hierarchy = macroRows.map((m) => ({
        name: m.name,
        count: m.count,
        children: childrenByMacro.get(m.name) || [],
      }));

      // --- Intersezioni: matrice completa sulle macro-aree ---
      const macroNames = macros.map((m) => m.name);
      const matrix = {};
      for (const a of macroNames) {
        matrix[a] = {};
        for (const b of macroNames) matrix[a][b] = 0;
      }
      for (const r of coRows) if (matrix[r.a]) matrix[r.a][r.b] = r.count;

      // --- Libri piu' richiesti: interazioni (prestiti + mi piace) degli
      //     ultimi 12 mesi, poi visualizzazioni ---
      const top = await q(
        `
        SELECT b.id, b.title, b.author, b.year, b.view_count AS views, b.created_at AS "createdAt",
          ((SELECT COUNT(*) FROM loan_requests l WHERE l.book_id = b.id
              AND l.requested_at >= date_trunc('month', now()) - interval '11 months')
           + (SELECT COUNT(*) FROM book_likes k WHERE k.book_id = b.id
              AND k.created_at >= date_trunc('month', now()) - interval '11 months'))::int
            AS "totalInteractions",
          (SELECT COUNT(*) FROM loan_requests l WHERE l.book_id = b.id)::int AS "totalLoans",
          (SELECT COUNT(*) FROM loan_requests l WHERE l.book_id = b.id
             AND l.status = 'returned')::int AS "completedLoans",
          (SELECT COUNT(*) FROM loan_requests l WHERE l.book_id = b.id
             AND l.status IN ('requested','confirmed','borrowed','returning'))::int AS "activeLoans",
          (SELECT COUNT(*) FROM book_likes k WHERE k.book_id = b.id)::int AS "totalLikes"
        FROM books b
        WHERE b.status = 'active' AND b.owner_id IN (SELECT id FROM users WHERE status = 'active')
        ORDER BY "totalInteractions" DESC, b.view_count DESC, b.id
        LIMIT $1
      `,
        limit
      );
      const ids = top.map((b) => b.id);
      const monthly = ids.length
        ? await q(
            `
            WITH months AS (
              SELECT generate_series(
                date_trunc('month', now()) - interval '11 months',
                date_trunc('month', now()),
                interval '1 month'
              ) AS m
            ), ids AS (SELECT unnest($1::int[]) AS id)
            SELECT ids.id AS "bookId", months.m AS month,
              (SELECT COUNT(*) FROM loan_requests l WHERE l.book_id = ids.id
                 AND l.requested_at >= months.m AND l.requested_at < months.m + interval '1 month')::int AS loans,
              (SELECT COUNT(*) FROM book_likes k WHERE k.book_id = ids.id
                 AND k.created_at >= months.m AND k.created_at < months.m + interval '1 month')::int AS likes,
              (SELECT COALESCE(SUM(v.count), 0) FROM book_view_days v WHERE v.book_id = ids.id
                 AND v.day >= months.m::date AND v.day < (months.m + interval '1 month')::date)::int AS views
            FROM ids CROSS JOIN months
            ORDER BY ids.id, months.m
          `,
            ids
          )
        : [];
      const months = [...new Set(monthly.map((r) => new Date(r.month).toISOString()))];
      const series = new Map();
      for (const r of monthly) {
        if (!series.has(r.bookId)) series.set(r.bookId, { views: [], loans: [], likes: [] });
        const sr = series.get(r.bookId);
        sr.views.push(r.views);
        sr.loans.push(r.loans);
        sr.likes.push(r.likes);
      }
      const topBooks = top.map((b) => ({
        ...b,
        monthly: series.get(b.id) || { views: [], loans: [], likes: [] },
      }));

      // --- Classifiche utenti ---
      const scored = users.map((u) => ({
        ...u,
        score: u.completedLoans * 3 + u.reviewsWritten * 2 + u.booksCount + u.followers,
      }));
      const by = (key) =>
        [...scored]
          .sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name, 'it'))
          .slice(0, limit);

      return {
        kpi,
        activity,
        hierarchy,
        cooccurrence: { macros: macroNames, matrix },
        months,
        topBooks,
        topUsers: {
          byScore: by('score'),
          byLoans: by('completedLoans'),
          byReviews: by('reviewsWritten'),
          byBooks: by('booksCount'),
          byFollowers: by('followers'),
        },
      };
    }
  );
}
