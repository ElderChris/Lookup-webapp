// =============================================================================
// src/lib/accountEmails.js — Email sugli eventi dell'account
// =============================================================================

import { sendEmail } from './mailer.js';

/** Escape minimo per i valori inseriti nell'HTML delle email. */
export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/**
 * Conferma della cancellazione dell'account, inviata all'indirizzo che
 * l'account aveva.
 * @param {{ email: string, displayName: string }} user
 * @param {{ byAdmin?: boolean }} [opts]
 */
export async function sendAccountDeletedEmail(user, { byAdmin = false } = {}) {
  const who = byAdmin ? "dall'amministrazione di Lookup" : 'su tua richiesta';
  return sendEmail({
    to: user.email,
    subject: 'Account Lookup eliminato',
    text: `Ciao ${user.displayName || ''},\n\nil tuo account Lookup è stato eliminato ${who}, insieme ai dati collegati: profilo, volumi, prestiti e messaggi, recensioni e post.\n\nSe pensi che si tratti di un errore, contatta chi gestisce il servizio.`,
    html: `<p>Ciao ${escapeHtml(user.displayName)},</p>
           <p>il tuo account Lookup è stato eliminato ${who}, insieme ai dati collegati: profilo, volumi, prestiti e messaggi, recensioni e post.</p>
           <p>Se pensi che si tratti di un errore, contatta chi gestisce il servizio.</p>`,
  });
}
