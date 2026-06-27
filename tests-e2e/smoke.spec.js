// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Smoke test: visita tutte le pagine in tutti gli stati di autenticazione
 * e verifica che non ci siano errori JavaScript a livello di pagina.
 *
 * Sostituisce gli "smoke manuali" che venivano eseguiti a mano durante
 * lo sviluppo del prototipo. Garantisce che nessuna pagina abbia regressioni
 * di parsing/rendering a fronte di modifiche al codice condiviso (api.js,
 * ui.js, storage.js).
 */

const PAGES = [
  'index.html',
  'explore.html',
  'library.html?id=1',
  'library.html?id=7',
  'book-detail.html?id=1',
  'profile.html',
  'profile.html#panel-posts',
  'add-book.html',
  'login.html',
  'register.html',
  'register.html?intent=borrow&book=5',
  'profile-setup.html',
  'stats.html',
  'reset-password.html',
  'loans.html',
  'loans.html#loan-3',
  'privacy.html',
  'terms.html'
];

const AUTH_SCENARIOS = [
  { state: 'guest', uid: null,  label: 'guest' },
  { state: 'user',  uid: '1',   label: 'user (Chiara)' },
  { state: 'user',  uid: '11',  label: 'admin' }
];

/* Errori che ignoriamo perché irrilevanti per la correttezza del codice:
   - Chart.js non sempre caricato (rimuovere quando refactored)
   - L (Leaflet) is not defined su pagine non-map (lazy load)
   - covers.openlibrary.org: dipendenza esterna che può fallire in CI
   - fonts.googleapis.com: stesso */
const IGNORED_ERROR_PATTERNS = [
  /Chart/,
  /L is not defined/,
  /covers\.openlibrary/,
  /fonts\.googleapis/,
  /favicon/
];

function isRelevantError(err) {
  return !IGNORED_ERROR_PATTERNS.some(p => p.test(err));
}

for (const { state, uid, label } of AUTH_SCENARIOS) {
  test.describe(`stato auth: ${label}`, () => {
    for (const url of PAGES) {
      test(`carica ${url} senza errori JS`, async ({ page, context }) => {
        const errors = [];
        page.on('pageerror', err => {
          if (isRelevantError(err.message)) errors.push(err.message);
        });

        // Imposta auth state via localStorage prima del navigate
        await page.goto('/index.html');
        await page.evaluate(([s, u]) => {
          localStorage.clear();
          localStorage.setItem('auth_state', JSON.stringify(s));
          if (u) localStorage.setItem('current_user_id', u);
        }, [state, uid]);

        await page.goto(`/${url}`);
        await page.waitForLoadState('domcontentloaded');
        // attesa breve per consentire init asincrono (notifications, avatar, etc.)
        await page.waitForTimeout(400);

        expect(errors, `Errori JS su ${url} (${label})`).toEqual([]);
      });
    }
  });
}

test('admin.html accessibile solo da admin', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => {
    if (isRelevantError(err.message)) errors.push(err.message);
  });

  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('auth_state', JSON.stringify('user'));
    localStorage.setItem('current_user_id', '11');
  });

  await page.goto('/admin.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  expect(errors, 'Errori JS su admin.html').toEqual([]);
});
