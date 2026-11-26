// =============================================================================
// tests/routes/posts.test.js
// =============================================================================

import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import {
  buildTestApp,
  authHeaders,
  createTestPrisma,
  randomPostContent,
  SEED,
} from '../helpers.mjs';

const prisma = createTestPrisma();
afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.postReport.deleteMany();
  await prisma.postReaction.deleteMany();
  await prisma.post.deleteMany();
});

describe('POST /api/posts', () => {
  it('crea un nuovo post', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: randomPostContent({ content: 'Hello world' }),
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toMatch(/^p_/); // prefisso p_
    expect(body.author.id).toBe(SEED.USER_CHIARA);
    expect(body.reactionsCount).toBe(0);
  });

  it('rifiuta content > 500 char (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { content: 'x'.repeat(501) },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rifiuta senza auth (401)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/posts',
      payload: randomPostContent(),
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/posts/feed', () => {
  it('feed include propri post + post di seguiti', async () => {
    const app = await buildTestApp();
    // Marco crea un post
    const own = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { content: 'Post di Marco' },
    });
    // Chiara crea un post
    const fromChiara = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { content: 'Post di Chiara' },
    });
    // Marco segue Chiara
    await app.inject({
      method: 'POST',
      url: `/api/users/${SEED.USER_CHIARA}/follow`,
      headers: await authHeaders(SEED.USER_MARCO),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/posts/feed',
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().data.map((p) => p.id);
    expect(ids).toContain(own.json().id);
    expect(ids).toContain(fromChiara.json().id);

    // cleanup follow
    await prisma.follow.deleteMany();
  });
});

describe('POST /api/posts/:id/reactions', () => {
  let postId;
  beforeEach(async () => {
    const app = await buildTestApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { content: 'Post per reaction' },
    });
    postId = r.json().id;
  });

  it('aggiunge reaction emoji', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/posts/${postId}/reactions`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { emoji: '👍' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reactionsCount).toBe(1);
  });

  it('upsert idempotente (no duplicato)', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/posts/${postId}/reactions`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { emoji: '👍' },
    });
    const r2 = await app.inject({
      method: 'POST',
      url: `/api/posts/${postId}/reactions`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { emoji: '👍' },
    });
    expect(r2.json().reactionsCount).toBe(1);
  });

  it('una reazione per utente: la nuova sostituisce la precedente', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: `/api/posts/${postId}/reactions`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { emoji: '👍' },
    });
    const r2 = await app.inject({
      method: 'POST',
      url: `/api/posts/${postId}/reactions`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { emoji: '❤️' },
    });
    expect(r2.json().reactionsCount).toBe(1);
    const post = await app.inject({
      method: 'GET',
      url: `/api/posts/${postId}`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(post.json().myReactions).toEqual(['❤️']);
    expect(post.json().reactionsByEmoji).toEqual({ '❤️': 1 });
  });

  it('rifiuta emoji fuori dalla lista (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/posts/${postId}/reactions`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { emoji: 'like' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/posts: regole', () => {
  it('rifiuta un post di soli spazi (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { content: '   \n  ' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('EMPTY_CONTENT');
  });

  it('rifiuta chi non ha volumi (403)', async () => {
    const app = await buildTestApp();
    // L'amministratore nel seed non ha libri
    const res = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_ADMIN),
      payload: { content: 'Ciao a tutti' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('NO_BOOKS');
  });
});

describe('POST /api/posts/:id/report', () => {
  it('crea report con reason valida', async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { content: 'Da segnalare' },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/posts/${created.json().id}/report`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { reason: 'off-topic', note: 'no' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().reason).toBe('off-topic');

    // Una sola volta per utente; il post risulta segnalato da lui
    const again = await app.inject({
      method: 'POST',
      url: `/api/posts/${created.json().id}/report`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { reason: 'spam' },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('ALREADY_REPORTED');
    const post = await app.inject({
      method: 'GET',
      url: `/api/posts/${created.json().id}`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(post.json().reportedByMe).toBe(true);
  });

  it('rifiuta la segnalazione di un proprio post (400)', async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { content: 'Mio post' },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/posts/${created.json().id}/report`,
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { reason: 'other' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('SELF_REPORT');
  });

  it('rifiuta reason non in enum (400)', async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { content: 'X' },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/posts/${created.json().id}/report`,
      headers: await authHeaders(SEED.USER_MARCO),
      payload: { reason: 'invalid-reason' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /api/posts/:id', () => {
  it("author puo' eliminare (soft-delete)", async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { content: 'Da eliminare' },
    });
    const id = created.json().id;
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/posts/${id}`,
      headers: await authHeaders(SEED.USER_CHIARA),
    });
    expect(res.statusCode).toBe(204);

    // soft-delete: il record esiste ancora ma status='removed'
    const post = await prisma.post.findUnique({ where: { id } });
    expect(post.status).toBe('removed');
  });

  it("non-author non puo' eliminare (403)", async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: await authHeaders(SEED.USER_CHIARA),
      payload: { content: 'X' },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/posts/${created.json().id}`,
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(res.statusCode).toBe(403);
  });
});
