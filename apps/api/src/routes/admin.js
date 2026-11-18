// =============================================================================
// src/routes/admin.js — Admin moderation + user management (Beta 4)
// =============================================================================
// Route riservate al ruolo 'admin'. Sostituisce le funzioni legacy usate
// da admin.html: getUsers, getReportedPosts, clearPostReports, deletePost,
// deleteUser, updateUser (cross-user), adminAddBook.
//
// Autorizzazione: middleware `requireAdmin` verifica session + role.
// =============================================================================

import { requireUserId } from '../lib/authHelpers.js';
import { logAdminAction } from '../lib/adminAudit.js';

/**
 * Middleware admin: verifica che l'utente autenticato abbia role='admin'.
 * @param {import('fastify').FastifyRequest} request
 * @returns {Promise<string>} userId dell'admin corrente
 * @throws 401 se anonimo, 403 se role !== 'admin'
 */
async function requireAdmin(request, fastify) {
  const userId = await requireUserId(request);
  const user = await fastify.prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== 'admin') {
    const err = new Error('Solo gli amministratori possono accedere');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ADMIN_ONLY';
    throw err;
  }
  return userId;
}

export default async function adminRoutes(fastify) {
  // ===========================================================================
  // GET /api/admin/users — Lista utenti (paginated) con filtri
  // ===========================================================================
  fastify.get(
    '/api/admin/users',
    {
      schema: {
        tags: ['Users'],
        summary: '[ADMIN] Lista utenti con filtri',
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', maxLength: 100 },
            accountType: { type: 'string', enum: ['person', 'organization'] },
            status: { type: 'string', enum: ['active', 'pending', 'suspended', 'deleted'] },
            role: { type: 'string', enum: ['user', 'moderator', 'admin'] },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 100 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => {
      await requireAdmin(request, fastify);
      const { q, accountType, status, role, limit = 100, offset = 0 } = request.query;
      const where = {};
      if (accountType) where.accountType = accountType;
      if (status) where.status = status;
      if (role) where.role = role;
      if (q) {
        where.OR = [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ];
      }
      const [rows, total] = await Promise.all([
        fastify.prisma.user.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            city: true,
            bio: true,
            avatarUrl: true,
            accountType: true,
            role: true,
            status: true,
            emailVerified: true,
            createdAt: true,
            lastLoginAt: true,
          },
        }),
        fastify.prisma.user.count({ where }),
      ]);
      return {
        data: rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          lastLoginAt: r.lastLoginAt?.toISOString() || null,
        })),
        pagination: { total, limit, offset },
      };
    }
  );

  // ===========================================================================
  // PATCH /api/admin/users/:id — Update user (admin override)
  // ===========================================================================
  fastify.patch(
    '/api/admin/users/:id',
    {
      schema: {
        tags: ['Users'],
        summary: '[ADMIN] Aggiorna utente (cross-user)',
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            displayName: { type: 'string', minLength: 1, maxLength: 100 },
            bio: { type: ['string', 'null'] },
            city: { type: ['string', 'null'], maxLength: 150 },
            role: { type: 'string', enum: ['user', 'moderator', 'admin'] },
            status: { type: 'string', enum: ['active', 'pending', 'suspended', 'deleted'] },
            emailVerified: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const adminId = await requireAdmin(request, fastify);
      const { id } = request.params;
      const patch = request.body;
      const existing = await fastify.prisma.user.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing)
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Utente non trovato' } });
      const updated = await fastify.prisma.user.update({
        where: { id },
        data: patch,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          city: true,
          bio: true,
          accountType: true,
          role: true,
          status: true,
          emailVerified: true,
        },
      });
      await logAdminAction(fastify, request, {
        adminId,
        action: 'user.update',
        targetType: 'user',
        targetId: id,
        payload: patch,
      });
      return updated;
    }
  );

  // ===========================================================================
  // DELETE /api/admin/users/:id — Delete user (admin override)
  // ===========================================================================
  fastify.delete(
    '/api/admin/users/:id',
    {
      schema: {
        tags: ['Users'],
        summary: '[ADMIN] Elimina utente (cross-user)',
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const adminId = await requireAdmin(request, fastify);
      const { id } = request.params;
      if (id === adminId) {
        return reply.code(400).send({
          error: {
            code: 'CANNOT_DELETE_SELF',
            message: 'Non puoi eliminare il tuo stesso account admin',
          },
        });
      }
      const existing = await fastify.prisma.user.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing)
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Utente non trovato' } });
      // Soft delete: mark as deleted invece di cascade fisico (preservazione dati sociali)
      await fastify.prisma.user.update({
        where: { id },
        data: { status: 'deleted' },
      });
      await logAdminAction(fastify, request, {
        adminId,
        action: 'user.delete',
        targetType: 'user',
        targetId: id,
      });
      return reply.code(204).send();
    }
  );

  // ===========================================================================
  // GET /api/admin/reports — Lista posts con report attivi
  // ===========================================================================
  fastify.get(
    '/api/admin/reports',
    {
      schema: {
        tags: ['Posts'],
        summary: '[ADMIN] Posts con report attivi (moderation queue)',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => {
      await requireAdmin(request, fastify);
      const { limit = 50, offset = 0 } = request.query;

      // Raggruppa i report per post, includendo il conteggio per motivo
      const rows = await fastify.prisma.$queryRawUnsafe(
        `
        SELECT
          p.id AS post_id,
          p.content,
          p.author_id,
          p.created_at,
          u.username AS author_username,
          u.display_name AS author_display_name,
          COUNT(pr.id)::int AS reports_count,
          json_agg(json_build_object(
            'reason', pr.reason,
            'note', pr.note,
            'reporterId', pr.reporter_id,
            'createdAt', pr.created_at
          ) ORDER BY pr.created_at DESC) AS reports
        FROM post_reports pr
        JOIN posts p ON p.id = pr.post_id
        JOIN users u ON u.id = p.author_id
        GROUP BY p.id, u.username, u.display_name
        ORDER BY reports_count DESC, MAX(pr.created_at) DESC
        LIMIT $1 OFFSET $2
      `,
        limit,
        offset
      );

      const total = await fastify.prisma.post.count({
        where: { reports: { some: {} } },
      });

      return {
        data: rows.map((r) => ({
          post: {
            id: r.post_id,
            content: r.content,
            authorId: r.author_id,
            authorUsername: r.author_username,
            authorDisplayName: r.author_display_name,
            createdAt: r.created_at?.toISOString?.() || r.created_at,
          },
          reportsCount: r.reports_count,
          reports: r.reports,
        })),
        pagination: { total, limit, offset },
      };
    }
  );

  // ===========================================================================
  // POST /api/admin/posts/:id/clear-reports — Pulisci report di un post
  // ===========================================================================
  fastify.post(
    '/api/admin/posts/:id/clear-reports',
    {
      schema: {
        tags: ['Posts'],
        summary: '[ADMIN] Pulisci tutti i report di un post (dismiss)',
        params: {
          type: 'object',
          properties: { id: { type: 'string', maxLength: 40 } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const adminId = await requireAdmin(request, fastify);
      const { id } = request.params;
      const existing = await fastify.prisma.post.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing)
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Post non trovato' } });
      const result = await fastify.prisma.postReport.deleteMany({ where: { postId: id } });
      await logAdminAction(fastify, request, {
        adminId,
        action: 'post.clear_reports',
        targetType: 'post',
        targetId: id,
        payload: { cleared: result.count },
      });
      return { cleared: result.count };
    }
  );

  // ===========================================================================
  // DELETE /api/admin/posts/:id — Cancella post (admin override)
  // ===========================================================================
  fastify.delete(
    '/api/admin/posts/:id',
    {
      schema: {
        tags: ['Posts'],
        summary: '[ADMIN] Elimina post (override author)',
        params: {
          type: 'object',
          properties: { id: { type: 'string', maxLength: 40 } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const adminId = await requireAdmin(request, fastify);
      const { id } = request.params;
      const existing = await fastify.prisma.post.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing)
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Post non trovato' } });
      // Cascade: postReactions, postReports cancellati automaticamente
      await fastify.prisma.post.delete({ where: { id } });
      await logAdminAction(fastify, request, {
        adminId,
        action: 'post.delete',
        targetType: 'post',
        targetId: id,
      });
      return reply.code(204).send();
    }
  );

  // ===========================================================================
  // POST /api/admin/books — Aggiungi libro per conto di un utente
  // ===========================================================================
  fastify.post(
    '/api/admin/books',
    {
      schema: {
        tags: ['Books'],
        summary: '[ADMIN] Aggiungi libro per conto di un utente',
        body: {
          type: 'object',
          required: ['ownerId', 'title', 'author'],
          additionalProperties: false,
          properties: {
            ownerId: { type: 'string', minLength: 1, maxLength: 40 },
            title: { type: 'string', minLength: 1, maxLength: 300 },
            author: { type: 'string', minLength: 1, maxLength: 200 },
            year: { type: ['integer', 'null'], minimum: 1000, maximum: 2100 },
            isbn: { type: ['string', 'null'], maxLength: 20 },
            pages: { type: ['integer', 'null'], minimum: 1 },
            language: { type: 'string', maxLength: 50 },
            condition: { type: 'string', maxLength: 50 },
            description: { type: 'string', maxLength: 5000 },
            available: { type: 'boolean' },
            categoryIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
          },
        },
      },
    },
    async (request, reply) => {
      const adminId = await requireAdmin(request, fastify);
      const { ownerId, categoryIds = [], ...bookData } = request.body;
      const owner = await fastify.prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true },
      });
      if (!owner)
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Owner non trovato' } });

      const book = await fastify.prisma.book.create({
        data: {
          ownerId,
          title: bookData.title,
          author: bookData.author,
          year: bookData.year ?? null,
          isbn: bookData.isbn ?? null,
          pages: bookData.pages ?? null,
          language: bookData.language ?? 'Italiano',
          condition: bookData.condition ?? 'buone condizioni',
          description: bookData.description ?? '',
          available: bookData.available ?? true,
          categories:
            categoryIds.length > 0
              ? { create: categoryIds.map((cId) => ({ categoryId: cId })) }
              : undefined,
        },
        include: { categories: { include: { category: true } } },
      });

      await logAdminAction(fastify, request, {
        adminId,
        action: 'book.create',
        targetType: 'book',
        targetId: book.id,
        payload: { ownerId, title: book.title, author: book.author },
      });

      return reply.code(201).send({
        id: book.id,
        ownerId: book.ownerId,
        title: book.title,
        author: book.author,
        year: book.year,
        isbn: book.isbn,
        pages: book.pages,
        language: book.language,
        condition: book.condition,
        description: book.description,
        available: book.available,
        categories: book.categories.map((bc) => ({ id: bc.category.id, name: bc.category.name })),
        createdAt: book.createdAt.toISOString(),
      });
    }
  );

  // ===========================================================================
  // PATCH /api/admin/books/:id — Update book (admin override, Beta 5)
  // ===========================================================================
  // A differenza di PATCH /api/books/:id (owner-only), l'admin puo' modificare
  // qualsiasi libro. Utile per correzioni catalogo o interventi di moderation.
  fastify.patch(
    '/api/admin/books/:id',
    {
      schema: {
        tags: ['Books'],
        summary: '[ADMIN] Modifica libro (override owner)',
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 300 },
            author: { type: 'string', minLength: 1, maxLength: 200 },
            year: { type: ['integer', 'null'], minimum: 1000, maximum: 2100 },
            isbn: { type: ['string', 'null'], maxLength: 20 },
            pages: { type: ['integer', 'null'], minimum: 1 },
            language: { type: 'string', maxLength: 50 },
            condition: { type: 'string', maxLength: 50 },
            description: { type: 'string', maxLength: 5000 },
            available: { type: 'boolean' },
            ownerId: { type: 'string', minLength: 1, maxLength: 40 },
            categoryIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
          },
        },
      },
    },
    async (request, reply) => {
      const adminId = await requireAdmin(request, fastify);
      const { id } = request.params;
      const { ownerId, categoryIds, ...patch } = request.body;

      const existing = await fastify.prisma.book.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing)
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Libro non trovato' } });

      // Se admin cambia ownerId, verifica esistenza nuovo owner
      if (ownerId) {
        const owner = await fastify.prisma.user.findUnique({
          where: { id: ownerId },
          select: { id: true },
        });
        if (!owner)
          return reply
            .code(404)
            .send({ error: { code: 'NOT_FOUND', message: 'Owner non trovato' } });
        patch.ownerId = ownerId;
      }

      // Se admin passa categoryIds, sostituisce interamente le categorie collegate
      if (Array.isArray(categoryIds)) {
        await fastify.prisma.bookCategory.deleteMany({ where: { bookId: id } });
        if (categoryIds.length > 0) {
          await fastify.prisma.bookCategory.createMany({
            data: categoryIds.map((cId) => ({ bookId: id, categoryId: cId })),
          });
        }
      }

      const book = await fastify.prisma.book.update({
        where: { id },
        data: patch,
        include: { categories: { include: { category: true } } },
      });

      await logAdminAction(fastify, request, {
        adminId,
        action: 'book.update',
        targetType: 'book',
        targetId: id,
        payload: { ...patch, categoryIds },
      });

      return {
        id: book.id,
        ownerId: book.ownerId,
        title: book.title,
        author: book.author,
        year: book.year,
        isbn: book.isbn,
        pages: book.pages,
        language: book.language,
        condition: book.condition,
        description: book.description,
        available: book.available,
        categories: book.categories.map((bc) => ({ id: bc.category.id, name: bc.category.name })),
        updatedAt: book.updatedAt.toISOString(),
      };
    }
  );

  // ===========================================================================
  // DELETE /api/admin/books/:id — Delete book (admin override, Beta 5)
  // ===========================================================================
  fastify.delete(
    '/api/admin/books/:id',
    {
      schema: {
        tags: ['Books'],
        summary: '[ADMIN] Elimina libro (override owner)',
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const adminId = await requireAdmin(request, fastify);
      const { id } = request.params;
      const existing = await fastify.prisma.book.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing)
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Libro non trovato' } });
      // Cascade su bookCategories, loanRequests, likes, ecc. (definito nel schema Prisma)
      await fastify.prisma.book.delete({ where: { id } });
      await logAdminAction(fastify, request, {
        adminId,
        action: 'book.delete',
        targetType: 'book',
        targetId: id,
      });
      return reply.code(204).send();
    }
  );

  // ===========================================================================
  // GET /api/admin/audit-log — Consulta il log delle azioni admin (Beta 5)
  // ===========================================================================
  fastify.get(
    '/api/admin/audit-log',
    {
      schema: {
        tags: ['Users'],
        summary: '[ADMIN] Log delle azioni amministrative recenti',
        querystring: {
          type: 'object',
          properties: {
            adminId: { type: 'string', maxLength: 40 },
            action: { type: 'string', maxLength: 60 },
            targetType: { type: 'string', maxLength: 30 },
            targetId: { type: 'string', maxLength: 60 },
            limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => {
      await requireAdmin(request, fastify);
      const { adminId, action, targetType, targetId, limit = 100, offset = 0 } = request.query;
      const where = {};
      if (adminId) where.adminId = adminId;
      if (action) where.action = action;
      if (targetType) where.targetType = targetType;
      if (targetId) where.targetId = targetId;

      const [rows, total] = await Promise.all([
        fastify.prisma.adminAuditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            // Nota: adminId e' non-FK per resilienza (l'admin potrebbe essere
            // stato cancellato). Facciamo lookup manuale nella response
          },
        }),
        fastify.prisma.adminAuditLog.count({ where }),
      ]);

      // Popola displayName degli admin (batch query per efficienza)
      const adminIds = [...new Set(rows.map((r) => r.adminId))];
      const admins = adminIds.length
        ? await fastify.prisma.user.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, username: true, displayName: true },
          })
        : [];
      const adminMap = new Map(admins.map((a) => [a.id, a]));

      return {
        data: rows.map((r) => ({
          id: r.id,
          admin: {
            id: r.adminId,
            username: adminMap.get(r.adminId)?.username || null,
            displayName: adminMap.get(r.adminId)?.displayName || null,
          },
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          payload: r.payload,
          ipAddress: r.ipAddress,
          userAgent: r.userAgent,
          createdAt: r.createdAt.toISOString(),
        })),
        pagination: { total, limit, offset },
      };
    }
  );

  // ===========================================================================
  // GET /api/admin/jobs — Stato dei job schedulati (Beta 7)
  // ===========================================================================
  // Ritorna informazioni sui job in coda / attivi / completati per ogni queue
  // registrata. Utile per debugging + monitoring dashboard admin.
  fastify.get(
    '/api/admin/jobs',
    {
      schema: {
        tags: ['Users'],
        summary: '[ADMIN] Stato delle queue background jobs',
      },
    },
    async (request) => {
      await requireAdmin(request, fastify);
      // Import dinamico per evitare di caricare BullMQ se disabilitato
      try {
        const { overdueLoansQueue, retentionQueue, upcomingDeadlineQueue } =
          await import('../jobs/queue.js');
        const queues = {
          'overdue-loans': overdueLoansQueue,
          retention: retentionQueue,
          'upcoming-deadline': upcomingDeadlineQueue,
        };
        const stats = {};
        for (const [name, queue] of Object.entries(queues)) {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed'
          );
          const nextJobs = await queue.getJobs(['delayed', 'waiting'], 0, 4);
          stats[name] = {
            counts,
            nextRuns: nextJobs
              .filter((j) => j.opts.delay || j.opts.repeat)
              .map((j) => ({
                id: j.id,
                name: j.name,
                delay: j.opts.delay,
                nextRunAt: j.opts.delay ? new Date(j.timestamp + j.opts.delay).toISOString() : null,
              }))
              .slice(0, 3),
          };
        }
        return { enabled: true, queues: stats };
      } catch (err) {
        return { enabled: false, error: err.message };
      }
    }
  );

  // ===========================================================================
  // POST /api/admin/jobs/:queue/run — Trigger manuale di un job (Beta 7)
  // ===========================================================================
  // Permette all'admin di forzare l'esecuzione di un job on-demand
  // (senza aspettare lo schedule). Utile per test dopo config changes,
  // debug di reminder mancati, ecc.
  //
  // NB: il job viene aggiunto in coda normalmente, non skippa nulla —
  // parte quando il worker e' libero. Idempotenza garantita dai flag interni
  // dei job (es. reminderSentAt in overdue-loans).
  fastify.post(
    '/api/admin/jobs/:queue/run',
    {
      schema: {
        tags: ['Users'],
        summary: '[ADMIN] Esegui manualmente un job',
        params: {
          type: 'object',
          properties: {
            queue: { type: 'string', enum: ['overdue-loans', 'retention', 'upcoming-deadline'] },
          },
          required: ['queue'],
        },
      },
    },
    async (request, reply) => {
      const adminId = await requireAdmin(request, fastify);
      const { queue: queueName } = request.params;
      try {
        const { overdueLoansQueue, retentionQueue, upcomingDeadlineQueue } =
          await import('../jobs/queue.js');
        const queues = {
          'overdue-loans': overdueLoansQueue,
          retention: retentionQueue,
          'upcoming-deadline': upcomingDeadlineQueue,
        };
        const queue = queues[queueName];
        if (!queue) {
          return reply
            .code(404)
            .send({ error: { code: 'NOT_FOUND', message: 'Queue non trovata' } });
        }
        const job = await queue.add(
          `manual-${queueName}-${Date.now()}`,
          { triggeredBy: adminId, manual: true },
          { removeOnComplete: true }
        );
        await logAdminAction(fastify, request, {
          adminId,
          action: 'job.run',
          targetType: 'queue',
          targetId: queueName,
          payload: { jobId: job.id },
        });
        return { queued: true, queue: queueName, jobId: job.id };
      } catch (err) {
        return reply.code(503).send({
          error: { code: 'JOBS_DISABLED', message: 'Background jobs non attivi: ' + err.message },
        });
      }
    }
  );
}
