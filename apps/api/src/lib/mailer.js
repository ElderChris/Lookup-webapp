// =============================================================================
// src/lib/mailer.js — SMTP transport condiviso (Beta 7)
// =============================================================================
// Wrapper unico per invio email dell'app. Nato in Fase 3.1 dentro auth.js per
// le email di Better Auth (verify, reset password). Beta 7 lo estrae come
// modulo indipendente perche' i job BullMQ (overdue loans reminder, ecc.)
// hanno bisogno di inviare email fuori dal contesto Better Auth.
//
// In dev: SMTP verso MailHog (http://localhost:8025 UI).
// In prod: SMTP reale (Resend, SES, Postmark, ecc.) via env var.
//
// Fail-safe: se SMTP giu', log warning + procedi. Non vogliamo che un job
// di reminder fallisca perche' MailHog e' spento in dev.
// =============================================================================

import nodemailer from 'nodemailer';

export const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
  ignoreTLS: true, // MailHog non ha TLS
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

const FROM_DEFAULT = process.env.SMTP_FROM || 'Lookup <no-reply@lookup.local>';

/**
 * Invia una email con gestione errori best-effort.
 * Se SMTP e' irraggiungibile, log warning e ritorna { ok: false }.
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.text
 * @param {string} [opts.html]
 * @param {string} [opts.from]
 * @param {object} [opts.logger] - pino logger opzionale
 * @returns {Promise<{ok: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail({ to, subject, text, html, from, logger }) {
  try {
    const info = await smtpTransport.sendMail({
      from: from || FROM_DEFAULT,
      to,
      subject,
      text,
      html,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    logger?.warn({ err: err.message, to, subject }, '[mailer] send failed');
    return { ok: false, error: err.message };
  }
}
