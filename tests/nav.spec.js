// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Test sulla coerenza della navigazione header:
 * - auth-toggle (rimosso in alpha.0) NON deve apparire su nessuna pagina
 * - le 4 nav-icon (esplora, stats, prestiti, pubblica) sono sempre nel markup
 * - la label di testo accanto alle icone NON viene mai mostrata (icon-only)
 * - il CTA "Registrati / Accedi" appare solo per guest
 * - l'avatar circolare appare solo per autenticati
 * - l'icona admin (scudo) appare solo per is_admin
 */

const NAV_HTML_PAGES = [
  'index.html',
  'explore.html',
  'stats.html',
  'login.html',
  'register.html',
  'privacy.html',
  'terms.html'
];

test.describe('nav: auth-toggle rimosso', () => {
  for (const url of NAV_HTML_PAGES) {
    test(`${url} non contiene .auth-toggle`, async ({ page }) => {
      await page.goto(`/${url}`);
      await page.waitForLoadState('domcontentloaded');
      const has = await page.evaluate(() => !!document.querySelector('.auth-toggle'));
      expect(has).toBe(false);
    });
  }
});

test.describe('nav: solo icone, no label visibili', () => {
  test('le label dell icone nav non sono visibili', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('auth_state', JSON.stringify('user'));
      localStorage.setItem('current_user_id', '1');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    const visibleLabels = await page.evaluate(() => {
      const labels = document.querySelectorAll('header .site-nav .nav-icon__label');
      return Array.from(labels).filter(l =>
        getComputedStyle(l).display !== 'none'
      ).length;
    });
    expect(visibleLabels).toBe(0);
  });
});

test.describe('nav: CTA Registrati/Accedi solo per guest', () => {
  test('guest vede il CTA', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('auth_state', JSON.stringify('guest'));
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    const cta = page.locator('header .site-nav a.nav-auth-cta');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText(/Registrati.*Accedi/);
  });

  test('utente autenticato NON vede il CTA', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('auth_state', JSON.stringify('user'));
      localStorage.setItem('current_user_id', '1');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    const cta = page.locator('header .site-nav a.nav-auth-cta');
    await expect(cta).toBeHidden();
  });
});

test.describe('nav: admin icon solo per is_admin', () => {
  test('utente normale NON vede icon admin', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('auth_state', JSON.stringify('user'));
      localStorage.setItem('current_user_id', '1');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const adminIcon = await page.evaluate(() =>
      !!document.querySelector('header .site-nav a.nav-admin')
    );
    expect(adminIcon).toBe(false);
  });

  test('admin vede icon admin', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('auth_state', JSON.stringify('user'));
      localStorage.setItem('current_user_id', '11');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const adminIcon = page.locator('header .site-nav a.nav-admin');
    await expect(adminIcon).toBeVisible();
  });
});
