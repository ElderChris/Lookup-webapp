// =============================================================================
// src/jobs/overdueLoans.js — Handler check prestiti scaduti (Beta 7)
// =============================================================================
// Job schedulato ogni ora che:
//   1. Trova loans in status='borrowed' con deadline < NOW() AND
//      reminder_sent_at IS NULL
//   2. Per ognuno: crea notifica in-app per requester + lender, invia email
//      di sollecito, marca reminder_sent_at = NOW()
//
// PRIMA (era in `app.js` frontend):
//   - Il check girava al DOMContentLoaded di OGNI pagina, per OGNI utente
//   - Se nessuno apriva l'app per giorni, i solleciti non partivano
//   - Nessuna email reale, solo notifica in-app visibile al prossimo login
//
// ADESSO (backend job):
//   - Check indipendente dall'attivita' utenti
//   - Email reali (Mailpit in dev, SMTP in prod)
//   - Single execution grazie al lock BullMQ (piu' istanze backend = OK)
//   - Se il job fallisce (SMTP giu'), BullMQ retry con exponential backoff
// =============================================================================

import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../lib/mailer.js';

/**
 * Handler principale del job. Processa TUTTI i loans overdue in una singola
 * transazione (best effort — se un send email fallisce, continua con gli altri).
 *
 * @param {import('bullmq').Job} job
 * @param {import('pino').Logger} logger
 * @returns {Promise<{scanned: number, remindersSent: number, errors: number}>}
 */
export async function processOverdueLoans(job, logger) {
  const stats = { scanned: 0, remindersSent: 0, errors: 0 };
  const now = new Date();

  // 1. Trova candidati (borrowed + deadline passata + no reminder ancora)
  const overdue = await prisma.loanRequest.findMany({
    where: {
      status: 'borrowed',
      deadline: { lt: now },
      reminderSentAt: null,
    },
    include: {
      book: { select: { id: true, title: true, author: true } },
      requester: { select: { id: true, email: true, displayName: true } },
      lender: { select: { id: true, email: true, displayName: true } },
    },
  });

  stats.scanned = overdue.length;
  logger.info({ count: overdue.length }, '[overdue] found candidates');

  // 2. Per ognuno: notifica in-app + email
  for (const loan of overdue) {
    try {
      const daysLate = Math.floor((now - loan.deadline) / (1000 * 60 * 60 * 24));

      await prisma.$transaction(async (tx) => {
        // Notifica al requester (deve restituire)
        await tx.notification.create({
          data: {
            userId: loan.requesterId,
            type: 'loan_overdue_borrower',
            actorId: loan.lenderId,
            bookId: loan.book.id,
            message: `"${loan.book.title}" doveva rientrare il ${loan.deadline.toLocaleDateString('it-IT')} (${daysLate} giorni fa). Contatta ${loan.lender.displayName} per organizzare la restituzione.`,
          },
        });
        // Notifica al lender (aspetta restituzione)
        await tx.notification.create({
          data: {
            userId: loan.lenderId,
            type: 'loan_overdue_lender',
            actorId: loan.requesterId,
            bookId: loan.book.id,
            message: `"${loan.book.title}" prestato a ${loan.requester.displayName} doveva rientrare il ${loan.deadline.toLocaleDateString('it-IT')} (${daysLate} giorni fa).`,
          },
        });
        // Marca reminder_sent_at (idempotenza: no doppio sollecito)
        await tx.loanRequest.update({
          where: { id: loan.id },
          data: { reminderSentAt: now },
        });
      });

      // Email al requester (best-effort — se fallisce, notifica in-app resta)
      await sendEmail({
        to: loan.requester.email,
        subject: `Lookup — Prestito in ritardo: "${loan.book.title}"`,
        text: buildBorrowerEmailText(loan, daysLate),
        html: buildBorrowerEmailHtml(loan, daysLate),
        logger,
      });
      await sendEmail({
        to: loan.lender.email,
        subject: `Lookup — Prestito in ritardo di ${loan.requester.displayName}`,
        text: buildLenderEmailText(loan, daysLate),
        html: buildLenderEmailHtml(loan, daysLate),
        logger,
      });

      stats.remindersSent++;
    } catch (err) {
      logger.error({ err: err.message, loanId: loan.id }, '[overdue] loan failed');
      stats.errors++;
    }
  }

  return stats;
}

// -----------------------------------------------------------------------------
// Template email (in dev arrivano a Mailpit; in prod SMTP reale)
// -----------------------------------------------------------------------------

function buildBorrowerEmailText(loan, days) {
  return `Ciao ${loan.requester.displayName},

il prestito di "${loan.book.title}" di ${loan.book.author} risulta in ritardo di ${days} giorni.
La deadline concordata era ${loan.deadline.toLocaleDateString('it-IT')}.

Ti chiediamo di contattare ${loan.lender.displayName} per organizzare la restituzione:
puoi rispondere a questa email o scrivere direttamente dalla pagina del prestito su Lookup.

Grazie per la comprensione,
il team di Lookup`;
}

function buildBorrowerEmailHtml(loan, days) {
  return `<p>Ciao <strong>${loan.requester.displayName}</strong>,</p>
<p>il prestito di <strong>"${loan.book.title}"</strong> di ${loan.book.author}
risulta in ritardo di <strong>${days} giorni</strong>.<br>
La deadline concordata era il <strong>${loan.deadline.toLocaleDateString('it-IT')}</strong>.</p>
<p>Ti chiediamo di contattare <strong>${loan.lender.displayName}</strong> per organizzare
la restituzione: puoi rispondere a questa email o scrivere direttamente dalla
pagina del prestito su Lookup.</p>
<p>Grazie per la comprensione,<br>il team di Lookup</p>`;
}

function buildLenderEmailText(loan, days) {
  return `Ciao ${loan.lender.displayName},

il libro "${loan.book.title}" che hai prestato a ${loan.requester.displayName}
risulta in ritardo di ${days} giorni (deadline: ${loan.deadline.toLocaleDateString('it-IT')}).

Abbiamo inviato un sollecito automatico anche a ${loan.requester.displayName.split(' ')[0]}.
Se hai gia' concordato una proroga, puoi ignorare questa notifica.

il team di Lookup`;
}

function buildLenderEmailHtml(loan, days) {
  return `<p>Ciao <strong>${loan.lender.displayName}</strong>,</p>
<p>il libro <strong>"${loan.book.title}"</strong> che hai prestato a
<strong>${loan.requester.displayName}</strong> risulta in ritardo di
<strong>${days} giorni</strong> (deadline: ${loan.deadline.toLocaleDateString('it-IT')}).</p>
<p>Abbiamo inviato un sollecito automatico anche a
${loan.requester.displayName.split(' ')[0]}.<br>
Se hai gia' concordato una proroga, puoi ignorare questa notifica.</p>
<p>il team di Lookup</p>`;
}
