// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Test sugli algoritmi business critici dell'API:
 * - getFeaturedBooks: trend algorithm con diversity penalty
 * - getWelcomeMessage: rotazione gender-neutral
 * - isBookRecent / isLibraryFresh: helper temporali
 * - getPostsFromFollowed: esclusione post propri
 *
 * Questi test verificano i contratti di output dei metodi che alimentano
 * la home page e la pagina statistiche.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
});

test.describe('API.getFeaturedBooks (algoritmo trend)', () => {
  test('restituisce esattamente N libri', async ({ page }) => {
    const count = await page.evaluate(() => API.getFeaturedBooks(4).length);
    expect(count).toBe(4);
  });

  test('include solo libri available=true', async ({ page }) => {
    const allAvailable = await page.evaluate(() =>
      API.getFeaturedBooks(10).every(c => c.book.available === true)
    );
    expect(allAvailable).toBe(true);
  });

  test('ogni candidato ha trend_score numerico', async ({ page }) => {
    const result = await page.evaluate(() =>
      API.getFeaturedBooks(4).map(c => ({
        hasScore: typeof c.trend_score === 'number',
        hasBook: !!c.book && !!c.book.id
      }))
    );
    expect(result.every(r => r.hasScore && r.hasBook)).toBe(true);
  });

  test('diversity penalty riduce score di categorie già selezionate', async ({ page }) => {
    const featured = await page.evaluate(() => API.getFeaturedBooks(10));
    // conta categorie nei primi 4
    const categories = featured.slice(0, 4).map(c => c.book.category);
    const counts = {};
    categories.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
    // nessuna categoria dovrebbe avere più di 2 occorrenze nei top 4
    const maxCount = Math.max(...Object.values(counts));
    expect(maxCount).toBeLessThanOrEqual(2);
  });
});

test.describe('API.getWelcomeMessage', () => {
  test('è gender-neutral (no "Bentornata"/"Bentornato")', async ({ page }) => {
    const msgs = await page.evaluate(() => API.WELCOME_MESSAGES);
    // L'unica eccezione consentita è "Bentornat*" con asterisco inclusivo
    const problematic = msgs.filter(m => /Bentornat[oa]\b/.test(m));
    expect(problematic, 'Frasi con genere esplicito trovate').toEqual([]);
  });

  test('ha almeno 15 frasi diverse', async ({ page }) => {
    const count = await page.evaluate(() => API.WELCOME_MESSAGES.length);
    expect(count).toBeGreaterThanOrEqual(15);
  });

  test('include {name} placeholder in ogni frase', async ({ page }) => {
    const all = await page.evaluate(() => API.WELCOME_MESSAGES);
    expect(all.every(m => m.includes('{name}'))).toBe(true);
  });

  test('rotazione: indici diversi → messaggi diversi', async ({ page }) => {
    const variants = await page.evaluate(() => {
      const user = { display_name: 'Test User', welcome_index: 0 };
      const results = [];
      for (let i = 0; i < 5; i++) {
        user.welcome_index = i;
        results.push(API.getWelcomeMessage(user));
      }
      return results;
    });
    // Tutti i 5 messaggi devono essere distinti
    expect(new Set(variants).size).toBe(5);
  });
});

test.describe('API.isBookRecent / isLibraryFresh', () => {
  test('libro aggiunto oggi è "recent"', async ({ page }) => {
    const result = await page.evaluate(() =>
      API.isBookRecent({ added: new Date().toISOString() })
    );
    expect(result).toBe(true);
  });

  test('libro aggiunto 30 giorni fa NON è "recent"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return API.isBookRecent({ added: d.toISOString() });
    });
    expect(result).toBe(false);
  });

  test('utente joined da 5 giorni → libreria fresca', async ({ page }) => {
    const result = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() - 5);
      return API.isLibraryFresh({ joined: d.toISOString() });
    });
    expect(result).toBe(true);
  });
});

test.describe('API.getPostsFromFollowed', () => {
  test('NON include i post propri nel feed', async ({ page }) => {
    const ownPosts = await page.evaluate(() => {
      // Chiara segue [7, 8, 3, 9, 10] di default
      const feed = API.getPostsFromFollowed(1, 20);
      return feed.filter(p => +p.author_id === 1).length;
    });
    expect(ownPosts).toBe(0);
  });

  test('include post degli utenti seguiti', async ({ page }) => {
    const followedPostsCount = await page.evaluate(() => {
      return API.getPostsFromFollowed(1, 20).length;
    });
    expect(followedPostsCount).toBeGreaterThan(0);
  });
});
