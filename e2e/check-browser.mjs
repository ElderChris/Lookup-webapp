// Esce con 0 se il Chromium usato da Playwright e' installato, 3 altrimenti.
// Usato da scripts/verify.ps1 per decidere se eseguire i test nel browser.
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

process.exit(existsSync(chromium.executablePath()) ? 0 : 3);
