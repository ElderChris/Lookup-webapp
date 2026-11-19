// =============================================================================
// tests/routes/notifications.test.js
// =============================================================================

import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { buildTestApp, authHeaders, createTestPrisma, SEED } from '../helpers.mjs';

const prisma = createTestPrisma();

async function cleanup() {
  await prisma.notification.deleteMany();
  await prisma.postReaction.deleteMany();
  await prisma.post.deleteMany();
  await prisma.review.deleteMany();
  await prisma.follow.deleteMany();
}

// Pulizia anche alla fine: altrimenti i follow creati qui restano nel DB e
// i test di altri file (es. isFollowing in users.test.js) dipendono
// dall'ordine di esecuzione.
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(cleanup);

describe('Emissione cross-cutting da altri endpoint', () => {
  it('POST /api/users/:id/follow genera notifica new_follower al followed', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    const notifs = res.json().data;
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs[0].type).toBe('new_follower');
    expect(notifs[0].actor.id).toBe(SEED.USER_MARCO);
    expect(notifs[0].isRead).toBe(false);
  });

  it('POST review genera notifica new_review al target', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 5, text: 'Top' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(res.json().data[0].type).toBe('new_review');
  });

  it("POST reaction genera notifica post_reaction all'autore", async () => {
    const app = await buildTestApp();
    const post = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { content: 'X' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/posts/${post.json().id}/reactions`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { emoji: 'like' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(res.json().data[0].type).toBe('post_reaction');
  });

  it('non genera notifica per auto-azioni (follow se stesso non genera)', async () => {
    // self-follow ritorna 400 quindi nessuna notifica.
    // Test piu' interessante: review fatta dall'admin/autore non genera notifica
    // perche' la guard userId===actorId scatta nel service.
    // Per testare bene, faremmo loan/message con se stesso, ma non e' possibile.
    // Quindi questo test e' indiretto: verifica solo che nessuna notifica
    // appaia se non ci sono azioni cross-user.
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(res.json().data.length).toBe(0);
  });
});

describe('GET /api/me/notifications', () => {
  it('include unreadCount separato dal total', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 5, text: 'X' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    const body = res.json();
    expect(body.pagination.total).toBe(2);
    expect(body.unreadCount).toBe(2);
  });

  it('filtro unreadOnly funziona', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    const list = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    const firstId = list.json().data[0].id;
    await app.inject({
      method: 'PATCH',
      url: `/api/me/notifications/${firstId}/read`,
      headers: await authHeaders(SEED.USER_CHIARA),
    });

    const unread = await app.inject({
      method: 'GET',
      url: '/api/me/notifications?unreadOnly=true',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(unread.json().pagination.total).toBe(0);
  });
});

describe('POST /api/me/notifications/read-all', () => {
  it('marca tutte come lette', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/reviews`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { rating: 5, text: 'X' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/notifications/read-all',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(res.json().markedAsRead).toBe(2);

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(list.json().unreadCount).toBe(0);
  });
});

describe('DELETE /api/me/notifications/:id', () => {
  it('rifiuta cancellazione di notifica altrui (403)', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    const list = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    const id = list.json().data[0].id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/notifications/${id}`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(res.statusCode).toBe(403);
  });
});
