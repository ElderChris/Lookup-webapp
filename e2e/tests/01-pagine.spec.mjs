// =============================================================================
// Tutte le pagine si aprono senza errori, solo con risorse del sito (salvo
// mappe e copertine), col pie' di pagina e la versione dal server.
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
  'profile.html',
  'profile-setup.html',
  'loans.html',
  'add-book.html',
  'admin.html',
];

async function checkPage(page, path) {
  const watch = watchPage(page);
  await page.goto(`/${path}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('footer.site-footer')).toHaveCount(1);
  await expect(page.locator('[data-app-version]')).toHaveText(/v\d+\.\d+\.\d+/);
  expect(await page.evaluate(() => typeof globalThis.API)).toBe('undefined');
  expect(watch.errors, `errori in ${path}`).toEqual([]);
  const external = [...watch.external].filter((h) => !ALLOWED_HOSTS.test(h));
  expect(external, `risorse esterne in ${path}`).toEqual([]);
}

test.describe('pagine da ospite', () => {
  for (const path of PUBLIC_PAGES) {
    test(path, async ({ page }) => checkPage(page, path));
  }

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
});
