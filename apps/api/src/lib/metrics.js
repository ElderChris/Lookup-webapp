// =============================================================================
// src/lib/metrics.js — Registry Prometheus + metriche di Lookup (Beta 10)
// =============================================================================
// Definisce le metriche esposte su /metrics per lo scraping Prometheus.
//
// PATTERN:
//   - Un solo Registry globale (singleton)
//   - Metriche di default via collectDefaultMetrics (event loop lag,
//     GC pause, heap, memoria RSS, CPU, ecc.)
//   - Metriche HTTP: Histogram durata per method/route/status
//   - Metriche business: Counter cumulative (loans/notifications/eventi),
//     Gauge per stato istantaneo (SSE connessi, queue size)
//
// TIPI di metrica (guida rapida):
//   - Counter: valore che aumenta monotonicamente (es. "quante richieste
//     ho servito da sempre"). Uso: rate() in PromQL per RPS
//   - Gauge: valore che va su e giu' (es. "quanti utenti connessi ADESSO")
//   - Histogram: distribuzione (es. latency). Espone quantili p50/p95/p99
//   - Summary: come Histogram ma calcolato client-side (meno usato)
//
// NAMING convenzione:
//   `lookup_<domain>_<name>_<unit>` (es. `lookup_loans_created_total`)
//   Suffissi standard: `_total` per counter, `_seconds` per durate,
//   `_bytes` per dimensioni
// =============================================================================

import { Registry, collectDefaultMetrics, Histogram, Counter, Gauge } from '@prometheus-io/client';

/**
 * Registry unico dell'app. Tutte le metriche si registrano qui.
 */
export const registry = new Registry();

// Metriche di default: event loop lag, GC, heap, RSS, CPU, uptime.
// Sono standard e utili per il monitoring "system-level" del processo Node.
collectDefaultMetrics({
  register: registry,
  prefix: 'lookup_',
  // Custom labels globali (utile con multi-istanza)
  labels: {
    service: 'lookup-api',
    version: process.env.npm_package_version || 'unknown',
  },
});

// -----------------------------------------------------------------------------
// HTTP metrics
// -----------------------------------------------------------------------------

/**
 * Latency HTTP: distribuzione della durata delle request.
 * Esposto come histogram con buckets ottimizzati per web app tipica
 * (10ms a 5s). PromQL: `histogram_quantile(0.95, sum by(le,route)(
 *   rate(lookup_http_request_duration_seconds_bucket[5m])
 * ))` per p95 per endpoint.
 */
export const httpDuration = new Histogram({
  name: 'lookup_http_request_duration_seconds',
  help: 'Durata delle richieste HTTP in secondi',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/**
 * Contatore totale delle richieste HTTP (equivalente al RPS con rate()).
 * Ridondante con `_count` dell'histogram, ma piu' esplicito per dashboards.
 */
export const httpRequests = new Counter({
  name: 'lookup_http_requests_total',
  help: 'Totale richieste HTTP',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

// -----------------------------------------------------------------------------
// Business metrics — Lookup domain
// -----------------------------------------------------------------------------

/**
 * Prestiti creati (POST /api/books/:id/loan-requests success).
 * PromQL: `sum(rate(lookup_loans_created_total[1h])) * 3600` per prestiti/ora.
 */
export const loansCreated = new Counter({
  name: 'lookup_loans_created_total',
  help: 'Totale prestiti creati',
  registers: [registry],
});

/**
 * Transizioni di stato dei prestiti (accept, reject, borrowed, returned, ecc.).
 * Label `action` traccia il tipo di transizione.
 */
export const loansTransitions = new Counter({
  name: 'lookup_loans_transitions_total',
  help: 'Totale transizioni di stato dei prestiti',
  labelNames: ['action'],
  registers: [registry],
});

/**
 * Notifiche inviate, per canale (in-app, email, sse).
 * Utile per verificare la salute del sistema notifiche
 * (se email calano bruscamente, SMTP problema).
 */
export const notificationsSent = new Counter({
  name: 'lookup_notifications_sent_total',
  help: 'Totale notifiche inviate',
  labelNames: ['channel', 'type'],
  registers: [registry],
});

// -----------------------------------------------------------------------------
// Realtime metrics — SSE
// -----------------------------------------------------------------------------

/**
 * Connessioni SSE attive ADESSO (gauge, non counter).
 * Metrico chiave per capire l'engagement e il carico realtime.
 */
export const sseConnections = new Gauge({
  name: 'lookup_sse_active_connections',
  help: 'Connessioni SSE attualmente aperte',
  registers: [registry],
});

/**
 * Messaggi SSE pubblicati via Redis pub/sub.
 */
export const ssePublishes = new Counter({
  name: 'lookup_sse_publishes_total',
  help: 'Messaggi pubblicati su Redis pub/sub per SSE',
  labelNames: ['type'],
  registers: [registry],
});

// -----------------------------------------------------------------------------
// Background jobs — BullMQ
// -----------------------------------------------------------------------------

/**
 * Job BullMQ processati per queue e outcome.
 * PromQL: `sum by(queue)(rate(lookup_bull_jobs_processed_total{status="failed"}[5m]))`
 * per rate di failure per queue.
 */
export const bullJobsProcessed = new Counter({
  name: 'lookup_bull_jobs_processed_total',
  help: 'Job BullMQ processati',
  labelNames: ['queue', 'status'], // status: completed | failed
  registers: [registry],
});

/**
 * Durata processing job BullMQ (histogram).
 */
export const bullJobDuration = new Histogram({
  name: 'lookup_bull_job_duration_seconds',
  help: 'Durata processing dei job BullMQ in secondi',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
  registers: [registry],
});

/**
 * Size delle queue per stato (waiting/active/delayed/failed).
 * Aggiornato periodicamente (ogni 30s) da un timer nel bootstrap jobs.
 * PromQL: `lookup_bull_queue_size{state="failed"}` per allert su backlog.
 */
export const bullQueueSize = new Gauge({
  name: 'lookup_bull_queue_size',
  help: 'Numero di job in ogni stato per queue',
  labelNames: ['queue', 'state'],
  registers: [registry],
});

// -----------------------------------------------------------------------------
// Helper per instrumentazione servizi
// -----------------------------------------------------------------------------

/**
 * Istrumenta un handler BullMQ per registrare durata + outcome.
 * Wrappa il handler originale e aggiunge metriche automaticamente.
 *
 * @param {string} queueName
 * @param {(job: any, logger: any) => Promise<any>} handler
 */
export function instrumentJobHandler(queueName, handler) {
  return async (job, logger) => {
    const timer = bullJobDuration.labels(queueName).startTimer();
    try {
      const result = await handler(job, logger);
      bullJobsProcessed.labels(queueName, 'completed').inc();
      return result;
    } catch (err) {
      bullJobsProcessed.labels(queueName, 'failed').inc();
      throw err;
    } finally {
      timer();
    }
  };
}
