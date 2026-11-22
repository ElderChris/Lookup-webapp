// =============================================================================
// src/lib/auth.js — Better Auth setup
// =============================================================================
// Configurazione centrale di Better Auth con:
//   - Prisma adapter (Postgres)
//   - Email/password provider abilitato
//   - Verifica email obbligatoria per accedere e reset password (SMTP)
//   - Session cookie httpOnly (sliding window 7 giorni)
//   - Additional fields per il nostro schema User custom
//     (username, displayName, bio, city, lat, lng, accountType, ecc.)
//
// Better Auth espone `auth.handler(request)` (Web API standard) che il
// plugin Fastify in `src/lib/authFastify.js` mount-a su /api/auth/*.
// =============================================================================

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './prisma.js';
import { smtpTransport, SMTP_FROM } from './mailer.js';
import {
  TRUSTED_WEB_ORIGINS,
  DEFAULT_WEB_ORIGIN,
  verifyEmailLink,
  resetPasswordLink,
} from './authLinks.js';

/** Escape minimo per i valori inseriti nell'HTML delle email. */
function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

async function sendMail({ to, subject, text, html }) {
  try {
    await smtpTransport.sendMail({ from: SMTP_FROM, to, subject, text, html });
    console.info(`[auth] email inviata a ${to}: "${subject}"`);
  } catch (err) {
    console.error(`[auth] errore invio email a ${to}:`, err.message);
    // In dev NON facciamo throw — il flow di verify/reset resta usable
    // controllando Mailpit manualmente. In prod si preferirebbe fallire.
  }
}

// -----------------------------------------------------------------------------
// Better Auth instance
// -----------------------------------------------------------------------------
export const auth = betterAuth({
  // -- Persistenza -----------------------------------------------------------
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // -- Segreto per firma cookie (env-driven) ---------------------------------
  secret: process.env.BETTER_AUTH_SECRET || 'CHANGE-ME-IN-PRODUCTION-32chars-min-DEV-only',

  // -- URL base app (usato in URL email di verify/reset) ---------------------
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',

  // -- Email/password provider -----------------------------------------------
  // Si entra solo dopo aver confermato l'email. L'iscrizione passa da
  // POST /api/register (routes/register.js), che crea l'account senza
  // sessione; la sessione nasce quando l'utente apre il link di verifica.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
    requireEmailVerification: true,

    sendResetPassword: async ({ user, url, token }) => {
      const link = resetPasswordLink(url, token);
      await sendMail({
        to: user.email,
        subject: 'Reimposta la password — Lookup',
        text: `Ciao ${user.name || ''},\n\nabbiamo ricevuto una richiesta di reimpostare la password del tuo account Lookup. Per sceglierne una nuova apri questo link:\n${link}\n\nIl link scade fra un'ora. Se non sei stato tu, ignora questa email: la password resta quella di prima.`,
        html: `<p>Ciao ${esc(user.name)},</p>
               <p>abbiamo ricevuto una richiesta di reimpostare la password del tuo account Lookup.</p>
               <p><a href="${esc(link)}">Scegli una nuova password</a></p>
               <p>Il link scade fra un'ora. Se non sei stato tu, ignora questa email: la password resta quella di prima.</p>`,
      });
    },

    // Iscrizione con un'email gia' registrata: la risposta resta identica a
    // quella di una nuova iscrizione (cosi' non si scopre chi e' iscritto) e
    // il titolare dell'indirizzo riceve un avviso.
    onExistingUserSignUp: async ({ user }) => {
      const login = new URL('/login.html', DEFAULT_WEB_ORIGIN).toString();
      const reset = new URL('/reset-password.html', DEFAULT_WEB_ORIGIN).toString();
      await sendMail({
        to: user.email,
        subject: 'Hai già un account Lookup',
        text: `Ciao ${user.name || ''},\n\nqualcuno ha provato a creare un account Lookup con questo indirizzo email, che risulta già registrato.\n\nSe eri tu, accedi da ${login}\nSe non ricordi la password, reimpostala da ${reset}\n\nSe non sei stato tu, puoi ignorare questa email.`,
        html: `<p>Ciao ${esc(user.name)},</p>
               <p>qualcuno ha provato a creare un account Lookup con questo indirizzo email, che risulta già registrato.</p>
               <p>Se eri tu, <a href="${esc(login)}">accedi</a>; se non ricordi la password, <a href="${esc(reset)}">reimpostala</a>.</p>
               <p>Se non sei stato tu, puoi ignorare questa email.</p>`,
      });
    },
  },

  // -- Verifica email --------------------------------------------------------
  emailVerification: {
    sendOnSignUp: true,
    // Il nuovo invio lo chiede l'utente dalla pagina di accesso o da
    // "Controlla la tua email", non parte a ogni tentativo di accesso.
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 ore
    sendVerificationEmail: async ({ user, url, token }) => {
      const link = verifyEmailLink(url, token);
      await sendMail({
        to: user.email,
        subject: 'Conferma la tua email — Lookup',
        text: `Ciao ${user.name || ''},\n\nbenvenuto in Lookup! Per attivare il tuo account conferma l'indirizzo email aprendo questo link:\n${link}\n\nIl link scade fra 24 ore. Se non ti sei iscritto tu, ignora questa email.`,
        html: `<p>Ciao ${esc(user.name)},</p>
               <p>benvenuto in Lookup! Per attivare il tuo account conferma l'indirizzo email.</p>
               <p><a href="${esc(link)}">Conferma l'email</a></p>
               <p>Il link scade fra 24 ore. Se non ti sei iscritto tu, ignora questa email.</p>`,
      });
    },
    // Email confermata: l'account diventa attivo e i volumi inseriti
    // all'iscrizione vengono pubblicati
    afterEmailVerification: async (user) => {
      await prisma.$transaction([
        prisma.user.updateMany({
          where: { id: user.id, status: 'pending' },
          data: { status: 'active' },
        }),
        prisma.book.updateMany({
          where: { ownerId: user.id, status: 'pending_email' },
          data: { status: 'active' },
        }),
      ]);
    },
  },

  // -- Session config --------------------------------------------------------
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 giorni
    updateAge: 60 * 60 * 24, // refresh giornaliero (sliding window)
    cookieCache: {
      enabled: true, // cache in cookie firmato (evita lookup DB ad ogni request)
      maxAge: 5 * 60, // 5 minuti
    },
  },

  // -- Custom fields del nostro User model -----------------------------------
  // Better Auth di default vuole: id, email, emailVerified, name, image,
  // createdAt, updatedAt. Il resto va in additionalFields con mapping esplicito.
  user: {
    modelName: 'user',
    // Con l'adapter Prisma la mappatura usa i nomi dei CAMPI del modello
    // Prisma, non delle colonne: e' Prisma a tradurli in display_name e
    // avatar_url tramite @map. Better Auth 1.7 verifica lo schema e rifiuta
    // i nomi di colonna (SchemaMismatchError).
    fields: {
      name: 'displayName', // Better Auth `name` → User.displayName (colonna display_name)
      image: 'avatarUrl', // Better Auth `image` → User.avatarUrl (colonna avatar_url)
    },
    additionalFields: {
      username: {
        type: 'string',
        required: true,
        input: true,
      },
      bio: { type: 'string', required: false, input: true },
      city: { type: 'string', required: false, input: true },
      lat: { type: 'number', required: false, input: true },
      lng: { type: 'number', required: false, input: true },
      accountType: {
        type: 'string',
        required: false,
        defaultValue: 'person',
        input: true,
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: false, // solo admin puo' cambiarlo
      },
      status: {
        type: 'string',
        required: false,
        defaultValue: 'active',
        input: false,
      },
      // Lettore (borrower) o curatore: si cambia con PATCH /api/users/me
      libraryRole: {
        type: 'string',
        required: false,
        defaultValue: 'curator',
        input: false,
      },
      welcomeIndex: {
        type: 'number',
        required: false,
        defaultValue: 0,
        input: false,
      },
    },
  },

  // -- Rate limiting per prevenire brute-force -------------------------------
  // Beta 6: disabilitato in NODE_ENV=test perche' i 89 test fanno tanti
  // sign-in via signInAs()/signInAsCached() e triggererebbero rate limit.
  // In prod resta attivo (login stretto per prevenire brute force).
  rateLimit: {
    enabled: process.env.NODE_ENV !== 'test',
    window: 60, // 60 secondi
    max: 100, // richieste per window per IP sugli altri endpoint di auth
    customRules: {
      // Letta a ogni caricamento di pagina: con un limite basso (prima 10/min,
      // condiviso fra tutti gli endpoint) bastava navigare un po', o essere in
      // tanti dietro lo stesso IP, per risultare disconnessi
      '/get-session': { window: 60, max: 600 },
      '/sign-in/email': { window: 60, max: 5 }, // login piu' stretto
      '/sign-up/email': { window: 300, max: 3 }, // signup ancora piu'
      '/request-password-reset': { window: 300, max: 3 },
      '/send-verification-email': { window: 300, max: 3 },
    },
  },

  // -- IP del client per il rate limit ---------------------------------------
  // L'API e' raggiungibile solo attraverso nginx, che imposta X-Real-IP con
  // l'indirizzo del client. X-Forwarded-For resta come riserva: con piu'
  // proxy in catena contiene piu' indirizzi e Better Auth non lo userebbe,
  // finendo su un contatore unico per tutti gli utenti.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'],
    },
  },

  // -- Trusted origins per CORS ---------------------------------------------
  // Le origini del sito (CORS_ORIGINS) piu' quelle di sviluppo: valgono anche
  // per le pagine di ritorno (callbackURL) dei link inviati per email.
  trustedOrigins: TRUSTED_WEB_ORIGINS,
});

// Export helper per riuso interno (session lookup, ecc.)
export const authApi = auth.api;
