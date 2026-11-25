// =============================================================================
// tests/routes/books.test.js
// =============================================================================

import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { buildTestApp, authHeaders, createTestPrisma, randomBookData, SEED } from '../helpers.mjs';

const prisma = createTestPrisma();
afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/books', () => {
  it('la ricerca tollera piccoli errori di battitura su titolo e autore', async () => {
    const app = await buildTestApp();
    const titles = async (q) =>
      (await app.inject({ method: 'GET', url: `/api/books?q=${encodeURIComponent(q)}` }))
        .json()
        .data.map((b) => b.title);
    expect(await titles('Calvno')).toContain('Le città invisibili');
    expect(await titles('Gatopardo')).toContain('Il Gattopardo');
    expect(await titles('promesi sposi')).toContain('I Promessi Sposi');
    // Parole diverse e ricerche corte restano senza risultati imprecisi
    expect(await titles('zzzqqq')).toEqual([]);
    expect(await titles('Gtp')).not.toContain('Il Gattopardo');
  });

  it('ritorna la lista paginata di libri attivi', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/books' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.pagination.total).toBeGreaterThanOrEqual(20);
    const first = body.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('title');
    expect(first.owner).toHaveProperty('displayName');
    expect(first.categories).toBeInstanceOf(Array);
  });

  it('filtra per categoria', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/books?category=${SEED.CAT_GIALLI}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Tutti devono avere CAT_GIALLI tra le loro categorie
    for (const b of body.data) {
      const ids = b.categories.map((c) => c.id);
      expect(ids).toContain(SEED.CAT_GIALLI);
    }
  });

  it('filtra per ricerca testuale q=napoli (place=false: solo testo)', async () => {
    const app = await buildTestApp();
    // Senza place=false "napoli" e' anche un comune: vedi places.test.js
    const res = await app.inject({ method: 'GET', url: '/api/books?q=napoli&place=false' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThan(0);
    // Il testo cerca in titolo, autore e citta' pubblica del proprietario
    for (const b of body.data) {
      const haystack = `${b.title} ${b.author} ${b.owner.city || ''}`.toLowerCase();
      expect(haystack).toContain('napoli');
    }
  });

  it('rispetta limit + offset', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/books?limit=5&offset=2' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(body.pagination.limit).toBe(5);
    expect(body.pagination.offset).toBe(2);
  });
});

describe('GET /api/books/:id', () => {
  it('ritorna dettaglio libro esistente con owner e categories', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: `/api/books/${SEED.BOOK_GATTOPARDO}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe('Il Gattopardo');
    expect(body.owner.id).toBe(SEED.USER_CHIARA);
    expect(body.categories.length).toBeGreaterThan(0);
    expect(body).toHaveProperty('likesCount');
  });

  it('ritorna 404 per id inesistente', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/books/999999' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it("indica se il libro piace all'utente autenticato (likedByMe)", async () => {
    const app = await buildTestApp();
    const url = `/api/books/${SEED.BOOK_GATTOPARDO}`;
    const headers = await authHeaders(SEED.USER_MARCO);

    const guest = await app.inject({ method: 'GET', url });
    expect(guest.json().likedByMe).toBe(false);

    await app.inject({ method: 'DELETE', url: `${url}/like`, headers });
    expect((await app.inject({ method: 'GET', url, headers })).json().likedByMe).toBe(false);

    await app.inject({ method: 'POST', url: `${url}/like`, headers });
    expect((await app.inject({ method: 'GET', url, headers })).json().likedByMe).toBe(true);

    await app.inject({ method: 'DELETE', url: `${url}/like`, headers });
  });
});

describe('POST /api/books', () => {
  it('crea un nuovo libro come utente autenticato', async () => {
    const app = await buildTestApp();
    const body = randomBookData({ categoryIds: [SEED.CAT_NARRATIVA, SEED.CAT_GIALLI] });
    const res = await app.inject({
      method: 'POST',
      url: '/api/books',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.id).toBeGreaterThan(20); // dopo i 20 del seed
    expect(created.title).toBe(body.title);
    expect(created.owner.id).toBe(SEED.USER_CHIARA);
    expect(created.categories.length).toBe(2);
    expect(created.categories[0].isPrimary).toBe(true); // primo = primary

    // cleanup
    await prisma.book.delete({ where: { id: created.id } });
  });

  it('ritorna 401 senza auth', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/books',
      payload: randomBookData(),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('ritorna 400 con body invalido (title vuoto)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/books',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { title: '', author: 'X', categoryIds: [1] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/books/:id', () => {
  it('modifica il titolo come owner', async () => {
    const app = await buildTestApp();
    // crea un libro
    const created = await app.inject({
      method: 'POST',
      url: '/api/books',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: randomBookData(),
    });
    const id = created.json().id;

    // modifica
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/books/${id}`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { title: 'Titolo modificato' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Titolo modificato');

    await prisma.book.delete({ where: { id } });
  });

  it('il proprietario cambia tutti i dati e svuota quelli facoltativi', async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_CHIARA);
    const created = await app.inject({
      method: 'POST',
      url: '/api/books',
      headers,
      payload: randomBookData({ isbn: '9788804668237', pages: 300 }),
    });
    const id = created.json().id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/books/${id}`,
      headers,
      payload: {
        title: 'Nuovo titolo',
        author: 'Nuovo autore',
        year: 1999,
        language: 'Inglese',
        condition: 'discrete',
        description: 'Descrizione aggiornata dal proprietario.',
        categoryIds: [SEED.CAT_GIALLI, SEED.CAT_NARRATIVA],
        isbn: null,
        pages: null,
      },
    });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect([b.title, b.author, b.year, b.language, b.condition]).toEqual([
      'Nuovo titolo',
      'Nuovo autore',
      1999,
      'Inglese',
      'discrete',
    ]);
    expect(b.isbn).toBeNull();
    expect(b.pages).toBeNull();
    expect(b.categories.find((c) => c.isPrimary).id).toBe(SEED.CAT_GIALLI);

    // La disponibilita' non si cambia a mano (campo ignorato)
    const avail = await app.inject({
      method: 'PATCH',
      url: `/api/books/${id}`,
      headers,
      payload: { available: false },
    });
    expect(avail.json().available).toBe(true);
    // ISBN solo di 10 o 13 cifre
    const bad = await app.inject({
      method: 'PATCH',
      url: `/api/books/${id}`,
      headers,
      payload: { isbn: '123' },
    });
    expect(bad.statusCode).toBe(400);
    await prisma.book.delete({ where: { id } });
  });

  it('ritorna 403 se non sei owner', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/books/${SEED.BOOK_GATTOPARDO}`,
      headers: await authHeaders(SEED.USER_MARCO), // non e' l'owner
      payload: { title: 'hack' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/books/:id', () => {
  it('elimina come owner, ritorna 204', async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/books',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: randomBookData(),
    });
    const id = created.json().id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/books/${id}`,
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(res.statusCode).toBe(204);

    const check = await prisma.book.findUnique({ where: { id } });
    expect(check).toBeNull();
  });

  // Volume di Chiara con un prestito di Marco nello stato indicato
  async function bookWithLoan(app, status) {
    const created = await app.inject({
      method: 'POST',
      url: '/api/books',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: randomBookData(),
    });
    const book = created.json();
    const loan = await prisma.loanRequest.create({
      data: {
        bookId: book.id,
        requesterId: SEED.USER_MARCO,
        lenderId: SEED.USER_CHIARA,
        status,
        daysRequested: 14,
      },
    });
    return { bookId: book.id, loanId: loan.id };
  }

  it.each(['requested', 'confirmed', 'borrowed', 'returning'])(
    "rifiuta con 409 se un prestito e' in corso (%s), senza toccare nulla",
    async (status) => {
      const app = await buildTestApp();
      const { bookId, loanId } = await bookWithLoan(app, status);
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/books/${bookId}`,
        headers: await authHeaders(SEED.USER_CHIARA),
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('BOOK_ON_LOAN');
      expect(res.json().error.loan).toEqual({ id: loanId, status });
      expect(await prisma.loanRequest.findUnique({ where: { id: loanId } })).not.toBeNull();
      expect((await prisma.book.findUnique({ where: { id: bookId } })).status).toBe('active');
      await prisma.book.delete({ where: { id: bookId } });
    }
  );

  it('con soli prestiti conclusi ritira il volume e conserva lo storico', async () => {
    const app = await buildTestApp();
    const { bookId, loanId } = await bookWithLoan(app, 'returned');
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/books/${bookId}`,
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(res.statusCode).toBe(204);
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    expect(book.status).toBe('removed');
    expect(await prisma.loanRequest.findUnique({ where: { id: loanId } })).not.toBeNull();

    // Sparito per gli altri, il prestito resta visibile a chi l'ha preso
    const pub = await app.inject({ method: 'GET', url: `/api/books/${bookId}` });
    expect(pub.statusCode).toBe(404);
    const loan = await app.inject({
      method: 'GET',
      url: `/api/loans/${loanId}`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(loan.statusCode).toBe(200);
    expect(loan.json().book.status).toBe('removed');

    // Ritirato: non si modifica ne' si elimina di nuovo
    const again = await app.inject({
      method: 'DELETE',
      url: `/api/books/${bookId}`,
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(again.statusCode).toBe(404);
    await prisma.book.delete({ where: { id: bookId } });
  });

  it("neanche l'amministratore elimina un volume con un prestito in corso", async () => {
    const app = await buildTestApp();
    const { bookId } = await bookWithLoan(app, 'confirmed');
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/books/${bookId}`,
      headers: await authHeaders(SEED.USER_ADMIN),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('BOOK_ON_LOAN');
    await prisma.book.delete({ where: { id: bookId } });
  });

  it("il dettaglio dice al proprietario se un prestito e' in corso", async () => {
    const app = await buildTestApp();
    const { bookId, loanId } = await bookWithLoan(app, 'borrowed');
    const own = await app.inject({
      method: 'GET',
      url: `/api/books/${bookId}`,
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(own.json().activeLoan).toEqual({ id: loanId, status: 'borrowed' });
    const other = await app.inject({
      method: 'GET',
      url: `/api/books/${bookId}`,
      headers: await authHeaders(SEED.USER_ANNA),
    });
    expect(other.json()).not.toHaveProperty('activeLoan');
    await prisma.book.delete({ where: { id: bookId } });
  });
});

describe('POST /api/books/:id/views', () => {
  it('incrementa la view count', async () => {
    const app = await buildTestApp();
    const before = await prisma.book.findUnique({ where: { id: SEED.BOOK_GADDA } });
    const res = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_GADDA}/views`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.incremented).toBe(true);
    expect(body.viewCount).toBe(before.viewCount + 1);
  });
});

describe('POST/DELETE /api/books/:id/like', () => {
  beforeEach(async () => {
    // cleanup likes test
    await prisma.like.deleteMany({ where: { bookId: SEED.BOOK_VITTORINI } });
  });

  it('POST like ritorna liked=true + count', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_VITTORINI}/like`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.liked).toBe(true);
    expect(body.likesCount).toBeGreaterThan(0);
  });

  it("POST like e' idempotente (count non raddoppia)", async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_VITTORINI}/like`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    const r2 = await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_VITTORINI}/like`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(r2.json().likesCount).toBe(1);
  });

  it('DELETE like rimuove + ritorna count=0', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/books/${SEED.BOOK_VITTORINI}/like`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/books/${SEED.BOOK_VITTORINI}/like`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().likesCount).toBe(0);
  });
});

describe('GET /api/books/nearby (PostGIS)', () => {
  it('ritorna libri entro un raggio + distanza ordinata ASC', async () => {
    const app = await buildTestApp();
    // Coordinate di Chiaia (Chiara Morandi)
    const res = await app.inject({
      method: 'GET',
      url: '/api/books/nearby?lat=40.8358&lng=14.2351&radius=2000',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const b of body.data) {
      expect(b).toHaveProperty('distanceMeters');
      expect(b.distanceMeters).toBeGreaterThanOrEqual(0);
    }
    // verifica ordinamento asc
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i].distanceMeters).toBeGreaterThanOrEqual(body.data[i - 1].distanceMeters);
    }
  });

  it('ritorna 400 per lat fuori range', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/books/nearby?lat=999&lng=14&radius=1000',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/books: preferiti e librerie seguite', () => {
  const prisma2 = createTestPrisma();
  afterAll(async () => {
    await prisma2.like.deleteMany({ where: { userId: SEED.USER_LUCA } });
    await prisma2.follow.deleteMany({ where: { followerId: SEED.USER_LUCA } });
    await prisma2.$disconnect();
  });

  it('liked=true: solo i volumi con il proprio "mi piace"', async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_LUCA);
    await app.inject({ method: 'POST', url: `/api/books/${SEED.BOOK_GADDA}/like`, headers });
    const res = await app.inject({ method: 'GET', url: '/api/books?liked=true', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.map((b) => b.id)).toEqual([SEED.BOOK_GADDA]);
  });

  it('following=true: solo i volumi delle librerie seguite', async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_LUCA);
    await app.inject({ method: 'POST', url: `/api/users/${SEED.USER_ANNA}/follow`, headers });
    const res = await app.inject({ method: 'GET', url: '/api/books?following=true', headers });
    const owners = new Set(res.json().data.map((b) => b.owner.id));
    expect([...owners]).toEqual([SEED.USER_ANNA]);
  });

  it('senza accesso: 401', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/books?liked=true' });
    expect(res.statusCode).toBe(401);
  });
});
