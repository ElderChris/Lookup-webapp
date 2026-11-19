// =============================================================================
// src/routes/health.js
// =============================================================================
// Endpoint di health check. Risponde con stato dei servizi collegati.
//
//   GET /api/health
//
// Status:
//   - status='ok'    → tutto funziona, HTTP 200
//   - status='degraded' → app risponde ma qualche dipendenza ha problemi (HTTP 200)
//   - status='down'  → l'app stessa è in errore (HTTP 503)
//
// Usato da: Docker healthcheck, load balancer, monitoring esterno.
// =============================================================================

import { API_VERSION } from '../version.js';

export default async function healthRoutes(fastify) {
  fastify.get('/api/health', async (request, reply) => {
    const checks = {
      db: 'unknown',
      redis: 'unknown',
    };

    // --- Postgres via Prisma ---
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch (err) {
      checks.db = 'error';
      request.log.warn({ err: err.message }, 'health: db check failed');
    }

    // --- Redis ---
    try {
      const pong = await fastify.redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'error';
    } catch (err) {
      checks.redis = 'error';
      request.log.warn({ err: err.message }, 'health: redis check failed');
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');
    const status = allOk ? 'ok' : 'degraded';

    return reply.status(200).send({
      status,
      ...checks,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: API_VERSION,
    });
  });

  /**
   * Endpoint minimal per liveness probe (Docker / k8s).
   * Risponde se il processo Node è attivo, senza dipendenze.
   */
  fastify.get('/api/ping', async () => ({ pong: true }));
}
