// =============================================================================
// src/lib/prisma.js
// =============================================================================
// Singleton del Prisma Client. In dev abilita query logging (utile per
// debugging N+1 query). In prod logga solo errori per evitare flood.
//
// Esposto al resto dell'app via Fastify decorator `fastify.prisma` (vedi
// src/app.js). Disconnessione gestita nel hook onClose di Fastify.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

export const prisma = new PrismaClient({
  log: config.isDev
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ]
    : [{ emit: 'event', level: 'error' }],
});

/**
 * Aggancia gli eventi Prisma al logger Fastify. Da chiamare durante il
 * bootstrap dell'app, una volta che il logger esiste.
 */
export function attachPrismaLogging(prismaInstance, fastifyLogger) {
  if (config.isDev) {
    prismaInstance.$on('query', (e) => {
      // Log query Prisma solo se molto lente (>50ms) per non flood
      if (e.duration > 50) {
        fastifyLogger.debug({ duration: e.duration, query: e.query }, 'slow prisma query');
      }
    });
    prismaInstance.$on('warn', (e) => fastifyLogger.warn({ msg: e.message }, 'prisma warn'));
  }
  prismaInstance.$on('error', (e) => fastifyLogger.error({ msg: e.message }, 'prisma error'));
}
