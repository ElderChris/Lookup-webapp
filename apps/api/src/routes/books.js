// =============================================================================
// src/routes/books.js
// =============================================================================
// Endpoint REST per la gestione dei libri.
//
//   GET    /api/books           Lista con filtri + paginazione (liked/following: utente)
//   GET    /api/books/:id       Dettaglio singolo
//   POST   /api/books           Crea (richiede auth)
//   PATCH  /api/books/:id       Modifica (owner only)
//   DELETE /api/books/:id       Cancella (owner only)
//   POST   /api/books/:id/views Incrementa view (debounce 60s via Redis)
//
// Validazione: JSON Schema nativo di Fastify (verra' migrato a Zod in 1g).
// Auth: sessione Better Auth (cookie), vedi lib/authHelpers.js.
// =============================================================================

import { getCurrentUserId, requireUserId, requireOwner } from '../lib/authHelpers.js';

// -----------------------------------------------------------------------------
// Helper: trasforma il record Prisma "raw" nel DTO che esponiamo via API
// -----------------------------------------------------------------------------

function toDto(book) {
  // Prisma ritorna `categories` come array di BookCategory con `category` nested.
  // Lo appiattiamo in [{id, name, slug, isPrimary}]
  const categories = (book.categories || []).map((bc) => ({
    id: bc.category.id,
    name: bc.category.name,
    slug: bc.category.slug,
    isPrimary: bc.isPrimary,
  }));

  const dto = {
    id: book.id,
    title: book.title,
    author: book.author,
    year: book.year,
    language: book.language,
    isbn: book.isbn,
    publisher: book.publisher,
    pages: book.pages,
    description: book.description,
    tags: book.tags,
    coverUrl: book.coverUrl,
    coverDataUrl: book.coverDataUrl,
    condition: book.condition,
    available: book.available,
    loanPolicy: book.loanPolicy,
    viewCount: book.viewCount,
    requestCount: book.requestCount,
    status: book.status,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    categories,
  };

  if (book.owner) {
    dto.owner = {
      id: book.owner.id,
      displayName: book.owner.displayName,
      city: book.owner.publicCity ?? null,
      accountType: book.owner.accountType,
      avatarUrl: book.owner.avatarUrl,
    };
    if (book.owner.bio !== undefined) dto.owner.bio = book.owner.bio;
    // Posizione pubblica del proprietario (per la mappa), quando richiesta
    if (book.owner.publicLat !== undefined) {
      dto.owner.lat = book.owner.publicLat ?? null;
      dto.owner.lng = book.owner.publicLng ?? null;
    }
  }

  return dto;
}

// -----------------------------------------------------------------------------
// Plugin Fastify
// -----------------------------------------------------------------------------

export default async function booksRoutes(fastify) {
  // ===========================================================================
  // GET /api/books/nearby — Libri vicino a coordinata (PostGIS)
  // ===========================================================================
  // Variante PostGIS dell'esistente filtro geo su /api/books. Usa
  // ST_DWithin per match esatto su sfera (vs bounding box approssimato), e
  // ordina per distanza ascendente. Usa users.public_location (posizione
  // secondo la privacy scelta, con indice GIST): la distanza non rivela mai
  // la posizione reale.
  //
  // La distanza e' restituita in metri come campo extra `distanceMeters`
  // per ogni libro.
  fastify.get(
    '/api/books/nearby',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['lat', 'lng', 'radius'],
          properties: {
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
            radius: { type: 'number', minimum: 100, maximum: 100000 }, // metri (100m-100km)
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const { lat, lng, radius, limit, offset } = request.query;

      // Query raw con ST_DWithin (filtro) + ST_Distance (per ordering + output).
      // L'indice GIST su users.public_location rende ST_DWithin molto veloce.
      const rows = await fastify.prisma.$queryRawUnsafe(
        `
        SELECT
          b.id,
          b.title,
          b.author,
          b.year,
          b.language,
          b.cover_url AS "coverUrl",
          b.available,
          b.view_count AS "viewCount",
          b.request_count AS "requestCount",
          b.created_at AS "createdAt",
          u.id AS "ownerId",
          u.username AS "ownerUsername",
          u.display_name AS "ownerDisplayName",
          u.public_city AS "ownerCity",
          u.account_type AS "ownerAccountType",
          u.avatar_url AS "ownerAvatarUrl",
          ROUND(ST_Distance(
            u.public_location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          )::numeric, 0)::int AS "distanceMeters"
        FROM books b
        JOIN users u ON u.id = b.owner_id
        WHERE b.status = 'active'
          AND u.status = 'active'
          AND u.public_location IS NOT NULL
          AND ST_DWithin(
            u.public_location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )
        ORDER BY "distanceMeters" ASC
        LIMIT $4 OFFSET $5
      `,
        lng,
        lat,
        radius,
        limit,
        offset
      );

      const totalRow = await fastify.prisma.$queryRawUnsafe(
        `
        SELECT COUNT(*)::int AS total
        FROM books b
        JOIN users u ON u.id = b.owner_id
        WHERE b.status = 'active'
          AND u.status = 'active'
          AND u.public_location IS NOT NULL
          AND ST_DWithin(
            u.public_location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )
      `,
        lng,
        lat,
        radius
      );

      // Trasforma in shape DTO (uniforme col GET /api/books)
      const data = rows.map((r) => ({
        id: Number(r.id),
        title: r.title,
        author: r.author,
        year: r.year,
        language: r.language,
        coverUrl: r.coverUrl,
        available: r.available,
        viewCount: r.viewCount,
        requestCount: r.requestCount,
        createdAt: r.createdAt,
        distanceMeters: r.distanceMeters,
        owner: {
          id: r.ownerId,
          username: r.ownerUsername,
          displayName: r.ownerDisplayName,
          city: r.ownerCity,
          accountType: r.ownerAccountType,
          avatarUrl: r.ownerAvatarUrl,
        },
      }));

      return {
        center: { lat, lng },
        radius,
        data,
        pagination: { total: totalRow[0].total, limit, offset },
      };
    }
  );

  // ===========================================================================
  // GET /api/books — Lista con filtri + paginazione
  // ===========================================================================
  fastify.get(
    '/api/books',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', minLength: 1, maxLength: 200 },
            category: { type: 'integer', minimum: 1 },
            // Piu' generi separati da virgola: libri con almeno uno di essi;
            // una macro-area include i suoi sottogeneri
            categories: { type: 'string', pattern: '^[0-9]+(,[0-9]+)*$', maxLength: 300 },
            ownerId: { type: 'string', minLength: 1, maxLength: 40 },
            available: { type: 'boolean' },
            // Solo per l'utente autenticato: volumi con il suo "mi piace" e
            // volumi delle librerie che segue (home personalizzata)
            liked: { type: 'boolean' },
            following: { type: 'boolean' },
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
            radius: { type: 'number', minimum: 100, maximum: 100000 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            sort: {
              type: 'string',
              enum: ['recent', 'title', 'author', 'year', 'requested'],
              default: 'recent',
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const {
        q,
        category,
        categories,
        ownerId,
        available,
        liked,
        following,
        lat,
        lng,
        radius,
        limit,
        offset,
        sort,
      } = request.query;
      // 401 se si chiedono i propri preferiti o seguiti senza accesso
      const meId = liked || following ? await requireUserId(request) : null;

      // --- Costruzione WHERE clause ---
      // Solo volumi pubblicati di account attivi
      const where = { status: 'active', owner: { status: 'active' } };

      // Testo: titolo, autore e luogo (citta' pubblica del proprietario,
      // indirizzo pubblico degli enti)
      if (q) {
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { author: { contains: q, mode: 'insensitive' } },
          { owner: { publicCity: { contains: q, mode: 'insensitive' } } },
          {
            owner: {
              organizationProfile: { publicAddress: { contains: q, mode: 'insensitive' } },
            },
          },
        ];
      }
      const and = [];
      if (typeof available === 'boolean') where.available = available;
      if (ownerId) where.ownerId = ownerId;
      if (category) where.categories = { some: { categoryId: category } };
      if (categories) {
        const ids = categories.split(',').map(Number);
        const withChildren = await fastify.prisma.category.findMany({
          where: { OR: [{ id: { in: ids } }, { parentId: { in: ids } }] },
          select: { id: true },
        });
        and.push({
          categories: { some: { categoryId: { in: withChildren.map((c) => c.id) } } },
        });
      }

      // Raggio: PostGIS sulla posizione pubblica dei proprietari. Chi ha la
      // posizione nascosta o solo la citta' non compare.
      if (lat != null && lng != null && radius != null) {
        const near = await fastify.prisma.$queryRaw`
          SELECT id FROM users
          WHERE public_location IS NOT NULL
            AND ST_DWithin(
              public_location,
              ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
              ${radius}
            )`;
        and.push({ ownerId: { in: near.map((r) => r.id) } });
      }
      if (and.length) where.AND = and;

      if (liked) where.likes = { some: { userId: meId } };
      if (following) {
        where.owner = { ...where.owner, followedBy: { some: { followerId: meId } } };
      }

      // --- Ordinamento ---
      const orderBy = {
        recent: { createdAt: 'desc' },
        title: { title: 'asc' },
        author: { author: 'asc' },
        year: { year: 'desc' },
        requested: [{ requestCount: 'desc' }, { viewCount: 'desc' }],
      }[sort];

      // --- Query + count in parallelo ---
      const [books, total] = await Promise.all([
        fastify.prisma.book.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy,
          include: {
            owner: {
              select: {
                id: true,
                displayName: true,
                publicCity: true,
                publicLat: true,
                publicLng: true,
                accountType: true,
                avatarUrl: true,
              },
            },
            categories: {
              include: { category: { select: { id: true, name: true, slug: true } } },
            },
          },
        }),
        fastify.prisma.book.count({ where }),
      ]);

      // "Mi piace" dell'utente autenticato sui libri della pagina
      const currentUserId = meId || (await getCurrentUserId(request));
      let likedIds = new Set();
      if (currentUserId && books.length) {
        const likes = await fastify.prisma.like.findMany({
          where: { userId: currentUserId, bookId: { in: books.map((b) => b.id) } },
          select: { bookId: true },
        });
        likedIds = new Set(likes.map((l) => l.bookId));
      }

      return {
        data: books.map((b) => ({
          ...toDto(b),
          ...(currentUserId ? { likedByMe: likedIds.has(b.id) } : {}),
        })),
        pagination: { total, limit, offset },
      };
    }
  );

  // ===========================================================================
  // GET /api/books/:id — Dettaglio singolo
  // ===========================================================================
  fastify.get(
    '/api/books/:id',
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

      const book = await fastify.prisma.book.findUnique({
        where: { id },
        include: {
          owner: {
            select: {
              id: true,
              status: true,
              displayName: true,
              username: true,
              publicCity: true,
              accountType: true,
              avatarUrl: true,
              bio: true,
            },
          },
          categories: {
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
          _count: { select: { likes: true } },
        },
      });

      const notFound = () =>
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Libro con id ${id} non trovato` },
        });
      if (!book) return notFound();

      // Un volume non pubblicato (in attesa della conferma email del
      // proprietario, nascosto o rimosso) o di un account sospeso lo vedono
      // solo il proprietario e gli amministratori
      const userId = await getCurrentUserId(request);
      if ((book.status !== 'active' || book.owner.status !== 'active') && userId !== book.ownerId) {
        const viewer = userId
          ? await fastify.prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
          : null;
        if (viewer?.role !== 'admin') return notFound();
      }

      const dto = toDto(book);
      dto.likesCount = book._count?.likes ?? 0;
      // Stato del "mi piace" per l'utente autenticato (false per gli ospiti)
      dto.likedByMe = userId
        ? (await fastify.prisma.like.count({ where: { userId, bookId: id } })) > 0
        : false;
      return dto;
    }
  );

  // ===========================================================================
  // POST /api/books — Crea (auth required, owner = current user)
  // ===========================================================================
  fastify.post(
    '/api/books',
    {
      schema: {
        body: {
          type: 'object',
          required: ['title', 'author', 'categoryIds'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 500 },
            author: { type: 'string', minLength: 1, maxLength: 300 },
            year: { type: 'integer', minimum: 1400, maximum: 2100 },
            language: { type: 'string', maxLength: 50 },
            isbn: { type: 'string', maxLength: 13 },
            publisher: { type: 'string', maxLength: 200 },
            pages: { type: 'integer', minimum: 1 },
            description: { type: 'string', maxLength: 5000 },
            tags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20 },
            coverUrl: { type: 'string', format: 'uri', maxLength: 500 },
            coverDataUrl: { type: 'string', maxLength: 5_000_000 },
            condition: {
              type: 'string',
              enum: [
                'come nuovo',
                'ottime condizioni',
                'buone condizioni',
                'discrete',
                'da restauro',
              ],
            },
            available: { type: 'boolean', default: true },
            loanPolicy: { type: 'string', enum: ['loan', 'consult', 'display'], default: 'loan' },
            categoryIds: {
              type: 'array',
              items: { type: 'integer', minimum: 1 },
              minItems: 1,
              maxItems: 5,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const ownerId = await requireUserId(request);
      const { categoryIds, ...bookData } = request.body;

      // categoryIds[0] e' la categoria primaria
      const [primaryId, ...secondaryIds] = categoryIds;

      const book = await fastify.prisma.book.create({
        data: {
          ...bookData,
          ownerId,
          categories: {
            create: [
              { categoryId: primaryId, isPrimary: true },
              ...secondaryIds.map((cid) => ({ categoryId: cid, isPrimary: false })),
            ],
          },
        },
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
          categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
        },
      });

      return reply.status(201).send(toDto(book));
    }
  );

  // ===========================================================================
  // PATCH /api/books/:id — Modifica (owner only)
  // ===========================================================================
  fastify.patch(
    '/api/books/:id',
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
            title: { type: 'string', minLength: 1, maxLength: 500 },
            author: { type: 'string', minLength: 1, maxLength: 300 },
            year: { type: 'integer', minimum: 1400, maximum: 2100 },
            language: { type: 'string', maxLength: 50 },
            isbn: { type: 'string', maxLength: 13 },
            publisher: { type: 'string', maxLength: 200 },
            pages: { type: 'integer', minimum: 1 },
            description: { type: 'string', maxLength: 5000 },
            tags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20 },
            coverUrl: { type: 'string', format: 'uri', maxLength: 500 },
            coverDataUrl: { type: 'string', maxLength: 5_000_000 },
            condition: {
              type: 'string',
              enum: [
                'come nuovo',
                'ottime condizioni',
                'buone condizioni',
                'discrete',
                'da restauro',
              ],
            },
            available: { type: 'boolean' },
            loanPolicy: { type: 'string', enum: ['loan', 'consult', 'display'] },
            categoryIds: {
              type: 'array',
              items: { type: 'integer', minimum: 1 },
              minItems: 1,
              maxItems: 5,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { categoryIds, ...patchData } = request.body;

      // Verifica esistenza + ownership
      const existing = await fastify.prisma.book.findUnique({
        where: { id },
        select: { ownerId: true },
      });
      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Libro con id ${id} non trovato` },
        });
      }
      await requireOwner(request, existing.ownerId);

      // Se categoryIds e' incluso, sostituisci tutte le categorie atomicamente
      const updated = await fastify.prisma.$transaction(async (tx) => {
        if (categoryIds) {
          await tx.bookCategory.deleteMany({ where: { bookId: id } });
          const [primaryId, ...secondaryIds] = categoryIds;
          await tx.bookCategory.createMany({
            data: [
              { bookId: id, categoryId: primaryId, isPrimary: true },
              ...secondaryIds.map((cid) => ({ bookId: id, categoryId: cid, isPrimary: false })),
            ],
          });
        }

        return tx.book.update({
          where: { id },
          data: patchData,
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
            categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
          },
        });
      });

      return toDto(updated);
    }
  );

  // ===========================================================================
  // DELETE /api/books/:id — Cancella (owner only)
  // ===========================================================================
  fastify.delete(
    '/api/books/:id',
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

      const existing = await fastify.prisma.book.findUnique({
        where: { id },
        select: { ownerId: true },
      });
      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Libro con id ${id} non trovato` },
        });
      }
      await requireOwner(request, existing.ownerId);

      await fastify.prisma.book.delete({ where: { id } });
      return reply.status(204).send();
    }
  );

  // ===========================================================================
  // POST /api/books/:id/views — Incrementa view (debounce 60s/user via Redis)
  // ===========================================================================
  // Anonimo: nessun debounce (incremento ogni volta — accettabile per Alpha).
  // Autenticato: debounce per-user via chiave Redis con TTL 60s.
  fastify.post(
    '/api/books/:id/views',
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
      const userId = await getCurrentUserId(request);

      // --- Debounce per autenticati ---
      if (userId) {
        const debounceKey = `book:views:${id}:${userId}`;
        try {
          const set = await fastify.redis.set(debounceKey, '1', 'EX', 60, 'NX');
          if (!set) {
            // Chiave gia' presente: l'utente ha visto questo libro negli ultimi 60s
            return { incremented: false, reason: 'debounced' };
          }
        } catch (err) {
          // Se Redis e' giu', incrementiamo comunque (degraded mode)
          request.log.warn({ err: err.message }, 'redis down: skipping view debounce');
        }
      }

      // --- Incremento atomico: totale + conteggio del giorno (anonimo) ---
      try {
        const [updated] = await fastify.prisma.$transaction([
          fastify.prisma.book.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
            select: { id: true, viewCount: true },
          }),
          fastify.prisma.$executeRaw`
            INSERT INTO book_view_days (book_id, day, count) VALUES (${id}, CURRENT_DATE, 1)
            ON CONFLICT (book_id, day) DO UPDATE SET count = book_view_days.count + 1`,
        ]);
        return { incremented: true, bookId: updated.id, viewCount: updated.viewCount };
      } catch (err) {
        if (err.code === 'P2025') {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: `Libro con id ${id} non trovato` },
          });
        }
        throw err;
      }
    }
  );

  // ===========================================================================
  // POST /api/books/:id/like — Like (auth required, idempotente)
  // ===========================================================================
  fastify.post(
    '/api/books/:id/like',
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

      // Verifica esistenza libro
      const book = await fastify.prisma.book.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!book || book.status === 'removed') {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Libro con id ${id} non trovato` },
        });
      }

      // Idempotente via upsert
      await fastify.prisma.like.upsert({
        where: { userId_bookId: { userId, bookId: id } },
        create: { userId, bookId: id },
        update: {},
      });

      const likesCount = await fastify.prisma.like.count({ where: { bookId: id } });
      return { liked: true, bookId: id, likesCount };
    }
  );

  // ===========================================================================
  // DELETE /api/books/:id/like — Unlike (idempotente)
  // ===========================================================================
  fastify.delete(
    '/api/books/:id/like',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const userId = await requireUserId(request);

      try {
        await fastify.prisma.like.delete({
          where: { userId_bookId: { userId, bookId: id } },
        });
      } catch (err) {
        if (err.code !== 'P2025') throw err;
        // se non c'era già, idempotente
      }

      const likesCount = await fastify.prisma.like.count({ where: { bookId: id } });
      return { liked: false, bookId: id, likesCount };
    }
  );
}
