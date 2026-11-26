// =============================================================================
// src/lib/accountStatus.js — Stato degli account
// =============================================================================
// Stati di users.status:
//   active    account in uso
//   pending   iscritto che non ha ancora confermato l'email: non accede e i
//             volumi inseriti all'iscrizione restano nascosti
//   suspended sospeso da un amministratore: non accede (le sessioni vengono
//             chiuse) e profilo, volumi e post spariscono dalle parti
//             pubbliche; riattivandolo torna tutto com'era
// Valore storico: 'deleted' (eliminazione logica delle versioni precedenti),
// trattato come 'suspended'. Oggi l'eliminazione cancella davvero l'account.
// =============================================================================

/** Condizione Prisma: proprietario o autore con account attivo. */
export const ACTIVE_USER = { status: 'active' };

/** Stati che impediscono l'accesso anche con email confermata. */
export const BLOCKED_STATUSES = ['suspended', 'deleted'];

/**
 * Email confermata: account attivo e volumi dell'iscrizione pubblicati.
 * Non tocca un account sospeso.
 */
export async function activateVerifiedAccount(prisma, userId) {
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: userId, status: 'pending' },
      data: { status: 'active' },
    }),
    prisma.book.updateMany({
      where: { ownerId: userId, status: 'pending_email' },
      data: { status: 'active' },
    }),
  ]);
}

/** Chiude tutte le sessioni di un utente. */
export async function revokeSessions(prisma, userId) {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Cancella definitivamente un account: con l'utente spariscono per cascata
 * sessioni, credenziali, volumi, prestiti e chat, recensioni, post, like,
 * follow e notifiche. Restano solo le voci del registro admin (senza dati
 * personali oltre all'id). Restituisce i dati per l'email di conferma.
 */
export async function deleteAccount(prisma, userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true },
  });
  if (!user) return null;
  await prisma.$transaction([
    // Token di reset password ancora validi (value = id utente)
    prisma.verification.deleteMany({ where: { value: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  return user;
}

/**
 * Hook per le route /api/users/:id/... : se l'utente richiesto non e'
 * attivo risponde 404, tranne che all'utente stesso e agli amministratori.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {(request: any) => Promise<string|null>} getViewerId
 */
export function userVisibilityHook(fastify, getViewerId) {
  return async (request, reply) => {
    const url = request.routeOptions?.url || '';
    if (!/^\/api\/users\/:(id|targetId)(\/|$)/.test(url)) return;
    const id = request.params?.id ?? request.params?.targetId;
    if (!id) return;
    const target = await fastify.prisma.user.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!target || target.status === 'active') return; // 404 se manca: ci pensa la route
    const viewerId = await getViewerId(request);
    if (viewerId === id) return;
    if (viewerId) {
      const viewer = await fastify.prisma.user.findUnique({
        where: { id: viewerId },
        select: { role: true },
      });
      if (viewer?.role === 'admin') return;
    }
    return reply.status(404).send({
      error: { code: 'NOT_FOUND', message: 'Utente non trovato' },
    });
  };
}

/** Account con email da confermare (anche gli attivi mai confermati delle
    versioni precedenti), esclusi sospesi ed eliminati: usato da indicatori
    e filtri dell'amministrazione */
export const UNCONFIRMED_WHERE = {
  emailVerified: false,
  status: { notIn: ['suspended', 'deleted'] },
};
