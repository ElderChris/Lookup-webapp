// =============================================================================
// src/services/notifications.js
// =============================================================================
// Helper centralizzati per emettere notifiche dagli endpoint che generano
// eventi. Pattern: ogni funzione fa una scrittura su `notifications` table
// e ritorna void. Errori loggati ma NON propagati (non-blocking): se la
// creazione della notifica fallisce, l'azione principale non deve fallire
// a cascata.
//
// dopo la persistenza in DB, ogni notifica viene pubblicata sul
// pub/sub Redis via publishToUser() → i client connessi via SSE ricevono
// l'evento in tempo reale (badge aggiornato + toast senza refresh).
//
// Tipi di notifica supportati (max 20 char per `type`):
//   - new_follower
//   - new_review
//   - loan_requested
//   - loan_accepted | loan_rejected | loan_cancelled
//   - loan_borrowed | loan_returning | loan_returned
//   - loan_message
//   - post_reaction
//   - book_available (volume con il proprio "mi piace" di nuovo disponibile)
//
// Convenzione: la notifica appartiene al destinatario (userId = chi la riceve).
// Il campo `actorId` è chi ha generato l'evento.
// =============================================================================

import { publishToUser } from '../lib/eventBus.js';
import { notificationsSent } from '../lib/metrics.js';
import { sendBookAvailableEmail } from '../lib/availabilityEmails.js';

/**
 * Helper bassissimo livello: crea una notifica.
 * Non-blocking: se fallisce, logga warn e ritorna null (non throw).
 *
 * dopo la persistenza pubblica anche via SSE (fire-and-forget).
 *
 * @param {object} ctx - { prisma, log }
 * @param {object} data - { userId, type, actorId?, bookId?, loanId?, message }
 */
async function emit(ctx, data) {
  try {
    if (data.userId === data.actorId) {
      // Non notificare se l'attore è il destinatario stesso (auto-azioni)
      return null;
    }
    const notif = await ctx.prisma.notification.create({ data });

    // metrics — traccia notifiche in-app persistite
    notificationsSent.labels('in_app', data.type || 'unknown').inc();

    // broadcast realtime via SSE.
    // Fire-and-forget: non aspettiamo il publish per non rallentare
    // l'endpoint principale. Se pub/sub e' giu', il client riceve
    // comunque la notifica al prossimo GET /api/me/notifications.
    publishToUser(data.userId, {
      type: 'notification',
      data: {
        id: notif.id,
        type: notif.type,
        actorId: notif.actorId,
        bookId: notif.bookId,
        loanId: notif.loanId,
        message: notif.message,
        createdAt: notif.createdAt.toISOString(),
      },
    }).catch((err) => {
      ctx.log.warn({ err: err.message }, '[notifications] SSE publish failed');
    });

    return notif;
  } catch (err) {
    ctx.log.warn({ err: err.message, data }, 'notification emission failed');
    return null;
  }
}

// =============================================================================
// API pubblica: helper per ogni tipo di evento
// =============================================================================

/**
 * Notifica che `actor` ha iniziato a seguire `followed`.
 */
export async function notifyNewFollower(ctx, { actorId, followedId, actorDisplayName }) {
  return emit(ctx, {
    userId: followedId,
    actorId,
    type: 'new_follower',
    message: `${actorDisplayName} ha iniziato a seguirti`,
  });
}

/**
 * Notifica nuova recensione ricevuta.
 */
export async function notifyNewReview(
  ctx,
  { reviewerId, targetUserId, rating, reviewerDisplayName }
) {
  return emit(ctx, {
    userId: targetUserId,
    actorId: reviewerId,
    type: 'new_review',
    message: `${reviewerDisplayName} ti ha recensito (${rating}/5)`,
  });
}

/**
 * Notifica al lender: nuova richiesta di prestito sui suoi libri.
 */
export async function notifyLoanRequested(
  ctx,
  { requesterId, lenderId, bookId, loanId, bookTitle, requesterDisplayName }
) {
  return emit(ctx, {
    userId: lenderId,
    actorId: requesterId,
    bookId,
    loanId,
    type: 'loan_requested',
    message: `${requesterDisplayName} ha richiesto in prestito "${bookTitle}"`,
  });
}

/**
 * Notifica cambio di stato del prestito al "destinatario" della transizione.
 *
 * Esempio: l'azione "accept" è fatta dal lender → il destinatario della
 * notifica è il requester (che vede "il tuo prestito è stato accettato").
 *
 * @param {object} args
 * @param {string} args.action - accept|reject|cancel|mark_borrowed|mark_returning|mark_returned
 * @param {number} args.actorId - chi ha eseguito l'azione
 * @param {number} args.recipientId - chi riceve la notifica
 * @param {number} args.bookId
 * @param {string} args.bookTitle
 * @param {string} args.actorDisplayName
 */
export async function notifyLoanStatusChange(
  ctx,
  { action, actorId, recipientId, bookId, loanId, bookTitle, actorDisplayName }
) {
  const TYPE_MAP = {
    accept: {
      type: 'loan_accepted',
      msg: `${actorDisplayName} ha accettato la richiesta per "${bookTitle}"`,
    },
    reject: {
      type: 'loan_rejected',
      msg: `${actorDisplayName} ha rifiutato la richiesta per "${bookTitle}"`,
    },
    cancel: {
      type: 'loan_cancelled',
      msg: `${actorDisplayName} ha annullato il prestito per "${bookTitle}"`,
    },
    mark_borrowed: {
      type: 'loan_borrowed',
      msg: `${actorDisplayName} ha consegnato "${bookTitle}". Buona lettura!`,
    },
    mark_returning: {
      type: 'loan_returning',
      msg: `${actorDisplayName} sta per restituire "${bookTitle}"`,
    },
    mark_returned: {
      type: 'loan_returned',
      msg: `${actorDisplayName} ha confermato la restituzione di "${bookTitle}"`,
    },
  };
  const cfg = TYPE_MAP[action];
  if (!cfg) return null;

  return emit(ctx, {
    userId: recipientId,
    actorId,
    bookId,
    loanId,
    type: cfg.type,
    message: cfg.msg,
  });
}

/**
 * Notifica nuovo messaggio nel thread di un prestito.
 */
export async function notifyNewLoanMessage(
  ctx,
  { senderId, recipientId, loanId, bookTitle, senderDisplayName, preview }
) {
  const previewTrimmed = preview.length > 80 ? preview.slice(0, 77) + '...' : preview;
  return emit(ctx, {
    userId: recipientId,
    actorId: senderId,
    loanId,
    type: 'loan_message',
    message: `${senderDisplayName} ha scritto su "${bookTitle}": ${previewTrimmed}`,
  });
}

/**
 * Notifica reaction su un proprio post.
 */
export async function notifyPostReaction(
  ctx,
  { reactorId, authorId, emoji, reactorDisplayName, postPreview }
) {
  const previewTrimmed = postPreview.length > 60 ? postPreview.slice(0, 57) + '...' : postPreview;
  return emit(ctx, {
    userId: authorId,
    actorId: reactorId,
    type: 'post_reaction',
    message: `${reactorDisplayName} ha reagito con ${emoji} al tuo post: "${previewTrimmed}"`,
  });
}

/**
 * Un volume torna disponibile (prestito restituito): notifica nell'app ed
 * email a chi gli ha messo "mi piace", tranne il proprietario e chi lo
 * aveva in prestito. Niente avvisi se il volume non e' pubblicato o se il
 * proprietario ha messo in pausa i prestiti.
 * Non bloccante: le email partono dopo la risposta.
 *
 * @param {object} ctx - { prisma, log }
 * @param {{ bookId: number, excludeUserIds?: string[] }} args
 */
export async function notifyBookAvailable(ctx, { bookId, excludeUserIds = [] }) {
  try {
    const book = await ctx.prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        title: true,
        author: true,
        status: true,
        available: true,
        ownerId: true,
        owner: { select: { displayName: true, status: true, acceptsLoans: true } },
        likes: {
          where: { user: { status: 'active' } },
          select: { user: { select: { id: true, email: true, displayName: true } } },
        },
      },
    });
    if (
      !book ||
      !book.available ||
      book.status !== 'active' ||
      book.owner.status !== 'active' ||
      !book.owner.acceptsLoans
    ) {
      return 0;
    }
    const skip = new Set([book.ownerId, ...excludeUserIds]);
    const likers = book.likes.map((l) => l.user).filter((u) => !skip.has(u.id));
    for (const user of likers) {
      await emit(ctx, {
        userId: user.id,
        actorId: book.ownerId,
        bookId: book.id,
        type: 'book_available',
        message: `"${book.title}" è di nuovo disponibile nella libreria di ${book.owner.displayName}`,
      });
    }
    // Email dopo la risposta all'utente che ha confermato la restituzione
    setImmediate(() => {
      Promise.allSettled(
        likers.map((u) => sendBookAvailableEmail(u, book, book.owner.displayName, ctx.log))
      ).then((results) => {
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed) ctx.log.warn({ bookId, failed }, '[notifications] book_available email failed');
      });
    });
    return likers.length;
  } catch (err) {
    ctx.log.warn({ err: err.message, bookId }, 'book_available notification failed');
    return 0;
  }
}
