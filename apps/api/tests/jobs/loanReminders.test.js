// =============================================================================
// tests/jobs/loanReminders.test.js
// =============================================================================
// Job dei prestiti (ritardo e promemoria di scadenza): devono creare le
// notifiche per entrambi i partecipanti, con il riferimento al prestito.
// Fino al 22 nov 2026 i tipi (es. loan_overdue_borrower) superavano i 20
// caratteri della colonna e la transazione falliva.
// =============================================================================

import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { createTestPrisma, SEED } from '../helpers.mjs';
import { processOverdueLoans } from '../../src/jobs/overdueLoans.js';
import { processUpcomingDeadlines } from '../../src/jobs/upcomingDeadline.js';

const prisma = createTestPrisma();
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const DAY = 24 * 60 * 60 * 1000;

let loanId;

async function createBorrowedLoan(deadline) {
  const loan = await prisma.loanRequest.create({
    data: {
      bookId: SEED.BOOK_GATTOPARDO,
      requesterId: SEED.USER_MARCO,
      lenderId: SEED.USER_CHIARA,
      status: 'borrowed',
      confirmedAt: new Date(deadline.getTime() - 20 * DAY),
      borrowedAt: new Date(deadline.getTime() - 14 * DAY),
      deadline,
    },
  });
  loanId = loan.id;
  return loan;
}

afterEach(async () => {
  if (loanId) {
    await prisma.notification.deleteMany({ where: { loanId } });
    await prisma.loanRequest.delete({ where: { id: loanId } });
    loanId = null;
  }
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('Job dei prestiti', () => {
  it('ritardo: notifica a chi ha il libro e a chi lo ha prestato', async () => {
    const loan = await createBorrowedLoan(new Date(Date.now() - 3 * DAY));
    const stats = await processOverdueLoans({ data: {} }, logger);
    expect(stats.errors).toBe(0);
    expect(stats.remindersSent).toBeGreaterThanOrEqual(1);

    const notifs = await prisma.notification.findMany({ where: { loanId: loan.id } });
    expect(notifs.map((n) => n.type).sort()).toEqual([
      'loan_overdue_borrower',
      'loan_overdue_lender',
    ]);
    const updated = await prisma.loanRequest.findUnique({ where: { id: loan.id } });
    expect(updated.reminderSentAt).not.toBeNull();
  });

  it('promemoria di scadenza: notifiche ai due partecipanti', async () => {
    const loan = await createBorrowedLoan(new Date(Date.now() + 1 * DAY));
    const stats = await processUpcomingDeadlines({ data: {} }, logger);
    expect(stats.errors).toBe(0);

    const notifs = await prisma.notification.findMany({ where: { loanId: loan.id } });
    expect(notifs.map((n) => n.type).sort()).toEqual([
      'loan_deadline_upcoming_borrower',
      'loan_deadline_upcoming_lender',
    ]);
  });
});
