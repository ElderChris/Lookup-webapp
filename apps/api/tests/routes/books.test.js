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

  it('filtra per ricerca testuale q=napoli', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/books?q=napoli' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const b of body.data) {
      const haystack = (b.title + ' ' + b.author).toLowerCase();
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
