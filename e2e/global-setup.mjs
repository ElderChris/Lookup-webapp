// =============================================================================
// e2e/global-setup.mjs — Accesso dell'amministratore, salvato per i test
// =============================================================================
// Prova anche l'accesso dal modulo con ritorno alla pagina richiesta:
// /admin.html da ospite → login.html?next=/admin.html → /admin.html.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ADMIN, ADMIN_STATE, loginWithForm } from './helpers.mjs';

export default async function globalSetup(config) {
  const { baseURL } = config.projects[0].use;
  mkdirSync('e2e/.auth', { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto('/admin.html');
  await page.waitForURL(/\/login\.html\?next=%2Fadmin\.html/);
  await loginWithForm(page, ADMIN.email, ADMIN.password, '/admin.html');
  await page.waitForURL(/\/admin\.html$/);
  await page.context().storageState({ path: ADMIN_STATE });
  await browser.close();
}
