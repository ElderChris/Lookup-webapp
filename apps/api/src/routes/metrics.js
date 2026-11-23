// =============================================================================
// src/routes/metrics.js — Endpoint /metrics per Prometheus scraping
// =============================================================================
// Espone tutte le metriche in formato testuale Prometheus (esposition format).
// Non richiede autenticazione utente ma protegge da abusi via IP whitelist
// opzionale.
//
// SICUREZZA:
//   - No cookie session richiesto (Prometheus non fa login)
//   - IP whitelist opzionale via env `METRICS_ALLOWED_IPS` (comma-separated)
//   - Default: allow-all (in dev). In prod raccomandato: whitelist solo
//     l'IP del container Prometheus (nel docker network) e localhost
//   - Nessun dato personale nelle metriche: solo counter/gauge aggregati
//
// PATH default: `/metrics` — convenzione Prometheus.
// Configurabile via env `METRICS_PATH` (raro).
//
// RATE LIMIT: bypass del rate-limit globale — Prometheus scrapa ogni 15-30s,
// non ha senso limitarlo per burst.
// =============================================================================

import { registry } from '../lib/metrics.js';

/**
 * Verifica se l'IP e' nella whitelist (se definita).
 * Se `METRICS_ALLOWED_IPS` non e' settato → allow all (comportamento dev).
 */
function isAllowedIP(request) {
  const raw = process.env.METRICS_ALLOWED_IPS;
  if (!raw) return true;
  const allowed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const clientIp =
    request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.ip || 'unknown';
  // Match esatto o supporto per prefix /24 basico
  for (const rule of allowed) {
    if (rule === clientIp) return true;
    if (rule.endsWith('/24') && clientIp.startsWith(rule.slice(0, -6))) return true;
  }
  return false;
}

export default async function metricsRoutes(fastify) {
  const metricsPath = process.env.METRICS_PATH || '/metrics';

  fastify.get(
    metricsPath,
    {
      config: { rateLimit: false },
      schema: {
        tags: ['Monitoring'],
        summary: 'Metriche Prometheus (esposition format)',
        description: `Endpoint per lo scraping Prometheus. Espone metriche in formato testuale standard.

Metriche esposte:
- **HTTP**: latency histogram + request counter per method/route/status
- **Business**: loans_created, loans_transitions, notifications_sent
- **Realtime**: sse_active_connections (gauge), sse_publishes (counter)
- **Background jobs**: bull_jobs_processed, bull_job_duration, bull_queue_size
- **Node**: event loop lag, GC, heap, memoria RSS, CPU (via collectDefaultMetrics)

Consultabile senza login, ma con IP whitelist opzionale (env METRICS_ALLOWED_IPS).`,
      },
    },
    async (request, reply) => {
      if (!isAllowedIP(request)) {
        return reply.code(403).send({
          error: { code: 'IP_NOT_ALLOWED', message: 'IP non autorizzato per metrics' },
        });
      }
      reply.type(registry.contentType);
      return registry.metrics();
    }
  );
}
