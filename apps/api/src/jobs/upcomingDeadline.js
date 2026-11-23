// =============================================================================
// src/jobs/upcomingDeadline.js — Reminder pre-scadenza T-N giorni
// =============================================================================
// Job schedulato ogni giorno alle 9:00 UTC che:
//   1. Trova loans in status='borrowed' con deadline in [now, now + N giorni]
//      AND pre_reminder_sent_at IS NULL
//   2. Per ognuno: crea notifica gentile (non allarmante) per requester +
//      lender, invia email di courtesy, marca pre_reminder_sent_at = NOW()
//
// DIFFERENZE dal job overdue-loans (che gestisce POST-scadenza):
//   - Overdue = punitivo, con conteggio giorni di ritardo
//   - Pre-deadline = corte, "il libro rientra tra N giorni, tutto ok?"
//   - Overdue si ripete se ripete l'overdue check (idempotente per loan
//     via reminderSentAt); pre-deadline scatta UNA sola volta per loan
//
// PARAMETRI (via env):
//   PRE_DEADLINE_DAYS=3       (default: 3 giorni prima della deadline)
//   PRE_DEADLINE_JOB_SCHEDULE='0 9 * * *' (ogni giorno alle 9 UTC)
//
// PERCHE' schedule diverso da overdue-loans:
//   - Overdue: ogni ora (piu' un utente aspetta il sollecito peggio e')
//   - Pre-deadline: una volta al giorno (nessuna urgenza, meglio di
//     mattina cosi' l'utente ha tempo di organizzarsi durante la giornata)
// =============================================================================

import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../lib/mailer.js';

/**
 * Handler pre-deadline reminder.
 *
 * @param {import('bullmq').Job} job
 * @param {import('pino').Logger} logger
 * @returns {Promise<{scanned: number, remindersSent: number, errors: number, windowDays: number}>}
 */
export async function processUpcomingDeadlines(job, logger) {
  const windowDays = Number(process.env.PRE_DEADLINE_DAYS || 3);
  const stats = { scanned: 0, remindersSent: 0, errors: 0, windowDays };

  const now = new Date();
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + windowDays);

  // Trova prestiti con deadline nei prossimi N giorni, non ancora notificati
  const candidates = await prisma.loanRequest.findMany({
    where: {
      status: 'borrowed',
      deadline: { gte: now, lte: windowEnd },
      preReminderSentAt: null,
    },
    include: {
      book: { select: { id: true, title: true, author: true } },
      requester: { select: { id: true, email: true, displayName: true } },
      lender: { select: { id: true, email: true, displayName: true } },
    },
  });

  stats.scanned = candidates.length;
  logger.info({ count: candidates.length, windowDays }, '[pre-deadline] found candidates');

  for (const loan of candidates) {
    try {
      const daysToDeadline = Math.max(1, Math.ceil((loan.deadline - now) / (1000 * 60 * 60 * 24)));

      await prisma.$transaction(async (tx) => {
        // Notifica courtesy al requester
        await tx.notification.create({
          data: {
            userId: loan.requesterId,
            type: 'loan_deadline_upcoming_borrower',
            actorId: loan.lenderId,
            bookId: loan.book.id,
            loanId: loan.id,
            message: `"${loan.book.title}" da restituire a ${loan.lender.displayName} tra ${daysToDeadline} ${daysToDeadline === 1 ? 'giorno' : 'giorni'} (${loan.deadline.toLocaleDateString('it-IT')}).`,
          },
        });
        // Notifica courtesy al lender
        await tx.notification.create({
          data: {
            userId: loan.lenderId,
            type: 'loan_deadline_upcoming_lender',
            actorId: loan.requesterId,
            bookId: loan.book.id,
            loanId: loan.id,
            message: `"${loan.book.title}" prestato a ${loan.requester.displayName} rientra tra ${daysToDeadline} ${daysToDeadline === 1 ? 'giorno' : 'giorni'} (${loan.deadline.toLocaleDateString('it-IT')}).`,
          },
        });
        // Idempotenza
        await tx.loanRequest.update({
          where: { id: loan.id },
          data: { preReminderSentAt: now },
        });
      });

      // Email al requester (best-effort)
      await sendEmail({
        to: loan.requester.email,
        subject: `Lookup — Promemoria: "${loan.book.title}" rientra tra ${daysToDeadline} ${daysToDeadline === 1 ? 'giorno' : 'giorni'}`,
        text: buildBorrowerEmailText(loan, daysToDeadline),
        html: buildBorrowerEmailHtml(loan, daysToDeadline),
        logger,
      });
      await sendEmail({
        to: loan.lender.email,
        subject: `Lookup — "${loan.book.title}" rientra tra ${daysToDeadline} ${daysToDeadline === 1 ? 'giorno' : 'giorni'}`,
        text: buildLenderEmailText(loan, daysToDeadline),
        html: buildLenderEmailHtml(loan, daysToDeadline),
        logger,
      });

      stats.remindersSent++;
    } catch (err) {
      logger.error({ err: err.message, loanId: loan.id }, '[pre-deadline] loan failed');
      stats.errors++;
    }
  }

  return stats;
}

// -----------------------------------------------------------------------------
// Template email (tono cortese, non allarmante)
// -----------------------------------------------------------------------------

function buildBorrowerEmailText(loan, days) {
  const dayLabel = days === 1 ? 'giorno' : 'giorni';
  return `Ciao ${loan.requester.displayName},

un piccolo promemoria: "${loan.book.title}" di ${loan.book.author}
va restituito a ${loan.lender.displayName} tra ${days} ${dayLabel},
il ${loan.deadline.toLocaleDateString('it-IT')}.

Se hai bisogno di piu' tempo, puoi contattare ${loan.lender.displayName.split(' ')[0]}
direttamente dalla pagina del prestito su Lookup per concordare una proroga.

Buona lettura,
il team di Lookup`;
}

function buildBorrowerEmailHtml(loan, days) {
  const dayLabel = days === 1 ? 'giorno' : 'giorni';
  return `<p>Ciao <strong>${loan.requester.displayName}</strong>,</p>
<p>un piccolo promemoria: <strong>"${loan.book.title}"</strong>
di ${loan.book.author} va restituito a
<strong>${loan.lender.displayName}</strong> tra <strong>${days} ${dayLabel}</strong>,
il <strong>${loan.deadline.toLocaleDateString('it-IT')}</strong>.</p>
<p>Se hai bisogno di piu' tempo, puoi contattare
${loan.lender.displayName.split(' ')[0]} direttamente dalla pagina del
prestito su Lookup per concordare una proroga.</p>
<p>Buona lettura,<br>il team di Lookup</p>`;
}

function buildLenderEmailText(loan, days) {
  const dayLabel = days === 1 ? 'giorno' : 'giorni';
  return `Ciao ${loan.lender.displayName},

il libro "${loan.book.title}" che hai prestato a ${loan.requester.displayName}
rientra tra ${days} ${dayLabel} (${loan.deadline.toLocaleDateString('it-IT')}).

Abbiamo mandato un promemoria anche a ${loan.requester.displayName.split(' ')[0]}.
Nessuna azione richiesta da parte tua, e' solo un heads-up.

il team di Lookup`;
}

function buildLenderEmailHtml(loan, days) {
  const dayLabel = days === 1 ? 'giorno' : 'giorni';
  return `<p>Ciao <strong>${loan.lender.displayName}</strong>,</p>
<p>il libro <strong>"${loan.book.title}"</strong> che hai prestato a
<strong>${loan.requester.displayName}</strong> rientra tra
<strong>${days} ${dayLabel}</strong>
(${loan.deadline.toLocaleDateString('it-IT')}).</p>
<p>Abbiamo mandato un promemoria anche a
${loan.requester.displayName.split(' ')[0]}. Nessuna azione richiesta da parte tua,
e' solo un heads-up.</p>
<p>il team di Lookup</p>`;
}
