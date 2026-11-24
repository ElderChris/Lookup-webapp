// =============================================================================
// e2e/helpers.mjs — Funzioni comuni dei test end-to-end
// =============================================================================

import { expect } from '@playwright/test';

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL || 'http://localhost:8025';
export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || 'admin@lookup.local',
  password: process.env.E2E_ADMIN_PASSWORD || 'Lookup2026!',
};
export const ADMIN_STATE = 'e2e/.auth/admin.json';

/** Prefisso dei nomi utente creati dai test (per riconoscerli e cancellarli). */
export const E2E_PREFIX = 'e2e.';

/** Dati di un nuovo utente di prova, unici per esecuzione. */
export function newPerson(tag) {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  return {
    name: `Prova ${tag}`,
    username: `${E2E_PREFIX}${tag}.${id}`,
    email: `e2e-${tag}-${id}@example.com`,
    password: `Prova-${id}!`,
  };
}

/**
 * Attende l'email piu' recente per `to` con oggetto che contiene `subject` e
 * restituisce il primo link che contiene `linkPart`.
 */
export async function linkFromEmail(request, to, subject, linkPart) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const res = await request.get(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`
    );
    if (res.ok()) {
      const { messages = [] } = await res.json();
      const msg = messages.find((m) => m.Subject.includes(subject));
      if (msg) {
        const full = await (await request.get(`${MAILPIT_URL}/api/v1/message/${msg.ID}`)).json();
        const links = [...full.HTML.matchAll(/href="([^"]+)"/g)].map((m) =>
          m[1].replace(/&amp;/g, '&')
        );
        const link = links.find((l) => l.includes(linkPart));
        if (link) return link;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nessuna email "${subject}" per ${to}`);
}

/** Email ricevute da `to` con oggetto che contiene `subject`. */
export async function emailsFor(request, to, subject) {
  const res = await request.get(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`
  );
  const { messages = [] } = await res.json();
  return messages.filter((m) => m.Subject.includes(subject));
}

/**
 * Accesso dal modulo di login. Il server limita gli accessi per indirizzo
 * (5 al minuto): se il limite e' raggiunto si attende e si riprova.
 */
export async function loginWithForm(page, email, password, next) {
  const url = next ? `/login.html?next=${encodeURIComponent(next)}` : '/login.html';
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(url);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#login-form button[type="submit"]');
    const outcome = await Promise.race([
      page
        .waitForURL((u) => !u.pathname.endsWith('/login.html'), { timeout: 15_000 })
        .then(() => 'ok'),
      page
        .locator('#login-error:not([hidden])')
        .waitFor({ timeout: 15_000 })
        .then(() => 'error'),
    ]);
    if (outcome === 'ok') return;
    const text = await page.locator('#login-error').innerText();
    if (!/troppi tentativi/i.test(text)) return; // errore atteso dal chiamante
    await page.waitForTimeout(61_000);
  }
}

/** Unici host esterni che le pagine possono contattare (vedi informativa). */
export const ALLOWED_HOSTS = /(^|\.)tile\.openstreetmap\.org$|^covers\.openlibrary\.org$/;

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/** Raccoglie errori JavaScript e richieste a host esterni di una pagina. */
export function watchPage(page) {
  const errors = [];
  const external = new Set();
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // Risorse dei servizi esterni ammessi (mappe, copertine): possono mancare
    // (copertina inesistente, rete assente) senza che sia un errore del sito
    const from = msg.location()?.url || '';
    if (/^Failed to load resource/.test(msg.text()) && ALLOWED_HOSTS.test(hostOf(from))) return;
    errors.push(msg.text());
  });
  const base = new URL(BASE_URL).host;
  page.on('request', (req) => {
    if (!/^https?:/.test(req.url())) return;
    const host = new URL(req.url()).host;
    if (host !== base) external.add(host);
  });
  return { errors, external };
}

/** Elimina dal server gli utenti creati dai test ancora presenti. */
export async function deleteTestUsers(adminRequest) {
  const res = await adminRequest.get(
    `/api/admin/users?q=${encodeURIComponent(E2E_PREFIX)}&limit=200`
  );
  if (!res.ok()) return;
  const { data } = await res.json();
  for (const u of data.filter((x) => x.username.startsWith(E2E_PREFIX))) {
    await adminRequest.delete(`/api/admin/users/${encodeURIComponent(u.id)}`);
  }
}

export { expect };
