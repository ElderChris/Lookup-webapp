// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Configurazione Playwright per i test E2E di Libreria Diffusa.
 *
 * Decisioni di design:
 * - `webServer`: Playwright avvia automaticamente il server Python statico
 *   prima di eseguire i test. Stop al termine. Non serve avviare manualmente.
 * - `baseURL`: tutti i test usano path relativi (es. page.goto('/index.html')).
 * - Solo Chromium per ora: gli smoke originali giravano solo lì. Su CI possiamo
 *   abilitare anche Firefox/Webkit più avanti se ne vediamo il bisogno.
 * - `reporter`: dot in locale (output succinto), html su CI (artifact con
 *   screenshot dei test falliti).
 * - `retries`: 1 su CI per gestire flake transient, 0 in locale.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // i test condividono localStorage in clear/reload sequenziale
  workers: 1,           // un solo worker per evitare race condition sul server
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['dot']],

  use: {
    baseURL: 'http://localhost:8765',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: {
    command: 'python3 no-cache-server.py 8765',
    url: 'http://localhost:8765',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
    stdout: 'ignore',
    stderr: 'pipe'
  }
});
