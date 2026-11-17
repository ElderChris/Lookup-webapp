// =============================================================================
// src/routes/index.js
// =============================================================================
// Aggregatore dei route plugin. Ogni modulo di route è registrato qui.
// =============================================================================

import healthRoutes from './health.js';
import booksRoutes from './books.js';
import usersRoutes from './users.js';
import loansRoutes from './loans.js';
import postsRoutes from './posts.js';
import notificationsRoutes from './notifications.js';
import statsRoutes from './stats.js';
import categoriesRoutes from './categories.js';
// Beta 2: nuovi endpoint per chiudere il gap con il legacy
import prefsRoutes from './prefs.js';
import orgProfileRoutes from './orgProfile.js';
import libraryRoutes from './library.js';
import dataExportRoutes from './dataExport.js';
// Beta 4: admin moderation + user management
import adminRoutes from './admin.js';
// Beta 8: SSE realtime events
import eventsRoutes from './events.js';
// Beta 10: Prometheus metrics
import metricsRoutes from './metrics.js';

export default async function routes(fastify) {
  await fastify.register(healthRoutes);
  await fastify.register(booksRoutes);
  await fastify.register(usersRoutes);
  await fastify.register(loansRoutes);
  await fastify.register(postsRoutes);
  await fastify.register(notificationsRoutes);
  await fastify.register(statsRoutes);
  await fastify.register(categoriesRoutes);
  // Beta 2
  await fastify.register(prefsRoutes);
  await fastify.register(orgProfileRoutes);
  await fastify.register(libraryRoutes);
  await fastify.register(dataExportRoutes);
  // Beta 4
  await fastify.register(adminRoutes);
  // Beta 8
  await fastify.register(eventsRoutes);
  // Beta 10
  await fastify.register(metricsRoutes);
}
