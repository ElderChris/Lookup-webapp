// =============================================================================
// tests/routes/users.test.js
// =============================================================================

import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { buildTestApp, authHeaders, createTestPrisma, SEED } from '../helpers.mjs';

const prisma = createTestPrisma();
afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/users/:id', () => {
  it('ritorna profilo pubblico con counts', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_CHIARA}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.displayName).toBe('Chiara Morandi');
    expect(body.accountType).toBe('person');
    expect(body.counts).toMatchObject({
      books: expect.any(Number),
      followers: expect.any(Number),
      following: expect.any(Number),
      reviewsReceived: expect.any(Number),
    });
    expect(body.counts.books).toBeGreaterThan(0);
  });

  it('include organizationProfile per account organization', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_LIBRERIA_SPACCANAPOLI}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accountType).toBe('organization');
    expect(body.organizationProfile).not.toBeNull();
    expect(body.organizationProfile.legalName).toContain('Spaccanapoli');
  });

  it('include isFollowing=false se chi guarda non segue', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_CHIARA}`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(res.json().isFollowing).toBe(false);
  });
});

describe('GET /api/users/me', () => {
  it('ritorna profilo privato (con email)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.email).toBe('c.morandi@mail.it');
    expect(body.preferences).not.toBeNull();
  });

  it('ritorna 401 senza auth', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/users/me' });
    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  it('aggiorna bio', async () => {
    const app = await buildTestApp();
    const newBio = `Bio test ${Date.now()}`;
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { bio: newBio },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().bio).toBe(newBio);
  });

  it('rifiuta organization su account person (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { organization: { legalName: 'X' } },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/users/:id/reviews', () => {
  beforeEach(async () => {
    await prisma.review.deleteMany({ where: { targetUserId: SEED.USER_CHIARA } });
  });

  it('crea recensione (upsert)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 5, text: 'Ottima libreria.' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().rating).toBe(5);
  });

  it('upsert non duplica: secondo POST ha stessa id', async () => {
    const app = await buildTestApp();
    const r1 = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 5, text: 'Prima' },
    });
    const r2 = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 3, text: 'Seconda' },
    });
    expect(r1.json().id).toBe(r2.json().id);
    expect(r2.json().rating).toBe(3);
  });

  it('rifiuta self-review (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { rating: 5, text: 'self' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('SELF_REVIEW');
  });
});

describe('POST/DELETE /api/users/:id/follow', () => {
  beforeEach(async () => {
    await prisma.follow.deleteMany({
      where: { followerId: SEED.USER_MARCO, followedId: SEED.USER_CHIARA },
    });
  });

  it('POST follow ritorna 204 + lista followers aggiornata', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(res.statusCode).toBe(204);

    const followers = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_CHIARA}/followers`,
    });
    const ids = followers.json().data.map((u) => u.id);
    expect(ids).toContain(SEED.USER_MARCO);
  });

  it("POST follow e' idempotente (multipla chiamata OK)", async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    const r2 = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(r2.statusCode).toBe(204);
  });

  it('rifiuta self-follow (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('SELF_FOLLOW');
  });

  it('DELETE follow rimuove relazione', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(res.statusCode).toBe(204);
  });
});
