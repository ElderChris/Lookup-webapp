// =============================================================================
// tests/routes/loans.test.js
// =============================================================================

import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { buildTestApp, authHeaders, createTestPrisma, SEED } from '../helpers.mjs';

const prisma = createTestPrisma();
afterAll(async () => {
  await prisma.$disconnect();
});

// Cleanup loans tra ogni test (state machine fa side-effect su book.available)
beforeEach(async () => {
  await prisma.loanMessage.deleteMany();
  await prisma.loanRequest.deleteMany();
  // ripristina book.available=true sui libri usati nei test
  await prisma.book.updateMany({
    where: { id: { in: [SEED.BOOK_GATTOPARDO, SEED.BOOK_GADDA, SEED.BOOK_VITTORINI] } },
    data: { available: true },
  });
});

describe('POST /api/books/:id/loan-requests', () => {
  it('crea richiesta in stato requested', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { message: 'Posso prenderlo?' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('requested');
    expect(body.role).toBe('requester');
  });

  it('rifiuta self-loan (owner del libro)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_CHIARA), // owner del libro
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('SELF_LOAN');
  });

  it('rifiuta duplicato attivo (409)', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: {},
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: {},
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('LOAN_ALREADY_ACTIVE');
  });
});

describe('GET /api/loans/:id', () => {
  it("participant puo' vedere il prestito", async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: {},
    });
    const id = created.json().id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/loans/${id}`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(res.statusCode).toBe(200);
  });

  it("estraneo non puo' vedere (403)", async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: {},
    });
    const id = created.json().id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/loans/${id}`,
      headers: await authHeaders(SEED.USER_ANNA),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /api/loans/:id (state machine)', () => {
  let loanId;
  beforeEach(async () => {
    const app = await buildTestApp();
    const r = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: {},
    });
    loanId = r.json().id;
  });

  it('accept (lender) → confirmed', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_CHIARA), // lender (owner libro)
      payload: { action: 'accept' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('confirmed');
  });

  it('accept come requester ritorna 403 WRONG_ROLE', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { action: 'accept' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('WRONG_ROLE');
  });

  it('mark_borrowed → book.available = false', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { action: 'accept' },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { action: 'mark_borrowed' },
    });
    expect(res.json().status).toBe('borrowed');
    const book = await prisma.book.findUnique({ where: { id: SEED.BOOK_GATTOPARDO } });
    expect(book.available).toBe(false);
  });

  it('mark_borrowed: la scadenza usa i giorni richiesti, non il default di 14', async () => {
    const app = await buildTestApp();
    const lender = await authHeaders(SEED.USER_CHIARA);
    // Nuova richiesta con 21 giorni (quella del beforeEach non li indica)
    await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { action: 'cancel' },
    });
    const created = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { daysRequested: 21 },
    });
    const id = created.json().id;
    await app.inject({
      method: 'PATCH',
      url: `/api/loans/${id}`,
      headers: lender,
      payload: { action: 'accept' },
    });
    const before = Date.now();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${id}`,
      headers: lender,
      payload: { action: 'mark_borrowed' },
    });
    const days = (new Date(res.json().deadline).getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(20.9);
    expect(days).toBeLessThan(21.1);
  });

  it('ciclo completo: accept → borrowed → returning → returned (book disponibile di nuovo)', async () => {
    const app = await buildTestApp();
    const transitions = [
      { action: 'accept', actor: SEED.USER_CHIARA, expectStatus: 'confirmed' },
      { action: 'mark_borrowed', actor: SEED.USER_CHIARA, expectStatus: 'borrowed' },
      { action: 'mark_returning', actor: SEED.USER_MARCO, expectStatus: 'returning' },
      { action: 'mark_returned', actor: SEED.USER_CHIARA, expectStatus: 'returned' },
    ];
    for (const t of transitions) {
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/loans/${loanId}`,
        headers: await authHeaders(t.actor),
        payload: { action: t.action },
      });
      expect(r.statusCode, `transizione ${t.action}`).toBe(200);
      expect(r.json().status, `dopo ${t.action}`).toBe(t.expectStatus);
    }
    const book = await prisma.book.findUnique({ where: { id: SEED.BOOK_GATTOPARDO } });
    expect(book.available).toBe(true); // tornato disponibile
  });

  it('INVALID_TRANSITION: mark_returning da stato requested', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { action: 'mark_returning' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_TRANSITION');
  });
});

// =============================================================================
// Fase 1g.2: rejectReason
// =============================================================================
describe('PATCH /api/loans/:id with action=reject + reason', () => {
  let loanId;
  beforeEach(async () => {
    const app = await buildTestApp();
    const r = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: {},
    });
    loanId = r.json().id;
  });

  it('reject senza reason: ok, rejectReason resta null', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_CHIARA), // lender
      payload: { action: 'reject' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('rejected');
    expect(res.json().rejectReason).toBeNull();

    const loanInDb = await prisma.loanRequest.findUnique({ where: { id: loanId } });
    expect(loanInDb.rejectReason).toBeNull();
  });

  it('reject con reason: salva la motivazione in DB', async () => {
    const app = await buildTestApp();
    const motivo = "Volume gia' impegnato per un altro prestito imminente";
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { action: 'reject', reason: motivo },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('rejected');
    expect(res.json().rejectReason).toBe(motivo);

    const loanInDb = await prisma.loanRequest.findUnique({ where: { id: loanId } });
    expect(loanInDb.rejectReason).toBe(motivo);
  });

  it('reason trimmata: spazi extra rimossi', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { action: 'reject', reason: "   gia' prestato   " },
    });
    expect(res.json().rejectReason).toBe("gia' prestato");
  });

  it('reason fornita ma action=accept: NON salvata (ignorata)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { action: 'accept', reason: 'dovrebbe essere ignorata' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('confirmed');
    expect(res.json().rejectReason).toBeNull();
  });

  it('reason troppo lunga (> 1000 char): ritorna 400 validation error', async () => {
    const app = await buildTestApp();
    const tooLong = 'a'.repeat(1001);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { action: 'reject', reason: tooLong },
    });
    expect(res.statusCode).toBe(400);
  });

  it('reason vuota dopo trim: NON salvata (rejectReason resta null)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { action: 'reject', reason: '    ' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rejectReason).toBeNull();
  });
});

describe('POST /api/loans/:id/messages', () => {
  it("participant scrive, l'altro legge", async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: {},
    });
    const loanId = created.json().id;

    const r1 = await app.inject({
      method: 'POST',
      url: `/api/loans/${loanId}/messages`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { body: 'Ciao!' },
    });
    expect(r1.statusCode).toBe(201);
    expect(r1.json().body).toBe('Ciao!');

    const msgs = await app.inject({
      method: 'GET',
      url: `/api/loans/${loanId}/messages`,
      headers: await authHeaders(SEED.USER_CHIARA), // lender
    });
    expect(msgs.json().data.length).toBe(1);
  });
});
