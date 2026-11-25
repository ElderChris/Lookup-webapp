// =============================================================================
// Tutte le pagine si aprono senza errori, solo con risorse del sito (salvo
// mappe e copertine), col pie' di pagina e la versione dal server, e senza
// campi mancanti nel testo mostrato (undefined, NaN, [object Object]).
// =============================================================================

import { test, expect } from '@playwright/test';
import { ADMIN_STATE, ALLOWED_HOSTS, watchPage } from '../helpers.mjs';

const PUBLIC_PAGES = [
  'index.html',
  'explore.html',
  'stats.html',
  'library.html?id=usr_chiara',
  'book-detail.html?id=1',
  'register.html',
  'login.html',
  'reset-password.html',
  'verify-email.html',
  'privacy.html',
  'terms.html',
];
const PRIVATE_PAGES = [
  'index.html',
  'library.html?id=usr_chiara',
  'profile.html',
  'profile-setup.html',
  'loans.html',
  'add-book.html',
  'admin.html',
];

// Testo che compare quando la pagina legge un campo che il server non manda
const MISSING_FIELD = /\bundefined\b|\bNaN\b|\[object Object\]/;

async function expectNoMissingFields(page, path) {
  const text = await page.locator('body').innerText();
  const hit = text.match(MISSING_FIELD);
  expect(
    hit && text.slice(Math.max(0, hit.index - 60), hit.index + 30),
    `campo mancante in ${path}`
  ).toBeNull();
}

async function checkPage(page, path) {
  const watch = watchPage(page);
  await page.goto(`/${path}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('footer.site-footer')).toHaveCount(1);
  await expect(page.locator('[data-app-version]')).toHaveText(/v\d+\.\d+\.\d+/);
  expect(await page.evaluate(() => typeof globalThis.API)).toBe('undefined');
  await expectNoMissingFields(page, path);
  expect(watch.errors, `errori in ${path}`).toEqual([]);
  const external = [...watch.external].filter((h) => !ALLOWED_HOSTS.test(h));
  expect(external, `risorse esterne in ${path}`).toEqual([]);
}

test.describe('pagine da ospite', () => {
  for (const path of PUBLIC_PAGES) {
    test(path, async ({ page }) => checkPage(page, path));
  }

  test('statistiche: il dettaglio di un libro si apre con i suoi numeri', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/stats.html');
    await page.locator('.top-book-item__toggle').first().click();
    await expect(page.locator('.book-detail-stats__since').first()).toBeVisible();
    await expectNoMissingFields(page, 'stats.html (dettaglio)');
    expect(watch.errors).toEqual([]);
  });

  test('libreria: le schede dei volumi mostrano genere e città', async ({ page }) => {
    await page.goto('/library.html?id=usr_chiara');
    const card = page.locator('#books-container .book-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.book-card__category')).not.toHaveText('');
    await expect(card.locator('.book-card__meta span').first()).not.toHaveText('');
    await expectNoMissingFields(page, 'library.html');
  });

  test('esplora: la ricerca trova anche con un errore di battitura', async ({ page }) => {
    // Invio subito, anche mentre la pagina carica ancora la mappa
    await page.goto('/explore.html', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="search"]', 'Calvno');
    await page.keyboard.press('Enter');
    await expect(page.locator('.result-item__title')).toContainText(['Le città invisibili']);
  });

  test('esplora: un link con ?q= mostra subito i risultati', async ({ page }) => {
    await page.goto('/explore.html?q=Gattopardo');
    await expect(page.locator('#search-query')).toHaveValue('Gattopardo');
    await expect(page.locator('.result-item__title')).toContainText(['Il Gattopardo']);
  });

  test.describe('esplora: "Usa la mia posizione"', () => {
    // Posizione simulata del dispositivo: Napoli, piazza Dante
    test.use({ geolocation: { latitude: 40.8489, longitude: 14.2502 } });

    test('con il permesso: raggio attivo, cerchio sulla mappa, risultati vicini', async ({
      page,
      context,
    }) => {
      await context.grantPermissions(['geolocation']);
      await page.goto('/explore.html');
      await expect(page.locator('#search-radius')).toBeDisabled();
      await page.click('#use-position');
      await expect(page.locator('#position-status')).toContainText('posizione attuale');
      await expect(page.locator('#search-radius')).toBeEnabled();
      await expect(page.locator('#radius-ref')).toContainText('posizione attuale del dispositivo');

      await page.locator('#search-radius').fill('2');
      await expect(page.locator('#radius-label')).toHaveText('entro 2 km');
      await expect(page.locator('path.search-radius-circle')).toHaveCount(1);
      await page.fill('#search-query', 'Napoli');
      await page.keyboard.press('Enter');
      const within = await page.locator('.result-item').count();
      await page.locator('#search-radius').fill('0');
      await expect(page.locator('path.search-radius-circle')).toHaveCount(0);
      await expect.poll(() => page.locator('.result-item').count()).toBeGreaterThan(within);
    });

    test('senza permesso: messaggio chiaro e raggio disattivato', async ({ page }) => {
      await page.goto('/explore.html');
      await page.click('#use-position');
      await expect(page.locator('#position-status')).toContainText('Permesso negato');
      await expect(page.locator('#search-radius')).toBeDisabled();
    });
  });

  test("le pagine riservate rimandano all'accesso con ritorno", async ({ page }) => {
    await page.goto('/loans.html');
    await expect(page).toHaveURL(/\/login\.html\?next=%2Floans\.html$/);
  });
});

test.describe('pagine da amministratore', () => {
  test.use({ storageState: ADMIN_STATE });
  for (const path of PRIVATE_PAGES) {
    test(path, async ({ page }) => checkPage(page, path));
  }

  test("il service worker non salva le risposte dell'API (dati personali)", async ({ page }) => {
    await page.goto('/profile.html');
    await page.waitForFunction(() => globalThis.navigator.serviceWorker.controller !== null);
    for (const path of ['/profile.html', '/loans.html', '/index.html']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    const cached = await page.evaluate(async () => {
      const urls = [];
      for (const name of await globalThis.caches.keys()) {
        const cache = await globalThis.caches.open(name);
        urls.push(...(await cache.keys()).map((r) => new URL(r.url).pathname));
      }
      return urls;
    });
    expect(cached.length).toBeGreaterThan(0);
    expect(cached.filter((u) => u.startsWith('/api/'))).toEqual([]);
  });
});

// Su un telefono nessuna pagina scorre in orizzontale e il testo non tocca i
// bordi dello schermo
/* global document */
async function checkMobile(page, path) {
  await page.goto(`/${path}`);
  await page.waitForLoadState('networkidle');
  const r = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const edge = [...document.querySelectorAll('main h1, main h2, main p')]
      .filter((e) => e.offsetParent && !e.closest('.leaflet-container'))
      .filter((e) => e.getBoundingClientRect().left < 8)
      .map((e) => e.textContent.trim().slice(0, 40));
    return { overflow: document.documentElement.scrollWidth - cw, edge };
  });
  expect(r.overflow, `scorrimento orizzontale in ${path}`).toBeLessThanOrEqual(0);
  expect(r.edge, `testo a filo del bordo in ${path}`).toEqual([]);
}

test.describe('vista mobile (375 px)', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  for (const path of PUBLIC_PAGES) {
    test(path, async ({ page }) => checkMobile(page, path));
  }
});

test.describe('vista mobile (375 px) da amministratore', () => {
  test.use({
    storageState: ADMIN_STATE,
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  for (const path of PRIVATE_PAGES) {
    test(path, async ({ page }) => checkMobile(page, path));
  }
});
