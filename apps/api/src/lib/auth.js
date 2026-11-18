// =============================================================================
// src/lib/auth.js — Better Auth setup (Fase 3.1)
// =============================================================================
// Configurazione centrale di Better Auth con:
//   - Prisma adapter (Postgres)
//   - Email/password provider abilitato
//   - Verifica email e reset password (via SMTP / Mailpit in dev)
//   - Session cookie httpOnly (sliding window 7 giorni)
//   - Additional fields per il nostro schema User custom
//     (username, displayName, bio, city, lat, lng, accountType, ecc.)
//
// Better Auth espone `auth.handler(request)` (Web API standard) che il
// plugin Fastify in `src/lib/authFastify.js` mount-a su /api/auth/*.
// =============================================================================

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';
import { smtpTransport } from './mailer.js';

const prisma = new PrismaClient();

const FROM = process.env.SMTP_FROM || 'no-reply@lookup.local';

async function sendMail({ to, subject, text, html }) {
  try {
    await smtpTransport.sendMail({ from: FROM, to, subject, text, html });
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
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true, // dopo signup → login automatico
    requireEmailVerification: false, // in dev = false (usable subito).
    // In prod = true.

    sendResetPassword: async ({ user, url, token }) => {
      await sendMail({
        to: user.email,
        subject: 'Reset password Lookup',
        text: `Ciao ${user.name || user.email},\n\nHai richiesto il reset password. Clicca qui:\n${url}\n\nSe non sei stato tu, ignora.\n\nToken (dev): ${token}`,
        html: `<p>Ciao ${user.name || user.email},</p>
               <p>Hai richiesto il reset password. Clicca <a href="${url}">qui</a> per procedere.</p>
               <p>Se non sei stato tu, ignora questa email.</p>
               <p style="color:#888;font-size:12px">Token (dev): ${token}</p>`,
      });
    },
  },

  // -- Verify email (indipendente dal require sopra) -------------------------
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      await sendMail({
        to: user.email,
        subject: 'Verifica la tua email — Lookup',
        text: `Ciao ${user.name || user.email},\n\nBenvenuto in Lookup! Verifica la tua email cliccando qui:\n${url}\n\nToken (dev): ${token}`,
        html: `<p>Ciao ${user.name || user.email},</p>
               <p>Benvenuto in Lookup! Verifica la tua email cliccando <a href="${url}">qui</a>.</p>
               <p style="color:#888;font-size:12px">Token (dev): ${token}</p>`,
      });
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
    max: 10, // 10 richieste per window per IP
    customRules: {
      '/sign-in/email': { window: 60, max: 5 }, // login piu' stretto
      '/sign-up/email': { window: 300, max: 3 }, // signup ancora piu'
      '/request-password-reset': { window: 300, max: 3 },
    },
  },

  // -- Trusted origins per CORS ---------------------------------------------
  trustedOrigins: [
    'http://localhost:8080', // frontend nginx (dev)
    'http://localhost:8765', // python http.server (dev alternativo)
    'http://localhost:5500', // Live Server VSCode
    'http://127.0.0.1:8080',
  ],
});

// Export helper per riuso interno (session lookup, ecc.)
export const authApi = auth.api;
