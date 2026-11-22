// =============================================================================
// tests/routes/catalog.test.js
// =============================================================================
// Ricerca del catalogo (luogo, piu' generi, raggio sulla posizione pubblica),
// "Librerie vicino a te" e contatori della home.
// =============================================================================

import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp, authHeaders, createTestPrisma, SEED } from '../helpers.mjs';

const prisma = createTestPrisma();
afterAll(async () => {
  await prisma.$disconnect();
});

// Chiara (persona, zona) e Libreria Spaccanapoli (ente, esatta) nel seed
const CHIAIA = { lat: 40.8358, lng: 14.2351 };

describe('GET /api/books: ricerca del catalogo', () => {
  it("il testo cerca anche nella citta' pubblica del proprietario", async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/books?q=Chiaia&limit=50' });
    const owners = new Set(res.json().data.map((b) => b.owner.id));
    expect(owners.has(SEED.USER_CHIARA)).toBe(true);
  });

  it("piu' generi: una macro-area include i sottogeneri", async () => {
    const app = await buildTestApp();
    // 1 = Narrativa (macro): include Classici, Letteratura italiana, ...
    const macro = await app.inject({ method: 'GET', url: '/api/books?categories=1&limit=100' });
    const sub = await app.inject({ method: 'GET', url: '/api/books?categories=9&limit=100' });
    expect(macro.json().pagination.total).toBeGreaterThan(sub.json().pagination.total);
    for (const b of sub.json().data) {
      expect(b.categories.map((c) => c.id)).toContain(9);
    }
  });

  it('raggio: solo proprietari con posizione pubblica entro la distanza', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/books?lat=${CHIAIA.lat}&lng=${CHIAIA.lng}&radius=500&limit=100`,
    });
    const books = res.json().data;
    expect(books.length).toBeGreaterThan(0);
    for (const b of books) {
      expect(b.owner.lat).not.toBeNull();
      expect(Math.abs(b.owner.lat - CHIAIA.lat)).toBeLessThan(0.01);
    }
  });

  it("likedByMe per l'utente autenticato", async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_GIULIA);
    await app.inject({ method: 'POST', url: `/api/books/${SEED.BOOK_GATTOPARDO}/like`, headers });
    const res = await app.inject({ method: 'GET', url: '/api/books?limit=100', headers });
    const book = res.json().data.find((b) => b.id === SEED.BOOK_GATTOPARDO);
    expect(book.likedByMe).toBe(true);
    const anon = await app.inject({ method: 'GET', url: '/api/books?limit=5' });
    expect(anon.json().data[0].likedByMe).toBeUndefined();
    await prisma.like.deleteMany({ where: { userId: SEED.USER_GIULIA } });
  });
});

describe('GET /api/libraries', () => {
  it("con posizione: ordinate per vicinanza e attivita', distanza sulla posizione pubblica", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries?lat=${CHIAIA.lat}&lng=${CHIAIA.lng}`,
    });
    expect(res.statusCode).toBe(200);
    const libs = res.json().data;
    expect(libs.length).toBeGreaterThan(3);
    const chiara = libs.find((l) => l.id === SEED.USER_CHIARA);
    // Chiara e' in "zona": distanza dal punto pubblico, mai zero
    expect(chiara.distanceKm).toBeGreaterThan(0);
    expect(chiara.distanceKm).toBeLessThan(0.2);
    const scored = libs.filter((l) => l.rankScore != null).map((l) => l.rankScore);
    expect(scored).toEqual([...scored].sort((a, b) => a - b));
    expect(libs.some((l) => l.accountType === 'organization')).toBe(true);
  });

  it("senza posizione: per attivita', senza distanze; esclude l'utente corrente", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/libraries',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    const libs = res.json().data;
    expect(res.json().reference).toBeNull();
    expect(libs.every((l) => l.distanceKm === null)).toBe(true);
    expect(libs.some((l) => l.id === SEED.USER_CHIARA)).toBe(false);
    const act = libs.map((l) => l.activityIndex);
    expect(act).toEqual([...act].sort((a, b) => b - a));
  });

  it("nascosta: nessuna citta' e nessuna distanza", async () => {
    const app = await buildTestApp();
    await prisma.user.update({ where: { id: SEED.USER_CHIARA }, data: { locationPrecision: 0 } });
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/libraries?lat=${CHIAIA.lat}&lng=${CHIAIA.lng}`,
      });
      const chiara = res.json().data.find((l) => l.id === SEED.USER_CHIARA);
      expect(chiara).toMatchObject({ city: null, distanceKm: null });
    } finally {
      await prisma.user.update({ where: { id: SEED.USER_CHIARA }, data: { locationPrecision: 2 } });
    }
  });
});

describe('GET /api/stats', () => {
  it('global: contatori pubblici della home', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/stats/global' });
    expect(res.json().publicCounters).toMatchObject({
      books: expect.any(Number),
      readers: expect.any(Number),
      categories: expect.any(Number),
      views: expect.any(Number),
    });
    expect(res.json().publicCounters.books).toBeGreaterThan(0);
  });

  it('top-users: id utente come stringa (non NaN)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/stats/top-users' });
    for (const u of res.json().data || []) expect(typeof u.id).toBe('string');
  });
});
