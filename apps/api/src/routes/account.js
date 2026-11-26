// =============================================================================
// src/routes/account.js — Cancellazione del proprio account
// =============================================================================
// DELETE /api/users/me cancella definitivamente l'account dell'utente
// collegato e i dati che lo riguardano (diritto alla cancellazione, art. 17
// GDPR). Serve la password attuale come conferma. La cancellazione e' la
// stessa dell'eliminazione da parte di un amministratore
// (lib/accountStatus.js).
// =============================================================================

import { auth } from '../lib/auth.js';
import { requireUserId } from '../lib/authHelpers.js';
import { deleteAccount } from '../lib/accountStatus.js';
import { sendAccountDeletedEmail } from '../lib/accountEmails.js';

export default async function accountRoutes(fastify) {
  fastify.delete(
    '/api/users/me',
    {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
      schema: {
        tags: ['Users'],
        summary: 'Elimina definitivamente il proprio account',
        description:
          'Cancella account, profilo, volumi, prestiti e chat, recensioni, post, like, follow e notifiche. Richiede la password attuale.',
        body: {
          type: 'object',
          required: ['password'],
          additionalProperties: false,
          properties: { password: { type: 'string', minLength: 1, maxLength: 128 } },
        },
      },
    },
    async (request, reply) => {
      const userId = await requireUserId(request);

      const account = await fastify.prisma.account.findFirst({
        where: { userId, providerId: 'credential' },
        select: { password: true },
      });
      const ctx = await auth.$context;
      const ok =
        account?.password &&
        (await ctx.password.verify({ hash: account.password, password: request.body.password }));
      if (!ok) {
        return reply
          .status(403)
          .send({ error: { code: 'INVALID_PASSWORD', message: 'Password non corretta' } });
      }

      const deleted = await deleteAccount(fastify.prisma, userId);
      if (deleted) await sendAccountDeletedEmail(deleted);

      // La sessione non esiste piu'; il browser toglie i cookie chiamando
      // l'uscita (POST /api/auth/sign-out)
      return reply.status(204).send();
    }
  );
}
