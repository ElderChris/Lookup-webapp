// =============================================================================
// src/jobs/queue.js — BullMQ queue setup (Beta 7)
// =============================================================================
// Infrastruttura per background jobs. Ogni tipo di job vive in una queue
// dedicata (permette rate limit / priority / retry policy separate).
//
// Le queue registrate qui:
//   - `overdue-loans` — controllo prestiti scaduti + reminder
//   - `retention` — purge audit log > 12 mesi
//
// PATTERN DI USO:
//   1. Il modulo `queue.js` esporta le queue instances (per aggiungere job)
//   2. Il modulo `worker.js` registra i worker che processano i job
//   3. `app.js` chiama `bootstrapJobs()` a startup per lanciare i worker
//      + inserire i job "ricorrenti" (repeat schedule)
//
// PERCHE' BULLMQ (invece di node-cron):
//   - Persistente: se il processo crasha, i job vengono ritentati
//   - Distributed: piu' istanze backend condividono la stessa queue Redis
//     (un solo worker esegue ogni job — lock a livello Redis)
//   - Retry con exponential backoff su failure
//   - Delayed jobs (utile per reminder pre-scadenza in futuro)
//   - Dashboard Bull Board (Beta 8+) per monitoring
// =============================================================================

import { Queue, QueueEvents } from 'bullmq';
import { config } from '../config.js';

/**
 * Connessione Redis condivisa tra queue + worker.
 * BullMQ richiede `maxRetriesPerRequest: null` per stability delle blocking commands.
 */
export function makeConnection() {
  const url = new URL(config.redis.url);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

const connection = makeConnection();

// -----------------------------------------------------------------------------
// Queue instances (esportate per addJob / repeat scheduling)
// -----------------------------------------------------------------------------

/** Overdue loans check — genera reminder + notifiche + email */
export const overdueLoansQueue = new Queue('overdue-loans', { connection });

/** Retention policy — purge audit log oltre soglia */
export const retentionQueue = new Queue('retention', { connection });

/** Beta 7.1: Upcoming deadline — reminder T-N giorni pre-scadenza */
export const upcomingDeadlineQueue = new Queue('upcoming-deadline', { connection });

// -----------------------------------------------------------------------------
// QueueEvents: listener per il logging centrale
// -----------------------------------------------------------------------------

/**
 * Setup listener globali per tracing dei job. Chiamato una volta a startup.
 * @param {import('pino').Logger} logger
 */
export function attachQueueEvents(logger) {
  const queues = ['overdue-loans', 'retention', 'upcoming-deadline'];
  const listeners = [];
  for (const name of queues) {
    const events = new QueueEvents(name, { connection });
    events.on('completed', ({ jobId }) => {
      logger.info({ queue: name, jobId }, '[job] completed');
    });
    events.on('failed', ({ jobId, failedReason }) => {
      logger.warn({ queue: name, jobId, reason: failedReason }, '[job] failed');
    });
    listeners.push(events);
  }
  return listeners;
}

// -----------------------------------------------------------------------------
// Configurazione dei "repeat jobs" (ricorrenti)
// -----------------------------------------------------------------------------

/**
 * Registra i job ricorrenti nelle queue. Idempotente: BullMQ deduplica
 * usando il repeat key. Puoi chiamare questa funzione ad ogni startup.
 */
export async function registerRecurringJobs(logger) {
  // Overdue loans: ogni ora
  // In dev possiamo alzarlo a ogni 5 minuti per test rapido — configurabile
  const overdueSchedule = process.env.OVERDUE_JOB_SCHEDULE || '0 * * * *';
  await overdueLoansQueue.add(
    'check-overdue-loans',
    {},
    {
      repeat: { pattern: overdueSchedule },
      removeOnComplete: 50, // tieni gli ultimi 50 in history
      removeOnFail: 100,
    }
  );
  logger.info({ schedule: overdueSchedule }, '[jobs] overdue-loans scheduled');

  // Retention purge: ogni notte alle 3:00 AM UTC
  const retentionSchedule = process.env.RETENTION_JOB_SCHEDULE || '0 3 * * *';
  await retentionQueue.add(
    'purge-audit-log',
    {},
    {
      repeat: { pattern: retentionSchedule },
      removeOnComplete: 30,
      removeOnFail: 100,
    }
  );
  logger.info({ schedule: retentionSchedule }, '[jobs] retention scheduled');

  // Beta 7.1: Upcoming deadline reminder — ogni mattina alle 9:00 UTC
  // Frequenza giornaliera (non oraria come overdue): il pre-reminder e'
  // cortese, non urgente, meglio arrivare una volta al mattino.
  const upcomingSchedule = process.env.PRE_DEADLINE_JOB_SCHEDULE || '0 9 * * *';
  await upcomingDeadlineQueue.add(
    'notify-upcoming-deadlines',
    {},
    {
      repeat: { pattern: upcomingSchedule },
      removeOnComplete: 30,
      removeOnFail: 100,
    }
  );
  logger.info({ schedule: upcomingSchedule }, '[jobs] upcoming-deadline scheduled');
}

/**
 * Cleanup risorse queue in shutdown.
 */
export async function closeQueues() {
  await Promise.all([
    overdueLoansQueue.close(),
    retentionQueue.close(),
    upcomingDeadlineQueue.close(),
  ]);
}

// -----------------------------------------------------------------------------
// Beta 10: refresh periodico gauge bull_queue_size per Prometheus
// -----------------------------------------------------------------------------
// I gauge devono essere aggiornati periodicamente perche' Prometheus scrapa
// il valore attuale al momento dello scrape. Un timer ogni 30s legge lo stato
// di ogni queue e aggiorna le gauge.

let _queueSizeTimer = null;

/**
 * Avvia il polling periodico delle dimensioni delle queue.
 * Chiamato da app.js dopo la registrazione dei job.
 */
export async function startQueueSizePolling() {
  const { bullQueueSize } = await import('../lib/metrics.js');
  const queues = {
    'overdue-loans': overdueLoansQueue,
    retention: retentionQueue,
    'upcoming-deadline': upcomingDeadlineQueue,
  };
  const STATES = ['waiting', 'active', 'completed', 'failed', 'delayed'];

  const poll = async () => {
    try {
      for (const [name, queue] of Object.entries(queues)) {
        const counts = await queue.getJobCounts(...STATES);
        for (const state of STATES) {
          bullQueueSize.labels(name, state).set(counts[state] || 0);
        }
      }
    } catch (err) {
      console.warn('[metrics] queue size polling failed:', err.message);
    }
  };

  await poll(); // primo run immediato
  _queueSizeTimer = setInterval(poll, 30_000);
}

/**
 * Ferma il polling (a shutdown).
 */
export function stopQueueSizePolling() {
  if (_queueSizeTimer) {
    clearInterval(_queueSizeTimer);
    _queueSizeTimer = null;
  }
}
