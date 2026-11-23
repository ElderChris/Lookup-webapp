// =============================================================================
// src/lib/mailer.js — SMTP transport condiviso
// =============================================================================
// Wrapper unico per invio email dell'app. Usato da auth.js per
// le email di Better Auth (verifica, reset password) ed estratto come
// modulo indipendente perche' i job BullMQ (overdue loans reminder, ecc.)
// hanno bisogno di inviare email fuori dal contesto Better Auth.
//
// In dev: SMTP verso Mailpit (http://localhost:8025 UI), con STARTTLS e
// credenziali come in produzione.
// In prod: SMTP reale (Resend, SES, Postmark, ecc.) via env var.
//
// Fail-safe: se SMTP giu', log warning + procedi. Non vogliamo che un job
// di reminder fallisca perche' Mailpit e' spento in dev.
// =============================================================================

import nodemailer from 'nodemailer';

// -----------------------------------------------------------------------------
// Configurazione SMTP
// -----------------------------------------------------------------------------
// Stesse regole in sviluppo e in produzione: la connessione e' sempre
// cifrata, cambia solo il server. In sviluppo Mailpit offre STARTTLS con un
// certificato autofirmato e chiede le credenziali, come un provider reale.
//
//   SMTP_HOST, SMTP_PORT        server (default localhost:1025, Mailpit)
//   SMTP_USER, SMTP_PASS        credenziali (facoltative, ma in coppia)
//   SMTP_SECURE                 true = TLS implicito (porta 465). Default:
//                               true solo se la porta e' 465
//   SMTP_REQUIRE_TLS            con SMTP_SECURE=false impone STARTTLS: se il
//                               server non lo offre l'invio fallisce invece di
//                               partire in chiaro. Default: true
//   SMTP_TLS_VERIFY             verifica del certificato del server. Default:
//                               true. false solo per server di prova con
//                               certificato autofirmato (Mailpit)
//   SMTP_FROM                   mittente
// -----------------------------------------------------------------------------

function flag(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

/**
 * Traduce le variabili d'ambiente nelle opzioni di nodemailer.
 * Funzione pura, esportata per i test.
 */
export function buildSmtpOptions(env = process.env) {
  const port = Number(env.SMTP_PORT || 1025);
  const secure = flag(env.SMTP_SECURE, port === 465);
  const user = env.SMTP_USER || '';
  const pass = env.SMTP_PASS || '';
  if (Boolean(user) !== Boolean(pass)) {
    throw new Error('SMTP: SMTP_USER e SMTP_PASS vanno impostati insieme');
  }
  return {
    host: env.SMTP_HOST || 'localhost',
    port,
    secure,
    // Mai ignoreTLS: con STARTTLS obbligatorio le credenziali non passano
    // in chiaro nemmeno se un intermediario toglie STARTTLS dalla risposta.
    requireTLS: secure ? false : flag(env.SMTP_REQUIRE_TLS, true),
    auth: user ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: flag(env.SMTP_TLS_VERIFY, true),
      minVersion: 'TLSv1.2',
    },
  };
}

const smtpOptions = buildSmtpOptions();

export const smtpTransport = nodemailer.createTransport(smtpOptions);

export const SMTP_FROM = process.env.SMTP_FROM || 'Lookup <no-reply@lookup.local>';

/**
 * Riepilogo della configurazione per il log di avvio (senza password) e
 * avvisi sulle impostazioni non adatte alla produzione.
 */
export function describeSmtpConfig(options = smtpOptions) {
  const warnings = [];
  if (!options.tls.rejectUnauthorized) {
    warnings.push('verifica del certificato disattivata (SMTP_TLS_VERIFY=false): solo per Mailpit');
  }
  if (!options.secure && !options.requireTLS) {
    warnings.push(
      'STARTTLS non obbligatorio (SMTP_REQUIRE_TLS=false): le email possono partire in chiaro'
    );
  }
  if (!options.auth) warnings.push('nessuna credenziale SMTP');
  return {
    summary: {
      host: options.host,
      port: options.port,
      tls: options.secure
        ? 'implicito'
        : options.requireTLS
          ? 'STARTTLS obbligatorio'
          : 'STARTTLS se disponibile',
      user: options.auth?.user ?? null,
      verifyCertificate: options.tls.rejectUnauthorized,
    },
    warnings,
  };
}

/**
 * Controllo all'avvio: connessione, TLS e credenziali. Non blocca l'avvio
 * (l'invio e' best-effort), ma scrive nel log se qualcosa non va.
 */
export async function checkSmtp(logger) {
  const { summary, warnings } = describeSmtpConfig();
  logger.info({ smtp: summary }, '[mailer] configurazione SMTP');
  for (const w of warnings) logger.warn(`[mailer] ${w}`);
  try {
    await smtpTransport.verify();
    logger.info(
      smtpOptions.auth
        ? '[mailer] server SMTP raggiungibile: TLS e credenziali OK'
        : '[mailer] server SMTP raggiungibile: TLS OK'
    );
  } catch (err) {
    logger.warn({ err: err.message }, '[mailer] verifica SMTP fallita: le email non partiranno');
  }
}

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
      from: from || SMTP_FROM,
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
