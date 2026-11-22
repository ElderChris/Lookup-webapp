// =============================================================================
// tests/routes/users.test.js
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  buildTestApp,
  authHeaders,
  createTestPrisma,
  createReturnedLoan,
  SEED,
} from '../helpers.mjs';

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

describe('Recensioni: /api/users/:id/reviews', () => {
  const TEXT = 'Libreria curata, prestito puntuale e cortese.';
  let loanId;

  beforeAll(async () => {
    // Marco ha preso in prestito un libro di Chiara e l'ha restituito
    loanId = await createReturnedLoan(prisma, {
      requesterId: SEED.USER_MARCO,
      lenderId: SEED.USER_CHIARA,
      bookId: SEED.BOOK_GATTOPARDO,
    });
  });
  afterAll(async () => {
    await prisma.loanRequest.delete({ where: { id: loanId } });
  });
  beforeEach(async () => {
    await prisma.review.deleteMany({ where: { targetUserId: SEED.USER_CHIARA } });
    await prisma.review.deleteMany({ where: { targetUserId: SEED.USER_MARCO } });
  });

  it('crea recensione (upsert) dopo un prestito concluso', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 5, text: TEXT },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().rating).toBe(5);
    expect(res.json().target.id).toBe(SEED.USER_CHIARA);
  });

  it("anche il prestatore puo' recensire chi ha preso in prestito", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_MARCO}/reviews`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { rating: 4, text: TEXT },
    });
    expect(res.statusCode).toBe(201);
  });

  it('upsert non duplica: secondo POST ha stessa id', async () => {
    const app = await buildTestApp();
    const r1 = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 5, text: TEXT },
    });
    const r2 = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 3, text: `${TEXT} Aggiornata.` },
    });
    expect(r1.json().id).toBe(r2.json().id);
    expect(r2.json().rating).toBe(3);
  });

  it('rifiuta senza prestito concluso (403)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_ANNA),
      payload: { rating: 5, text: TEXT },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('NO_COMPLETED_LOAN');
  });

  it('rifiuta testo sotto i 20 caratteri, spazi esclusi (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 5, text: '   Troppo breve     ' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TEXT_TOO_SHORT');
  });

  it('rifiuta self-review (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { rating: 5, text: TEXT },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('SELF_REVIEW');
  });

  it('GET reviews/me: permesso e recensione esistente', async () => {
    const app = await buildTestApp();
    const before = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_CHIARA}/reviews/me`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(before.json()).toMatchObject({ review: null, canReview: true, reason: null });

    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 4, text: TEXT },
    });
    const after = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_CHIARA}/reviews/me`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(after.json().review).toMatchObject({ rating: 4, text: TEXT });

    const received = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
    });
    expect(received.json().distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 });

    const other = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_CHIARA}/reviews/me`,
      headers: await authHeaders(SEED.USER_ANNA),
    });
    expect(other.json()).toMatchObject({ canReview: false, reason: 'no-completed-loan' });

    const self = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_CHIARA}/reviews/me`,
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(self.json()).toMatchObject({ canReview: false, reason: 'self' });
  });

  it('recensioni scritte riportano il destinatario', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 5, text: TEXT },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_MARCO}/reviews?role=written`,
    });
    expect(res.json().distribution).toMatchObject({ 5: expect.any(Number) });
    const mine = res.json().data.find((r) => r.target?.id === SEED.USER_CHIARA);
    expect(mine).toBeTruthy();
    expect(mine.target.displayName).toBe('Chiara Morandi');
  });
});

describe('Foto profilo e ruolo', () => {
  // PNG 1x1 trasparente
  const PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  afterAll(async () => {
    await prisma.user.update({
      where: { id: SEED.USER_LUCA },
      data: { avatarDataUrl: null, avatarUrl: null, libraryRole: 'curator' },
    });
  });

  it('salva la foto e la serve da /api/users/:id/avatar', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers: await authHeaders(SEED.USER_LUCA),
      payload: { avatarDataUrl: `data:image/png;base64,${PNG_B64}` },
    });
    expect(res.statusCode).toBe(200);
    const url = res.json().avatarUrl;
    expect(url).toMatch(new RegExp(`^/api/users/${SEED.USER_LUCA}/avatar\\?v=\\d+$`));

    const img = await app.inject({ method: 'GET', url });
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['cache-control']).toContain('immutable');
    expect(img.rawPayload.equals(Buffer.from(PNG_B64, 'base64'))).toBe(true);
  });

  it("null rimuove la foto (404 sull'immagine)", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers: await authHeaders(SEED.USER_LUCA),
      payload: { avatarDataUrl: null },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().avatarUrl).toBeNull();
    // null resta null nel database (non stringa vuota)
    const row = await prisma.user.findUnique({ where: { id: SEED.USER_LUCA } });
    expect(row.avatarDataUrl).toBeNull();
    const img = await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_LUCA}/avatar` });
    expect(img.statusCode).toBe(404);
  });

  it('rifiuta un formato non immagine (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers: await authHeaders(SEED.USER_LUCA),
      payload: { avatarDataUrl: 'data:text/html;base64,PGgxPng8L2gxPg==' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('libraryRole: lettore e ritorno a curatore; valori ignoti rifiutati', async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_LUCA);
    const r1 = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers,
      payload: { libraryRole: 'borrower' },
    });
    expect(r1.json().libraryRole).toBe('borrower');
    const agg = await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_LUCA}/library` });
    expect(agg.json().user.libraryRole).toBe('borrower');

    const bad = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers,
      payload: { libraryRole: 'admin' },
    });
    expect(bad.statusCode).toBe(400);

    const r2 = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers,
      payload: { libraryRole: 'curator' },
    });
    expect(r2.json().libraryRole).toBe('curator');
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

describe("PATCH /api/me/prefs: valori dell'interfaccia", () => {
  afterAll(async () => {
    await prisma.userPreference.updateMany({
      where: { userId: SEED.USER_LUCA },
      data: { theme: 'classic', viewMode: 'grid' },
    });
  });

  it('accetta i temi e le viste offerti dalla pagina impostazioni', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/prefs',
      headers: await authHeaders(SEED.USER_LUCA),
      payload: { theme: 'sage', viewMode: 'shelf' },
    });
    expect(res.statusCode).toBe(200);
    const agg = await app.inject({ method: 'GET', url: `/api/users/${SEED.USER_LUCA}/library` });
    expect(agg.json().prefs).toMatchObject({ theme: 'sage', viewMode: 'shelf' });
  });

  it('rifiuta un tema sconosciuto (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/prefs',
      headers: await authHeaders(SEED.USER_LUCA),
      payload: { theme: 'verde' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/users/:id/library', () => {
  afterAll(async () => {
    await prisma.follow.deleteMany({
      where: { followerId: SEED.USER_MARCO, followedId: SEED.USER_ANNA },
    });
  });

  it('visitatore autenticato: risponde con isFollowing', async () => {
    const app = await buildTestApp();
    const headers = await authHeaders(SEED.USER_MARCO);
    const before = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_ANNA}/library`,
      headers,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().isFollowing).toBe(false);

    await app.inject({ method: 'POST', url: `/api/users/${SEED.USER_ANNA}/follow`, headers });
    const after = await app.inject({
      method: 'GET',
      url: `/api/users/${SEED.USER_ANNA}/library`,
      headers,
    });
    expect(after.json().isFollowing).toBe(true);
    expect(after.json().stats.followersCount).toBeGreaterThan(0);
  });
});
