// =============================================================================
// src/lib/loanStatus.js — Prestiti in corso
// =============================================================================
// Un prestito e' "in corso" dalla richiesta fino alla conferma della
// restituzione. Finche' ce n'e' uno, il volume non si puo' eliminare: chi l'ha
// chiesto o lo ha in mano perderebbe il prestito e la chat.
// =============================================================================

/** Stati dei prestiti non ancora conclusi. */
export const ACTIVE_LOAN_STATUSES = ['requested', 'confirmed', 'borrowed', 'returning'];

/**
 * Prestito in corso sul volume (il piu' recente), oppure null.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {number} bookId
 * @returns {Promise<{id: number, status: string} | null>}
 */
export function findActiveLoan(prisma, bookId) {
  return prisma.loanRequest.findFirst({
    where: { bookId, status: { in: ACTIVE_LOAN_STATUSES } },
    orderBy: { requestedAt: 'desc' },
    select: { id: true, status: true },
  });
}

/** Risposta 409 per l'eliminazione di un volume con un prestito in corso. */
export function bookOnLoanError(loan) {
  return {
    error: {
      code: 'BOOK_ON_LOAN',
      message:
        'Il volume ha un prestito in corso: si potrà eliminare quando il prestito sarà concluso, rifiutato o annullato',
      loan,
    },
  };
}
