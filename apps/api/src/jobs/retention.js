// =============================================================================
// src/jobs/retention.js — Retention policy audit log (Beta 7)
// =============================================================================
// Job schedulato ogni notte alle 3 AM che cancella le righe di
// `admin_audit_log` piu' vecchie di N mesi (default 12).
//
// PERCHE':
//   - Compliance GDPR: dati personali (ipAddress, userAgent) non possono
//     essere conservati indefinitamente senza motivo. 12 mesi e' un compromesso
//     ragionevole per audit di sicurezza + rispetto delle norme
//   - Costi storage: la tabella cresce ~1 riga per ogni azione admin. Su un
//     anno di operatività, aspettative decine di migliaia di righe. Purge
//     mantiene la tabella performante per le query "azioni recenti"
//   - Chiarezza operativa: la UI admin puo' documentare "log retention: 12 mesi"
//
// ALTERNATIVE VALUTATE:
//   - Anonimizzazione invece di delete: manterrebbe conteggio storico ma
//     con ipAddress/userAgent = null. Piu' complesso, guadagno marginale
//     per un'app di scala piccola. Rimandato a scenari con compliance stretta
//   - Aggregation: sostituire N righe con un summary. Overkill per un log
//     che cresce lentamente
//
// TUNING via env:
//   RETENTION_AUDIT_MONTHS=12  (default). Puoi mettere 6, 24, ecc.
// =============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Handler purge audit log oltre soglia.
 *
 * @param {import('bullmq').Job} job
 * @param {import('pino').Logger} logger
 * @returns {Promise<{cutoff: string, purged: number, retentionMonths: number}>}
 */
export async function processRetentionPurge(job, logger) {
  const months = Number(process.env.RETENTION_AUDIT_MONTHS || 12);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const result = await prisma.adminAuditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  logger.info(
    { purged: result.count, cutoff: cutoff.toISOString(), retentionMonths: months },
    '[retention] audit log purge completed'
  );

  return {
    cutoff: cutoff.toISOString(),
    purged: result.count,
    retentionMonths: months,
  };
}
