// =============================================================================
// src/jobs/retention.js — Conservazione dei dati
// =============================================================================
// Job notturno (alle 3 UTC) che cancella cio' che non va conservato oltre:
//   - log delle azioni admin dopo 12 mesi (contiene IP e browser)
//   - iscrizioni mai confermate dopo 30 giorni
//   - sessioni e token di verifica scaduti
// I periodi si cambiano con RETENTION_AUDIT_MONTHS e RETENTION_PENDING_DAYS
// e sono quelli dichiarati nell'informativa privacy.
// =============================================================================

import { prisma } from '../lib/prisma.js';

/**
 * Pulizia notturna dei dati scaduti:
 *  - voci del log admin piu' vecchie di RETENTION_AUDIT_MONTHS (12 mesi)
 *  - iscrizioni mai confermate piu' vecchie di RETENTION_PENDING_DAYS
 *    (30 giorni): account e volumi inseriti all'iscrizione
 *  - sessioni e token di verifica scaduti
 *
 * @param {import('bullmq').Job} job
 * @param {import('pino').Logger} logger
 */
export async function processRetentionPurge(job, logger) {
  const months = Number(process.env.RETENTION_AUDIT_MONTHS || 12);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const pendingDays = Number(process.env.RETENTION_PENDING_DAYS || 30);
  const pendingCutoff = new Date(Date.now() - pendingDays * 24 * 3600 * 1000);
  const now = new Date();

  const [audit, pending, sessions, verifications] = await prisma.$transaction([
    prisma.adminAuditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.user.deleteMany({
      where: { status: 'pending', emailVerified: false, createdAt: { lt: pendingCutoff } },
    }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);

  logger.info(
    {
      purged: audit.count,
      pendingAccounts: pending.count,
      expiredSessions: sessions.count,
      expiredVerifications: verifications.count,
      cutoff: cutoff.toISOString(),
      retentionMonths: months,
      pendingDays,
    },
    '[retention] purge completed'
  );

  return {
    cutoff: cutoff.toISOString(),
    purged: audit.count,
    retentionMonths: months,
    pendingAccounts: pending.count,
    pendingDays,
    expiredSessions: sessions.count,
    expiredVerifications: verifications.count,
  };
}
