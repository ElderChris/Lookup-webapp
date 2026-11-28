// =============================================================================
// src/lib/availabilityEmails.js — Volume di nuovo disponibile
// =============================================================================
// Email a chi ha messo "mi piace" a un volume quando torna disponibile (fine
// di un prestito). Insieme alla notifica nell'app: vedi
// services/notifications.js, notifyBookAvailable().
// =============================================================================

import { sendEmail } from './mailer.js';
import { escapeHtml } from './accountEmails.js';
import { DEFAULT_WEB_ORIGIN } from './authLinks.js';

/**
 * @param {{ email: string, displayName: string }} user
 * @param {{ id: number, title: string, author: string }} book
 * @param {string} ownerName
 * @param {object} [logger]
 */
export function sendBookAvailableEmail(user, book, ownerName, logger) {
  const url = `${DEFAULT_WEB_ORIGIN}/book-detail.html?id=${book.id}`;
  return sendEmail({
    to: user.email,
    subject: `Lookup — "${book.title}" è di nuovo disponibile`,
    text:
      `Ciao ${user.displayName || ''},\n\n` +
      `"${book.title}" di ${book.author}, a cui hai messo «mi piace», è di nuovo disponibile ` +
      `nella libreria di ${ownerName}. Se ti interessa, puoi chiederlo in prestito da qui:\n${url}\n\n` +
      `Ricevi questa email perché hai messo «mi piace» al volume: per non riceverne altre su questo libro, toglilo dalla sua pagina.`,
    html:
      `<p>Ciao ${escapeHtml(user.displayName)},</p>` +
      `<p><strong>${escapeHtml(book.title)}</strong> di ${escapeHtml(book.author)}, a cui hai messo «mi piace», ` +
      `è di nuovo disponibile nella libreria di ${escapeHtml(ownerName)}.</p>` +
      `<p><a href="${url}">Apri il volume e chiedilo in prestito</a></p>` +
      `<p style="color:#666;font-size:.9em">Ricevi questa email perché hai messo «mi piace» al volume: ` +
      `per non riceverne altre su questo libro, toglilo dalla sua pagina.</p>`,
    logger,
  });
}
