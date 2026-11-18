// =============================================================================
// src/jobs/worker.js — BullMQ worker bootstrap (Beta 7)
// =============================================================================
// Registra i worker che processano i job dalle queue definite in queue.js.
// Chiamato da app.js a startup (dietro flag env `JOBS_ENABLED`).
//
// PATTERN worker:
//   - Ogni queue ha un worker dedicato che chiama il suo handler
//   - Il handler riceve `(job, logger)` e ritorna un risultato serializzabile
//   - BullMQ salva il risultato per debugging/monitoring
//   - Se il handler throw, BullMQ ritenta con exponential backoff
//
// PATTERN concurrency:
//   - `concurrency: 1` sui job di batch (overdue-loans, retention purge):
//     non ha senso parallelizzare, meglio un'esecuzione seriale pulita
//   - In futuro (Beta 8+) job "per-user" (es. invio verify email) possono
//     avere concurrency > 1
//
// TEARDOWN: chiama `closeWorkers()` in shutdown per SIGTERM/SIGINT.
// =============================================================================

import { Worker } from 'bullmq';
import { makeConnection } from './queue.js';
import { processOverdueLoans } from './overdueLoans.js';
import { processRetentionPurge } from './retention.js';
import { processUpcomingDeadlines } from './upcomingDeadline.js';
import { instrumentJobHandler } from '../lib/metrics.js';

const workers = [];

/**
 * Avvia tutti i worker (idempotente: chiama una sola volta a startup).
 * @param {import('pino').Logger} logger
 */
export function startWorkers(logger) {
  const connection = makeConnection();

  // Beta 10: wrappa gli handler con instrumentazione metrics (durata + outcome)
  workers.push(
    new Worker(
      'overdue-loans',
      instrumentJobHandler('overdue-loans', async (job) =>
        processOverdueLoans(job, logger.child({ job: 'overdue-loans' }))
      ),
      { connection, concurrency: 1 }
    )
  );

  workers.push(
    new Worker(
      'retention',
      instrumentJobHandler('retention', async (job) =>
        processRetentionPurge(job, logger.child({ job: 'retention' }))
      ),
      { connection, concurrency: 1 }
    )
  );

  // Beta 7.1: pre-deadline reminder worker
  workers.push(
    new Worker(
      'upcoming-deadline',
      instrumentJobHandler('upcoming-deadline', async (job) =>
        processUpcomingDeadlines(job, logger.child({ job: 'upcoming-deadline' }))
      ),
      { connection, concurrency: 1 }
    )
  );

  // Error handler globali per non lasciare eccezioni non catturate
  for (const w of workers) {
    w.on('error', (err) => {
      logger.error({ err: err.message, worker: w.name }, '[worker] error');
    });
  }

  logger.info({ count: workers.length }, '[jobs] worker started');
}

/**
 * Cleanup worker in shutdown. Chiude anche la connessione Redis.
 */
export async function closeWorkers() {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
}
