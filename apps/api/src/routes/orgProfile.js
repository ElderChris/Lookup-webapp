// =============================================================================
// src/routes/orgProfile.js — Organization profile (Beta 2)
// =============================================================================
// Endpoint per gestire il record OrganizationProfile (legalName, orgCategory,
// contactPerson, website, publicEmail, publicPhone, publicAddress, openingHours).
// Solo utenti con accountType='organization' possono averne uno.
//
// Route:
//   GET   /api/users/:id/org-profile  → profilo organizzazione (pubblico)
//   GET   /api/me/org-profile         → mio profilo organizzazione
//   PATCH /api/me/org-profile         → aggiorna/crea proprio profilo
//   DELETE /api/me/org-profile        → rimuovi il proprio profilo org
// =============================================================================

import { requireUserId } from '../lib/authHelpers.js';

const ORG_CATEGORIES = [
  'biblioteca_pubblica',
  'biblioteca_comunita',
  'libreria_indipendente',
  'associazione_culturale',
  'centro_studi',
  'scuola',
  'altro',
];

function toDto(row) {
  if (!row) return null;
  return {
    userId: row.userId,
    legalName: row.legalName,
    orgCategory: row.orgCategory,
    contactPerson: row.contactPerson,
    website: row.website,
    publicEmail: row.publicEmail,
    publicPhone: row.publicPhone,
    publicAddress: row.publicAddress,
    openingHours: row.openingHours,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const patchBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    legalName: { type: 'string', minLength: 1, maxLength: 200 },
    orgCategory: { type: 'string', enum: ORG_CATEGORIES },
    contactPerson: { type: ['string', 'null'], maxLength: 120 },
    website: { type: ['string', 'null'], maxLength: 300 },
    publicEmail: { type: ['string', 'null'], maxLength: 255 },
    publicPhone: { type: ['string', 'null'], maxLength: 30 },
    publicAddress: { type: ['string', 'null'], maxLength: 200 },
    openingHours: { type: ['string', 'null'], maxLength: 2000 },
  },
};

export default async function orgProfileRoutes(fastify) {
  // ===========================================================================
  // GET /api/users/:id/org-profile — Profilo organizzazione pubblico
  // ===========================================================================
  fastify.get(
    '/api/users/:id/org-profile',
    {
      schema: {
        tags: ['Users'],
        summary: 'Profilo organizzazione di un utente',
        params: {
          type: 'object',
          properties: { id: { type: 'string', minLength: 1, maxLength: 40 } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const row = await fastify.prisma.organizationProfile.findUnique({ where: { userId: id } });
      if (!row)
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Profilo organizzazione non trovato' } });
      return toDto(row);
    }
  );

  // ===========================================================================
  // GET /api/me/org-profile — Il mio profilo organizzazione
  // ===========================================================================
  fastify.get(
    '/api/me/org-profile',
    { schema: { tags: ['Users'], summary: 'Mio profilo organizzazione' } },
    async (request, reply) => {
      const userId = await requireUserId(request);
      const row = await fastify.prisma.organizationProfile.findUnique({ where: { userId } });
      if (!row)
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Nessun profilo organizzazione' } });
      return toDto(row);
    }
  );

  // ===========================================================================
  // PATCH /api/me/org-profile — Upsert profilo organizzazione (owner only)
  // ===========================================================================
  fastify.patch(
    '/api/me/org-profile',
    {
      schema: {
        tags: ['Users'],
        summary: 'Aggiorna/crea proprio profilo organizzazione',
        body: patchBodySchema,
      },
    },
    async (request, reply) => {
      const userId = await requireUserId(request);
      // Verifica che l'account sia di tipo organization
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { accountType: true },
      });
      if (!user)
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Utente non trovato' } });
      if (user.accountType !== 'organization') {
        return reply.code(403).send({
          error: {
            code: 'WRONG_ACCOUNT_TYPE',
            message: 'Solo account organization possono avere profilo org',
          },
        });
      }

      const patch = request.body;
      // Al create serve almeno legalName + orgCategory
      const existing = await fastify.prisma.organizationProfile.findUnique({ where: { userId } });
      if (!existing && !patch.legalName) {
        return reply.code(400).send({
          error: {
            code: 'MISSING_LEGAL_NAME',
            message: 'legalName richiesto alla prima creazione',
          },
        });
      }

      const row = await fastify.prisma.organizationProfile.upsert({
        where: { userId },
        create: {
          userId,
          legalName: patch.legalName,
          orgCategory: patch.orgCategory || 'altro',
          contactPerson: patch.contactPerson ?? null,
          website: patch.website ?? null,
          publicEmail: patch.publicEmail ?? null,
          publicPhone: patch.publicPhone ?? null,
          publicAddress: patch.publicAddress ?? null,
          openingHours: patch.openingHours ?? null,
        },
        update: patch,
      });
      return toDto(row);
    }
  );

  // ===========================================================================
  // DELETE /api/me/org-profile — Rimuovi profilo organizzazione
  // ===========================================================================
  fastify.delete(
    '/api/me/org-profile',
    { schema: { tags: ['Users'], summary: 'Rimuovi proprio profilo organizzazione' } },
    async (request, reply) => {
      const userId = await requireUserId(request);
      const existing = await fastify.prisma.organizationProfile.findUnique({ where: { userId } });
      if (!existing)
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Nessun profilo da rimuovere' } });
      await fastify.prisma.organizationProfile.delete({ where: { userId } });
      return reply.code(204).send();
    }
  );
}
