// =============================================================================
// e2e/playwright.config.mjs — Test end-to-end dei percorsi principali
// =============================================================================
// Girano contro lo stack avviato (docker compose: sito su :8080, Mailpit su
// :8025) e lavorano solo con utenti creati dai test stessi, che vengono
// eliminati alla fine: i dati esistenti restano intatti. L'unico utente del
// seed usato e' l'amministratore (admin@lookup.local).
//
//   npx playwright install chromium     (una volta)
//   npm run test:e2e
//
// Variabili: E2E_BASE_URL, E2E_MAILPIT_URL, E2E_ADMIN_EMAIL,
// E2E_ADMIN_PASSWORD.
// =============================================================================

import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './helpers.mjs';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  // I percorsi condividono utenti e rispettano i limiti di richieste del
  // server (accesso, iscrizione): un test alla volta, in ordine
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  globalSetup: './global-setup.mjs',
  reporter: [['list'], ['html', { outputFolder: './report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    locale: 'it-IT',
    // Niente animazioni di scorrimento: i clic non cadono su elementi in movimento
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
