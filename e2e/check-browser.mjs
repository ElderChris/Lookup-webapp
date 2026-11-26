// Esce con 0 se Playwright riesce ad avviare Chromium (la stessa versione
// usata dai test), 3 altrimenti stampando il motivo. Usato da
// scripts/verify.ps1 per decidere se eseguire i test nel browser.
import { chromium } from '@playwright/test';

try {
  const browser = await chromium.launch();
  console.log(`Chromium ${browser.version()}`);
  await browser.close();
} catch (err) {
  console.log(String(err.message || err).split('\n')[0]);
  process.exit(3);
}
