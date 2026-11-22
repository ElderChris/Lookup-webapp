// =============================================================================
// tests/routes/locationPrivacy.test.js
// =============================================================================
// Privacy della posizione: 0 nascosta, 1 citta', 2 zona (~200 m), 3 esatta.
// Gli altri utenti vedono solo la posizione pubblica calcolata dal database.
// =============================================================================

import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { buildTestApp, authHeaders, createTestPrisma, SEED } from '../helpers.mjs';

const prisma = createTestPrisma();

// Coordinate di Chiara nel seed (persona, libri 1-3)
const CHIARA = { lat: 40.8358, lng: 14.2351, city: 'Napoli, Chiaia' };

/** Distanza approssimata in metri fra due punti vicini. */
function meters(a, b) {
  const dLat = (a.lat - b.lat) * 111_320;
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

async function setPrecision(app, userId, locationPrecision) {
  const res = await app.inject({
    method: 'PATCH',
    url: '/api/users/me',
    headers: await authHeaders(userId),
    payload: { locationPrecision },
  });
  expect(res.statusCode).toBe(200);
  return res.json();
}

afterEach(async () => {
  // Ripristina il predefinito di Chiara (persona → zona)
  await prisma.user.update({
    where: { id: SEED.USER_CHIARA },
    data: { lat: CHIARA.lat, lng: CHIARA.lng, locationPrecision: 2 },
  });
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('Privacy della posizione', () => {
  it('predefinito: persone zona, enti esatta', async () => {
    const [person, org] = await Promise.all([
      prisma.user.findUnique({ where: { id: SEED.USER_CHIARA } }),
      prisma.user.findUnique({ where: { id: SEED.USER_LIBRERIA_SPACCANAPOLI } }),
    ]);
    expect(person.locationPrecision).toBe(2);
    expect(org.locationPrecision).toBe(3);
    expect(org.publicLat).toBe(org.lat);
    expect(org.publicLng).toBe(org.lng);
  });

  it('zona: gli altri vedono un punto entro ~160 m, il proprietario quello reale', async () => {
    const app = await buildTestApp();
    const pub = (await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_CHIARA}` })).json();
    expect(pub.city).toBe(CHIARA.city);
    expect(pub.lat).not.toBe(CHIARA.lat);
    const d = meters(pub, CHIARA);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(160);

    const me = (
      await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: await authHeaders(SEED.USER_CHIARA),
      })
    ).json();
    expect(me).toMatchObject({ lat: CHIARA.lat, lng: CHIARA.lng, locationPrecision: 2 });

    const ownLibrary = (
      await app.inject({
        method: 'GET',
        url: `/api/users/${SEED.USER_CHIARA}/library`,
        headers: await authHeaders(SEED.USER_CHIARA),
      })
    ).json();
    expect(ownLibrary.user).toMatchObject({ lat: CHIARA.lat, locationPrecision: 2 });

    const visitorLibrary = (
      await app.inject({
        method: 'GET',
        url: `/api/users/${SEED.USER_CHIARA}/library`,
        headers: await authHeaders(SEED.USER_MARCO),
      })
    ).json();
    expect(visitorLibrary.user.lat).toBe(pub.lat);
    expect(visitorLibrary.user.locationPrecision).toBeUndefined();
  });

  it('zona: punto fisso, la ricerca per distanza non rivela la posizione reale', async () => {
    const app = await buildTestApp();
    const pub = (await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_CHIARA}` })).json();
    // Cercando esattamente dalla posizione reale la distanza e' quella dal
    // punto pubblico, non zero
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/nearby?lat=${CHIARA.lat}&lng=${CHIARA.lng}&radius=500`,
    });
    const mine = res.json().data.filter((b) => b.owner.id === SEED.USER_CHIARA);
    expect(mine.length).toBeGreaterThan(0);
    for (const b of mine) {
      expect(Math.abs(b.distanceMeters - meters(pub, CHIARA))).toBeLessThan(5);
      expect(b.distanceMeters).toBeGreaterThan(0);
    }
  });

  it('esatta: coordinate reali', async () => {
    const app = await buildTestApp();
    await setPrecision(app, SEED.USER_CHIARA, 3);
    const pub = (await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_CHIARA}` })).json();
    expect(pub).toMatchObject({ lat: CHIARA.lat, lng: CHIARA.lng });
  });

  it("citta': niente coordinate ne' ricerche per distanza, citta' visibile", async () => {
    const app = await buildTestApp();
    await setPrecision(app, SEED.USER_CHIARA, 1);
    const pub = (await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_CHIARA}` })).json();
    expect(pub).toMatchObject({ city: CHIARA.city, lat: null, lng: null });

    const near = await app.inject({
      method: 'GET',
      url: `/api/books/nearby?lat=${CHIARA.lat}&lng=${CHIARA.lng}&radius=5000`,
    });
    expect(near.json().data.some((b) => b.owner.id === SEED.USER_CHIARA)).toBe(false);

    const box = await app.inject({
      method: 'GET',
      url: `/api/books?lat=${CHIARA.lat}&lng=${CHIARA.lng}&radius=5000&limit=100`,
    });
    expect(box.json().data.some((b) => b.owner.id === SEED.USER_CHIARA)).toBe(false);
  });

  it("nascosta: niente coordinate e niente citta' per gli altri", async () => {
    const app = await buildTestApp();
    await setPrecision(app, SEED.USER_CHIARA, 0);
    const pub = (await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_CHIARA}` })).json();
    expect(pub).toMatchObject({ city: null, lat: null, lng: null });

    const books = await app.inject({
      method: 'GET',
      url: `/api/books?ownerId=${SEED.USER_CHIARA}&limit=5`,
    });
    for (const b of books.json().data) expect(b.owner.city).toBeNull();

    // Il proprietario continua a vedere i propri dati
    const me = (
      await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: await authHeaders(SEED.USER_CHIARA),
      })
    ).json();
    expect(me).toMatchObject({ city: CHIARA.city, lat: CHIARA.lat, locationPrecision: 0 });
  });

  it('posizione: lat e lng insieme; null su entrambe la rimuove', async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_CHIARA);
    const half = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers,
      payload: { lat: 40.84 },
    });
    expect(half.statusCode).toBe(400);
    expect(half.json().error.code).toBe('INVALID_LOCATION');

    const bad = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers,
      payload: { locationPrecision: 4 },
    });
    expect(bad.statusCode).toBe(400);

    const cleared = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers,
      payload: { lat: null, lng: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toMatchObject({ lat: null, lng: null });
    const pub = (await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_CHIARA}` })).json();
    expect(pub).toMatchObject({ lat: null, lng: null });
  });
});
