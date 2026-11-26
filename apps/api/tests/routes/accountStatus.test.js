// =============================================================================
// tests/routes/accountStatus.test.js — sospensione e cancellazione account
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { createEmailVerificationToken } from 'better-auth/api';
import { buildTestApp, createTestPrisma, authHeaders, SEED } from '../helpers.mjs';
import { auth } from '../../src/lib/auth.js';

const prisma = createTestPrisma();
const PREFIX = 'sttest';
let categoryId;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  const cat = await prisma.category.findFirst({ where: { isActive: true }, select: { id: true } });
  categoryId = cat.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

let n = 0;
/** Iscrive un utente con un volume; se verify, conferma l'email e torna il cookie. */
async function newUser({ verify = true } = {}) {
  const app = await buildTestApp();
  n += 1;
  const id = `${Date.now().toString(36)}${n}`;
  const p = {
    email: `${PREFIX}.${id}@example.com`,
    password: 'Password2026!',
    name: 'Utente di prova',
    username: `${PREFIX}.${id}`,
    accountType: 'person',
    acceptTerms: true,
    confirmAge: true,
    books: [{ title: 'Volume di prova', author: 'Autore', categoryId }],
  };
  const res = await app.inject({ method: 'POST', url: '/api/register', payload: p });
  expect(res.statusCode).toBe(201);
  const user = await prisma.user.findUnique({
    where: { email: p.email },
    include: { books: true },
  });
  let cookie = null;
  if (verify) {
    const ctx = await auth.$context;
    const token = await createEmailVerificationToken(ctx.secret, p.email);
    const v = await app.inject({ method: 'GET', url: `/api/auth/verify-email?token=${token}` });
    expect(v.statusCode).toBe(200);
    cookie = []
      .concat(v.headers['set-cookie'] || [])
      .map((c) => c.split(';')[0])
      .join('; ');
  }
  return { ...p, id: user.id, bookId: user.books[0].id, cookie };
}

async function signIn(email, password) {
  const app = await buildTestApp();
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: 'http://localhost:8080' },
    payload: { email, password },
  });
}

async function adminPatch(id, payload) {
  const app = await buildTestApp();
  return app.inject({
    method: 'PATCH',
    url: `/api/admin/users/${id}`,
    headers: await authHeaders(SEED.USER_ADMIN),
    payload,
  });
}

describe('sospensione', () => {
  it("chiude le sessioni, blocca l'accesso e nasconde profilo e volumi; riattivando torna tutto", async () => {
    const app = await buildTestApp();
    const u = await newUser();

    const me = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { cookie: u.cookie },
    });
    expect(me.statusCode).toBe(200);

    expect((await adminPatch(u.id, { status: 'suspended' })).statusCode).toBe(200);

    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { cookie: u.cookie },
    });
    expect(meAfter.statusCode).toBe(401);
    const login = await signIn(u.email, u.password);
    expect(login.statusCode).toBe(403);
    expect(login.json().code).toBe('ACCOUNT_SUSPENDED');

    const list = await app.inject({ method: 'GET', url: `/api/books?ownerId=${u.id}` });
    expect(list.json().data).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url: `/api/books/${u.bookId}` })).statusCode).toBe(
      404
    );
    expect((await app.inject({ method: 'GET', url: `/api/users/${u.id}` })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url: `/api/users/${u.id}/library` })).statusCode
    ).toBe(404);
    // L'amministratore continua a vederlo
    const asAdmin = await app.inject({
      method: 'GET',
      url: `/api/users/${u.id}`,
      headers: await authHeaders(SEED.USER_ADMIN),
    });
    expect(asAdmin.statusCode).toBe(200);

    expect((await adminPatch(u.id, { status: 'active' })).statusCode).toBe(200);
    expect((await signIn(u.email, u.password)).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/books/${u.bookId}` })).statusCode).toBe(
      200
    );
  });

  it("l'amministratore non puo' sospendere se stesso", async () => {
    const res = await adminPatch(SEED.USER_ADMIN, { status: 'suspended' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('CANNOT_CHANGE_SELF');
  });

  it("conferma dell'email fatta dall'amministratore: account attivo e volumi pubblicati", async () => {
    const u = await newUser({ verify: false });
    const res = await adminPatch(u.id, { emailVerified: true });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('active');
    const book = await prisma.book.findUnique({ where: { id: u.bookId } });
    expect(book.status).toBe('active');
  });
});

describe('cancellazione', () => {
  it("dall'amministratore: account e volumi spariscono", async () => {
    const app = await buildTestApp();
    const u = await newUser();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${u.id}`,
      headers: await authHeaders(SEED.USER_ADMIN),
    });
    expect(res.statusCode).toBe(204);
    expect(await prisma.user.count({ where: { id: u.id } })).toBe(0);
    expect(await prisma.book.count({ where: { id: u.bookId } })).toBe(0);
  });

  it("dall'utente: serve la password giusta, poi account e sessioni spariscono", async () => {
    const app = await buildTestApp();
    const u = await newUser();
    const wrong = await app.inject({
      method: 'DELETE',
      url: '/api/users/me',
      headers: { cookie: u.cookie },
      payload: { password: 'sbagliata' },
    });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json().error.code).toBe('INVALID_PASSWORD');

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/users/me',
      headers: { cookie: u.cookie },
      payload: { password: u.password },
    });
    expect(res.statusCode).toBe(204);
    expect(await prisma.user.count({ where: { id: u.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: u.id } })).toBe(0);
    const me = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { cookie: u.cookie },
    });
    expect(me.statusCode).toBe(401);
  });

  it('senza accesso: 401', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/users/me',
      payload: { password: 'x' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('volumi (amministrazione)', () => {
  it('elenco completo con filtro per stato; solo per gli amministratori', async () => {
    const app = await buildTestApp();
    const u = await newUser({ verify: false });
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/books?status=pending_email&limit=200',
      headers: await authHeaders(SEED.USER_ADMIN),
    });
    expect(res.statusCode).toBe(200);
    const row = res.json().data.find((b) => b.id === u.bookId);
    expect(row).toMatchObject({ status: 'pending_email', owner: { id: u.id, status: 'pending' } });

    const asUser = await app.inject({
      method: 'GET',
      url: '/api/admin/books',
      headers: await authHeaders(SEED.USER_MARCO),
    });
    expect(asUser.statusCode).toBe(403);
  });

  it('nascondere e ripubblicare; un volume in attesa di conferma non si pubblica a mano', async () => {
    const app = await buildTestApp();
    const admin = await authHeaders(SEED.USER_ADMIN);
    const u = await newUser();
    const hide = await app.inject({
      method: 'PATCH',
      url: `/api/admin/books/${u.bookId}`,
      headers: admin,
      payload: { status: 'hidden' },
    });
    expect(hide.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/books/${u.bookId}` })).statusCode).toBe(
      404
    );
    await app.inject({
      method: 'PATCH',
      url: `/api/admin/books/${u.bookId}`,
      headers: admin,
      payload: { status: 'active' },
    });
    expect((await app.inject({ method: 'GET', url: `/api/books/${u.bookId}` })).statusCode).toBe(
      200
    );

    const pending = await newUser({ verify: false });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/books/${pending.bookId}`,
      headers: admin,
      payload: { status: 'active' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BOOK_PENDING_EMAIL');
  });
});
