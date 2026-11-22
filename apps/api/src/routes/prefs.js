// =============================================================================
// src/routes/prefs.js — User preferences (Beta 2)
// =============================================================================
// Endpoint per gestire il record UserPreference (theme, motto, cover design,
// avatar style, view mode, sort default, ecc.). Sostituisce il legacy
// API.getProfilePrefs / setProfilePrefs (localStorage).
//
// Route:
//   GET  /api/me/prefs           → ritorna le proprie preferenze
//   PATCH /api/me/prefs          → aggiorna una o piu' preferenze
//   GET  /api/users/:id/prefs    → preferenze pubbliche di un altro utente
//                                  (subset: theme, motto, coverDesign,
//                                  avatarStyle/avatarSymbol per rendering)
// =============================================================================

import { requireUserId } from '../lib/authHelpers.js';

const PUBLIC_PREF_FIELDS = ['theme', 'motto', 'coverDesign', 'avatarStyle', 'avatarSymbol'];

/** Default record se l'utente non ha ancora una riga UserPreference */
const DEFAULT_PREFS = {
  viewMode: 'grid',
  theme: 'classic',
  avatarStyle: 'initials',
  avatarSymbol: null,
  motto: null,
  sortBy: 'recent',
  coverDesign: null,
  showEmail: false,
};

function toDto(row, userId) {
  return {
    userId,
    viewMode: row?.viewMode ?? DEFAULT_PREFS.viewMode,
    theme: row?.theme ?? DEFAULT_PREFS.theme,
    avatarStyle: row?.avatarStyle ?? DEFAULT_PREFS.avatarStyle,
    avatarSymbol: row?.avatarSymbol ?? null,
    motto: row?.motto ?? null,
    sortBy: row?.sortBy ?? DEFAULT_PREFS.sortBy,
    coverDesign: row?.coverDesign ?? null,
    showEmail: row?.showEmail ?? DEFAULT_PREFS.showEmail,
    updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
  };
}

export default async function prefsRoutes(fastify) {
  // ===========================================================================
  // GET /api/me/prefs — Preferenze dell'utente corrente
  // ===========================================================================
  fastify.get(
    '/api/me/prefs',
    { schema: { tags: ['Users'], summary: 'Le mie preferenze' } },
    async (request) => {
      const userId = await requireUserId(request);
      const row = await fastify.prisma.userPreference.findUnique({ where: { userId } });
      return toDto(row, userId);
    }
  );

  // ===========================================================================
  // PATCH /api/me/prefs — Aggiorna proprie preferenze (upsert)
  // ===========================================================================
  fastify.patch(
    '/api/me/prefs',
    {
      schema: {
        tags: ['Users'],
        summary: 'Aggiorna proprie preferenze',
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            viewMode: { type: 'string', enum: ['grid', 'list', 'shelf', 'timeline'] },
            // Stessi valori dell'interfaccia (classi CSS cover--<tema>)
            theme: { type: 'string', enum: ['classic', 'bordeaux', 'sage', 'midnight'] },
            avatarStyle: { type: 'string', enum: ['initials', 'symbol', 'photo'] },
            avatarSymbol: { type: ['string', 'null'], maxLength: 8 },
            motto: { type: ['string', 'null'], maxLength: 120 },
            sortBy: { type: 'string', enum: ['recent', 'title', 'author', 'year'] },
            coverDesign: { type: ['string', 'null'], maxLength: 40 },
            showEmail: { type: 'boolean' },
          },
        },
      },
    },
    async (request) => {
      const userId = await requireUserId(request);
      const patch = request.body;

      // Upsert: crea il record se manca, altrimenti aggiorna solo i campi passati
      const row = await fastify.prisma.userPreference.upsert({
        where: { userId },
        create: { userId, ...patch },
        update: patch,
      });
      return toDto(row, userId);
    }
  );

  // ===========================================================================
  // GET /api/users/:id/prefs — Preferenze pubbliche di un altro utente
  // ===========================================================================
  // Ritorna solo il subset "visibile" (theme, motto, coverDesign, avatar).
  // Il resto (viewMode, sortBy, showEmail) resta privato.
  fastify.get(
    '/api/users/:id/prefs',
    {
      schema: {
        tags: ['Users'],
        summary: 'Preferenze pubbliche di un utente',
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = await fastify.prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!user)
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Utente non trovato' } });

      const row = await fastify.prisma.userPreference.findUnique({ where: { userId: id } });
      const full = toDto(row, id);
      // Espone solo i campi pubblici
      const publicOnly = { userId: id, updatedAt: full.updatedAt };
      for (const f of PUBLIC_PREF_FIELDS) publicOnly[f] = full[f];
      return publicOnly;
    }
  );
}
