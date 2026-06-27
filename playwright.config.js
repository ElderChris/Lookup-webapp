// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Configurazione Playwright per i test E2E di Lookup.
 *
 * Fase 1a: i test E2E vivono in `tests-e2e/` in root (non sotto `apps/web/`).
 * Motivazione: in Fase 1+ i test attraverseranno i confini frontend↔backend
 * (es. signup → POST /api/users → check DB), quindi non appartengono a un
 * singolo workspace ma alla "junction" del monorepo.
 *
 * Il server frontend viene avviato da `apps/web/no-cache-server.py`.
 * In Fase 1c+, quando arriverà il backend, useremo docker compose per
 * avviare anche postgres + api durante i test.
 */
export default defineConfig({
  testDir: './tests-e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
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
    cwd: 'apps/web',
    url: 'http://localhost:8765',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
    stdout: 'ignore',
    stderr: 'pipe'
  }
});
