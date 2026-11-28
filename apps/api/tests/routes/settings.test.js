// =============================================================================
// tests/routes/settings.test.js
// =============================================================================
// Impostazioni reali del profilo e correzioni della chiusura dei test:
// prestiti in pausa (acceptsLoans), durata del prestito 5-28 giorni, dati
// dell'ente modificabili, esportazione con le notifiche, indicatori admin,
// cronologia del volume.
// =============================================================================

import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { buildTestApp, authHeaders, createTestPrisma, SEED } from '../helpers.mjs';

const prisma = createTestPrisma();
afterAll(async () => {
  await prisma.$disconnect();
});

// Chiara riprende sempre ad accettare prestiti; niente richieste lasciate in giro
afterEach(async () => {
  await prisma.user.update({ where: { id: SEED.USER_CHIARA }, data: { acceptsLoans: true } });
  await prisma.loanMessage.deleteMany();
  await prisma.loanRequest.deleteMany();
});

const titles = (res) => res.json().data.map((b) => b.title);

describe('Accetto richieste di prestito (acceptsLoans)', () => {
  it('si salva da PATCH /api/users/me e torna nel profilo', async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_CHIARA);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers,
      payload: { acceptsLoans: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().acceptsLoans).toBe(false);
    const me = await app.inject({ method: 'GET', url: '/api/users/me', headers });
    expect(me.json().acceptsLoans).toBe(false);
  });

  it('in pausa: volumi fuori da ricerche ed elenchi, ma nella pagina della libreria', async () => {
    const app = await buildTestApp();
    await prisma.user.update({ where: { id: SEED.USER_CHIARA }, data: { acceptsLoans: false } });

    const search = await app.inject({ method: 'GET', url: '/api/books?q=Gattopardo' });
    expect(titles(search)).not.toContain('Il Gattopardo');
    const all = await app.inject({ method: 'GET', url: '/api/books?limit=100' });
    expect(all.json().data.some((b) => b.owner.id === SEED.USER_CHIARA)).toBe(false);
    const near = await app.inject({
      method: 'GET',
      url: '/api/books/nearby?lat=40.835&lng=14.236&radius=2000',
    });
    expect(near.json().data.some((b) => b.owner.id === SEED.USER_CHIARA)).toBe(false);

    const library = await app.inject({
      method: 'GET',
      url: `/api/books?ownerId=${SEED.USER_CHIARA}`,
    });
    expect(titles(library)).toContain('Il Gattopardo');
    const detail = await app.inject({ method: 'GET', url: `/api/books/${SEED.BOOK_GATTOPARDO}` });
    expect(detail.json().owner.acceptsLoans).toBe(false);
    const agg = await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_CHIARA}/library` });
    expect(agg.json().user.acceptsLoans).toBe(false);
  });

  it('in pausa: nuove richieste di prestito rifiutate con LOANS_PAUSED', async () => {
    const app = await buildTestApp();
    await prisma.user.update({ where: { id: SEED.USER_CHIARA }, data: { acceptsLoans: false } });
    const res = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: {},
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('LOANS_PAUSED');
  });
});

describe('Durata del prestito', () => {
  it('accetta da 5 a 28 giorni, come la finestra e i termini', async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_MARCO);
    const ask = (daysRequested) =>
      app.inject({
        method: 'POST',
        url: `/api/books/${SEED.BOOK_GATTOPARDO}/loan-requests`,
        headers,
        payload: { daysRequested },
      });
    expect((await ask(4)).statusCode).toBe(400);
    expect((await ask(29)).statusCode).toBe(400);
    expect((await ask(28)).statusCode).toBe(201);
  });
});

describe("Dati dell'ente", () => {
  it('modificabili dal profilo, con i campi facoltativi cancellabili', async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_BIBLIOTECA_SANITA);
    const before = await prisma.organizationProfile.findUnique({
      where: { userId: SEED.USER_BIBLIOTECA_SANITA },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers,
      payload: {
        organization: { openingHours: 'Mar–Sab 9:00–13:00', website: null, publicPhone: null },
      },
    });
    expect(res.statusCode).toBe(200);
    const after = await prisma.organizationProfile.findUnique({
      where: { userId: SEED.USER_BIBLIOTECA_SANITA },
    });
    expect(after.openingHours).toBe('Mar–Sab 9:00–13:00');
    expect(after.website).toBeNull();
    // ripristino
    await prisma.organizationProfile.update({
      where: { userId: SEED.USER_BIBLIOTECA_SANITA },
      data: {
        openingHours: before.openingHours,
        website: before.website,
        publicPhone: before.publicPhone,
      },
    });
  });
});

describe('Preferenze', () => {
  it("l'email visibile non esiste piu'", async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_CHIARA);
    const prefs = await app.inject({ method: 'GET', url: '/api/me/prefs', headers });
    expect(prefs.json()).not.toHaveProperty('showEmail');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/prefs',
      headers,
      payload: { showEmail: true },
    });
    // Campo sconosciuto ignorato (removeAdditional di Fastify), mai restituito
    expect(res.json()).not.toHaveProperty('showEmail');
  });
});

describe('Esportazione dei dati', () => {
  it('contiene notifiche e reazioni ai post', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/export',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().notifications)).toBe(true);
    expect(Array.isArray(res.json().postReactions)).toBe(true);
  });
});

describe('Indicatori del pannello di amministrazione', () => {
  it('"email da confermare" coincide con il filtro dell\'elenco utenti', async () => {
    const app = await buildTestApp();
    const user = await prisma.user.create({
      data: {
        id: 'usr_test_unconfirmed',
        username: 'test.nonconfermato',
        email: 'test.nonconfermato@example.com',
        displayName: 'Non confermato',
        status: 'active',
        emailVerified: false,
      },
    });
    try {
      const headers = await authHeaders(SEED.USER_ADMIN);
      const stats = await app.inject({ method: 'GET', url: '/api/stats/global' });
      const list = await app.inject({
        method: 'GET',
        url: '/api/admin/users?status=pending&limit=100',
        headers,
      });
      expect(list.json().data.map((u) => u.id)).toContain(user.id);
      expect(stats.json().usersByStatus.pending).toBe(list.json().pagination.total);
      const active = await app.inject({
        method: 'GET',
        url: '/api/admin/users?status=active&limit=100',
        headers,
      });
      expect(active.json().data.map((u) => u.id)).not.toContain(user.id);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

describe('Cronologia di un volume', () => {
  it('volume nascosto: solo il proprietario la vede', async () => {
    const app = await buildTestApp();
    await prisma.book.update({ where: { id: SEED.BOOK_GADDA }, data: { status: 'hidden' } });
    try {
      const guest = await app.inject({
        method: 'GET',
        url: `/api/books/${SEED.BOOK_GADDA}/timeline`,
      });
      expect(guest.statusCode).toBe(404);
      const owner = await app.inject({
        method: 'GET',
        url: `/api/books/${SEED.BOOK_GADDA}/timeline`,
        headers: await authHeaders(SEED.USER_CHIARA),
      });
      expect(owner.statusCode).toBe(200);
      expect(owner.json().series).toHaveLength(30);
    } finally {
      await prisma.book.update({ where: { id: SEED.BOOK_GADDA }, data: { status: 'active' } });
    }
  });
});

describe('Volume di nuovo disponibile', () => {
  it('chi ha messo «mi piace» riceve una notifica quando il prestito si chiude', async () => {
    const app = await buildTestApp();
    const book = SEED.BOOK_GATTOPARDO;
    await prisma.like.createMany({
      data: [
        { userId: SEED.USER_ANNA, bookId: book },
        { userId: SEED.USER_MARCO, bookId: book },
      ],
      skipDuplicates: true,
    });
    const before = new Date();
    try {
      const marco = await authHeaders(SEED.USER_MARCO);
      const chiara = await authHeaders(SEED.USER_CHIARA);
      const req = await app.inject({
        method: 'POST',
        url: `/api/books/${book}/loan-requests`,
        headers: marco,
        payload: {},
      });
      const id = req.json().id;
      const step = (headers, action) =>
        app.inject({ method: 'PATCH', url: `/api/loans/${id}`, headers, payload: { action } });
      expect((await step(chiara, 'accept')).statusCode).toBe(200);
      expect((await step(chiara, 'mark_borrowed')).statusCode).toBe(200);
      expect((await step(marco, 'mark_returning')).statusCode).toBe(200);
      expect((await step(chiara, 'mark_returned')).statusCode).toBe(200);

      const notes = await prisma.notification.findMany({
        where: { type: 'book_available', bookId: book, createdAt: { gte: before } },
      });
      // Anna si', Marco no (l'aveva in prestito), Chiara no (proprietaria)
      expect(notes.map((n) => n.userId)).toEqual([SEED.USER_ANNA]);
      expect(notes[0].message).toContain('Il Gattopardo');
    } finally {
      await prisma.notification.deleteMany({ where: { type: 'book_available' } });
      await prisma.like.deleteMany({
        where: { bookId: book, userId: { in: [SEED.USER_ANNA, SEED.USER_MARCO] } },
      });
      await prisma.book.update({ where: { id: book }, data: { available: true } });
    }
  });
});
