// =============================================================================
// tests/routes/register.test.js — iscrizione e conferma dell'email
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { createEmailVerificationToken } from 'better-auth/api';
import { buildTestApp, createTestPrisma } from '../helpers.mjs';
import { auth } from '../../src/lib/auth.js';
import { verifyEmailLink, resetPasswordLink } from '../../src/lib/authLinks.js';

const prisma = createTestPrisma();
const PREFIX = 'regtest';
const CALLBACK = 'http://localhost:8080/verify-email.html?next=%2Fprofile.html';

let categoryId;

async function cleanup() {
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
}

beforeAll(async () => {
  await cleanup();
  const cat = await prisma.category.findFirst({ where: { isActive: true }, select: { id: true } });
  categoryId = cat.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

let n = 0;
function body(overrides = {}) {
  n += 1;
  const id = `${Date.now().toString(36)}${n}`;
  return {
    email: `${PREFIX}.${id}@example.com`,
    password: 'Password2026!',
    name: 'Persona di prova',
    username: `${PREFIX}.${id}`,
    accountType: 'person',
    bio: 'Raccolgo romanzi e saggi di storia.',
    city: 'Napoli',
    motto: 'Leggere sempre',
    theme: 'sage',
    acceptTerms: true,
    confirmAge: true,
    callbackURL: CALLBACK,
    ...overrides,
  };
}

async function register(payload) {
  const app = await buildTestApp();
  return app.inject({ method: 'POST', url: '/api/register', payload });
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

async function verify(email) {
  const app = await buildTestApp();
  const ctx = await auth.$context;
  const token = await createEmailVerificationToken(ctx.secret, email);
  return app.inject({ method: 'GET', url: `/api/auth/verify-email?token=${token}` });
}

describe('GET /api/users/check-username', () => {
  it('nome di un utente esistente: non disponibile', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/check-username?username=Marco.DeVito',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ username: 'marco.devito', valid: true, available: false });
  });

  it('nome libero e nome non valido', async () => {
    const app = await buildTestApp();
    const free = await app.inject({
      method: 'GET',
      url: `/api/users/check-username?username=${PREFIX}.libero`,
    });
    expect(free.json().available).toBe(true);
    const bad = await app.inject({ method: 'GET', url: '/api/users/check-username?username=a b' });
    expect(bad.json()).toMatchObject({ valid: false, available: false });
  });
});

describe('POST /api/register', () => {
  it('crea account in attesa, preferenze e volumi nascosti; nessuna sessione', async () => {
    const p = body({
      books: [
        { title: 'Il Gattopardo', author: 'G. Tomasi di Lampedusa', year: 1958, categoryId },
        { title: 'Le città invisibili', author: 'Italo Calvino', categoryId },
      ],
    });
    const res = await register(p);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ status: 'verification_sent', email: p.email });
    expect(res.headers['set-cookie']).toBeUndefined();

    const user = await prisma.user.findUnique({
      where: { email: p.email },
      include: { preferences: true, books: true },
    });
    expect(user.status).toBe('pending');
    expect(user.emailVerified).toBe(false);
    expect(user.libraryRole).toBe('curator');
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
    expect(user.city).toBe('Napoli');
    expect(user.preferences).toMatchObject({ theme: 'sage', motto: 'Leggere sempre' });
    expect(user.books).toHaveLength(2);
    expect(user.books.every((b) => b.status === 'pending_email')).toBe(true);

    // I volumi non compaiono nel catalogo ne' nel dettaglio
    const app = await buildTestApp();
    const list = await app.inject({ method: 'GET', url: `/api/books?ownerId=${user.id}` });
    expect(list.json().data).toHaveLength(0);
    const one = await app.inject({ method: 'GET', url: `/api/books/${user.books[0].id}` });
    expect(one.statusCode).toBe(404);
  });

  it("senza conferma non si entra; la conferma attiva l'account, pubblica i volumi e apre la sessione", async () => {
    const p = body({
      books: [{ title: 'Lessico famigliare', author: 'Natalia Ginzburg', categoryId }],
    });
    expect((await register(p)).statusCode).toBe(201);

    const before = await signIn(p.email, p.password);
    expect(before.statusCode).toBe(403);
    expect(before.json().code).toBe('EMAIL_NOT_VERIFIED');

    const res = await verify(p.email);
    expect(res.statusCode).toBe(200);
    const cookie = [].concat(res.headers['set-cookie'] || []).join('; ');
    expect(cookie).toMatch(/session_token=/);

    const user = await prisma.user.findUnique({
      where: { email: p.email },
      include: { books: true },
    });
    expect(user.emailVerified).toBe(true);
    expect(user.status).toBe('active');
    expect(user.books[0].status).toBe('active');

    const after = await signIn(p.email, p.password);
    expect(after.statusCode).toBe(200);
  });

  it('lettore: ruolo borrower e nessun volume', async () => {
    const p = body({ libraryRole: 'borrower', bio: undefined, motto: undefined, theme: undefined });
    expect((await register(p)).statusCode).toBe(201);
    const user = await prisma.user.findUnique({
      where: { email: p.email },
      include: { preferences: true, books: true },
    });
    expect(user.libraryRole).toBe('borrower');
    expect(user.preferences).toBeNull();
    expect(user.books).toHaveLength(0);
  });

  it("ente: crea il profilo dell'ente; senza dati dell'ente rifiuta", async () => {
    const missing = await register(body({ accountType: 'organization' }));
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.code).toBe('ORGANIZATION_REQUIRED');

    const p = body({
      accountType: 'organization',
      organization: {
        legalName: 'Associazione di prova APS',
        orgCategory: 'associazione_culturale',
        contactPerson: 'Referente',
        publicAddress: 'Via Toledo 1, Napoli',
        openingHours: 'Lun-Ven 10-18',
      },
    });
    expect((await register(p)).statusCode).toBe(201);
    const user = await prisma.user.findUnique({
      where: { email: p.email },
      include: { organizationProfile: true },
    });
    expect(user.accountType).toBe('organization');
    expect(user.organizationProfile).toMatchObject({
      legalName: 'Associazione di prova APS',
      orgCategory: 'associazione_culturale',
      publicEmail: null,
    });
  });

  it("email gia' registrata: stessa risposta, nessun nuovo account", async () => {
    const p = body({ email: 'm.devito@mail.it' });
    const res = await register(p);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ status: 'verification_sent', email: 'm.devito@mail.it' });
    expect(await prisma.user.count({ where: { username: p.username } })).toBe(0);
  });

  it('nome utente in uso: 409', async () => {
    const res = await register(body({ username: 'marco.devito' }));
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('USERNAME_TAKEN');
  });

  it('consensi obbligatori', async () => {
    expect((await register(body({ acceptTerms: false }))).statusCode).toBe(400);
    const { confirmAge, ...noAge } = body();
    expect(confirmAge).toBe(true);
    expect((await register(noAge)).statusCode).toBe(400);
  });

  it('pagina di ritorno esterna o categoria inesistente: 400 e nulla di creato', async () => {
    const evil = body({ callbackURL: 'https://example.org/verify-email.html' });
    const r1 = await register(evil);
    expect(r1.statusCode).toBe(400);
    expect(r1.json().error.code).toBe('INVALID_CALLBACK_URL');

    const badCat = body({ books: [{ title: 'X', author: 'Y', categoryId: 999999 }] });
    const r2 = await register(badCat);
    expect(r2.statusCode).toBe(400);
    expect(r2.json().error.code).toBe('INVALID_CATEGORY');

    expect(await prisma.user.count({ where: { email: { in: [evil.email, badCat.email] } } })).toBe(
      0
    );
  });
});

describe('link delle email', () => {
  it('verifica: pagina del sito con i suoi parametri piu il token', () => {
    const url = `http://localhost:3001/api/auth/verify-email?token=T&callbackURL=${encodeURIComponent(CALLBACK)}`;
    const link = new URL(verifyEmailLink(url, 'abc'));
    expect(link.origin).toBe('http://localhost:8080');
    expect(link.pathname).toBe('/verify-email.html');
    expect(link.searchParams.get('next')).toBe('/profile.html');
    expect(link.searchParams.get('token')).toBe('abc');
  });

  it('verifica: pagina di ritorno non fidata sostituita da quella predefinita', () => {
    const url = `http://localhost:3001/api/auth/verify-email?token=T&callbackURL=${encodeURIComponent('https://example.org/verify-email.html?next=x')}`;
    const link = new URL(verifyEmailLink(url, 'abc'));
    expect(link.origin).toBe('http://localhost:8080');
    expect(link.searchParams.get('next')).toBeNull();
  });

  it('reset: pagina reset-password.html con il token', () => {
    const url = `http://localhost:3001/api/auth/reset-password/abc?callbackURL=${encodeURIComponent('http://localhost:8080/reset-password.html')}`;
    expect(resetPasswordLink(url, 'abc')).toBe(
      'http://localhost:8080/reset-password.html?token=abc'
    );
  });
});
