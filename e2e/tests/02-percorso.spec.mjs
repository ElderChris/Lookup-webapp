// =============================================================================
// Percorso completo con utenti nuovi: iscrizione con conferma dell'email,
// pubblicazione di un volume,
// prestito chiesto da ospite, ciclo del prestito, sospensione, recupero
// della password, eliminazione degli account. Gli utenti creati vengono
// cancellati alla fine anche se un passo fallisce.
// =============================================================================

import { test, expect } from '@playwright/test';
import {
  ADMIN_STATE,
  newPerson,
  linkFromEmail,
  emailsFor,
  loginWithForm,
  deleteTestUsers,
  watchPage,
} from '../helpers.mjs';

test.describe.configure({ mode: 'serial' });

const lender = newPerson('presta');
const borrower = newPerson('legge');
const book = { title: `Volume di prova ${Date.now().toString(36)}`, author: 'Autore di prova' };

let lenderCtx;
let borrowerCtx;
let adminCtx;
let bookId;
let loanId;

test.beforeAll(async ({ browser }) => {
  lenderCtx = await browser.newContext();
  borrowerCtx = await browser.newContext();
  adminCtx = await browser.newContext({ storageState: ADMIN_STATE });
});

test.afterAll(async () => {
  await deleteTestUsers(adminCtx.request);
  await Promise.all([lenderCtx, borrowerCtx, adminCtx].map((c) => c?.close()));
});

/** Compila il primo passo dell'iscrizione (nome, accesso). */
async function fillAccount(page, person) {
  await page.fill('#display_name', person.name);
  await page.fill('#username', person.username);
  await page.fill('#email', person.email);
  await page.fill('#password', person.password);
}

test("un lettore si iscrive con un volume, non entra finché non conferma l'email", async () => {
  const page = await lenderCtx.newPage();
  await page.goto('/register.html');
  await fillAccount(page, lender);
  await page.click('#wizard-next');

  await page.fill('#bio', 'Raccolgo romanzi e saggi, volentieri li presto.');
  await page.fill('#city', 'Napoli');
  await page.check('#consent_tos');
  await page.check('#consent_age');
  await page.click('#wizard-next');

  await page.fill('#bk_title', book.title);
  await page.fill('#bk_author', book.author);
  await page.selectOption('#bk_category', { index: 1 });
  await page.click('#add-book-btn');
  await expect(page.locator('#book-count')).toHaveText('1');
  await page.click('#wizard-finish');

  await expect(page.locator('#check-email')).toBeVisible();
  await expect(page.locator('#check-email-address')).toHaveText(lender.email);

  // Il volume non e' ancora pubblico
  const hidden = await page.request.get(`/api/books?q=${encodeURIComponent(book.title)}`);
  expect((await hidden.json()).data).toHaveLength(0);

  // Accesso prima della conferma: rifiutato, con nuovo invio possibile
  await loginWithForm(page, lender.email, lender.password);
  await expect(page.locator('#login-error')).toContainText("conferma l'indirizzo email");
  await expect(page.locator('#resend-box')).toBeVisible();

  // Conferma dal link dell'email: sessione aperta e volume pubblicato
  const link = await linkFromEmail(
    page.request,
    lender.email,
    'Conferma la tua email',
    'verify-email.html'
  );
  await page.goto(link);
  await page.waitForURL(/\/profile\.html$/);
  const shown = await page.request.get(`/api/books?q=${encodeURIComponent(book.title)}`);
  const { data } = await shown.json();
  expect(data).toHaveLength(1);
  bookId = data[0].id;
});

test('il lettore pubblica un secondo volume e lo ritrova nella sua libreria', async () => {
  const page = await lenderCtx.newPage();
  const watch = watchPage(page);
  await page.goto('/add-book.html');
  await page.fill('#title', `${book.title} secondo`);
  await page.fill('#author', book.author);
  await page.fill('#year', '1998');
  await page.locator('#category-tags .tag-input__field').fill('Roman');
  await page.locator('#category-tags .tag-opt').first().click();
  await expect(page.locator('#category-tags .tag-chip')).toHaveCount(1);
  await page.fill('#description', 'Edizione tascabile in buono stato, con qualche segno a matita.');
  await page.check('#consent');
  await page.click('#submit-btn');
  await page.waitForURL(/\/book-detail\.html\?id=\d+$/);
  const secondId = Number(new URL(page.url()).searchParams.get('id'));

  // Modifica dal dettaglio: stesso modulo, precompilato
  await page.click('#edit-book-btn');
  await page.waitForURL(new RegExp(`/add-book\\.html\\?id=${secondId}$`));
  await expect(page.locator('#title')).toHaveValue(`${book.title} secondo`);
  await expect(page.locator('#category-tags .tag-chip')).toHaveCount(1);
  await expect(page.locator('#consent-row')).toBeHidden();
  await page.fill('#title', `${book.title} rivisto`);
  await page.selectOption('#condition', 'discrete');
  await page.click('#submit-btn');
  await page.waitForURL(new RegExp(`/book-detail\\.html\\?id=${secondId}$`));
  await expect(page.locator('h1')).toHaveText(`${book.title} rivisto`);
  await expect(page.locator('main')).toContainText('discrete');

  const me = await (await page.request.get('/api/users/me')).json();
  await page.goto(`/library.html?id=${me.id}`);
  const cards = page.locator('#books-container .book-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.locator('.book-card__category').filter({ hasText: /\S/ })).toHaveCount(2);
  expect(watch.errors).toEqual([]);
});

test('un ospite chiede il prestito, si iscrive e dopo la conferma ritrova la richiesta pronta', async () => {
  const page = await borrowerCtx.newPage();
  await page.goto(`/book-detail.html?id=${bookId}`);
  await page.getByRole('button', { name: 'Richiedi prestito' }).click();
  await page.locator('#loan-days').fill('21');
  await page.fill('#loan-message', 'Lo leggerei volentieri.');
  await page.check('#loan-consent');
  await page.click('#loan-submit');
  await page.waitForURL(/\/register\.html\?intent=borrow&book=\d+/);

  await fillAccount(page, borrower);
  await page.check('#consent_tos');
  await page.check('#consent_age');
  await page.click('#wizard-finish');
  await expect(page.locator('#check-email')).toBeVisible();

  const link = await linkFromEmail(
    page.request,
    borrower.email,
    'Conferma la tua email',
    'verify-email.html'
  );
  expect(link).toContain(`next=%2Fbook-detail.html%3Fid%3D${bookId}%26loan%3D1`);
  await page.goto(link);
  await page.waitForURL(new RegExp(`/book-detail\\.html\\?id=${bookId}&loan=1$`));
  await expect(page.locator('#loan-dialog')).toBeVisible();
  await expect(page.locator('#loan-days')).toHaveValue('21');
  await expect(page.locator('#loan-message')).toHaveValue('Lo leggerei volentieri.');

  await page.check('#loan-consent');
  await page.click('#loan-submit');
  await page.waitForURL(/\/loans\.html#loan-\d+$/);
  loanId = Number(page.url().split('#loan-')[1]);
});

test('ciclo del prestito: accettato, consegnato, restituito', async () => {
  const lenderPage = await lenderCtx.newPage();
  const borrowerPage = await borrowerCtx.newPage();
  const status = async () =>
    (await (await lenderPage.request.get(`/api/loans/${loanId}`)).json()).status;

  async function act(page, name) {
    await page.goto(`/loans.html#loan-${loanId}`);
    await page.getByRole('button', { name }).click();
  }

  // Con la richiesta in attesa il volume non si elimina: pulsante
  // disattivato e spiegazione
  await lenderPage.goto(`/book-detail.html?id=${bookId}`);
  await expect(lenderPage.locator('#delete-book-btn')).toBeDisabled();
  await expect(lenderPage.locator('#delete-block-note')).toContainText('richiesta di prestito');

  // Con la pagina dei prestiti gia' aperta, un link a #loan-N apre quel prestito
  await lenderPage.goto('/loans.html');
  await expect(lenderPage.locator(`#loan-${loanId}`)).toHaveCount(0);
  await lenderPage.evaluate((id) => (globalThis.location.hash = `#loan-${id}`), loanId);
  await expect(lenderPage.locator(`#loan-${loanId}`)).toBeVisible();

  await act(lenderPage, '✓ Accetta');
  await expect.poll(status).toBe('confirmed');
  await act(lenderPage, '↦ Volume consegnato');
  await expect.poll(status).toBe('borrowed');
  await act(borrowerPage, '↦ Inizia restituzione');
  await borrowerPage.click('#return-wizard-confirm');
  await expect.poll(status).toBe('returning');
  await act(lenderPage, '✓ Conferma restituzione');
  await expect.poll(status).toBe('returned');

  // Prestito concluso: il volume si elimina, ma resta nello storico di chi
  // l'ha preso (ritirato)
  await lenderPage.goto(`/book-detail.html?id=${bookId}`);
  await lenderPage.click('#delete-book-btn');
  // Conferma con la finestra dell'app (non quella del browser)
  await expect(lenderPage.locator('dialog.app-confirm')).toBeVisible();
  await lenderPage.click('#app-confirm-ok');
  await lenderPage.waitForURL(/\/profile\.html$/);
  expect((await borrowerPage.request.get(`/api/books/${bookId}`)).status()).toBe(404);
  // La pagina e' gia' su questo indirizzo: va ricaricata
  await borrowerPage.reload();
  await expect(borrowerPage.locator(`#loan-${loanId} .loan-card__retired`)).toBeVisible();
});

test("l'amministratore sospende il lettore, che non può più entrare, poi lo riattiva", async () => {
  const admin = await adminCtx.newPage();
  await admin.goto('/admin.html');
  await admin.fill('#search-users', borrower.username);
  const row = admin.locator('#users-tbody tr', { hasText: borrower.username });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: /^Sospendi/ }).click();
  await admin.click('#confirm-ok');
  await expect(row).toContainText('sospeso');

  // Sessione chiusa subito
  expect((await borrowerCtx.request.get('/api/users/me')).status()).toBe(401);
  // Profilo e volumi nascosti agli altri
  const profile = await lenderCtx.request.get(`/api/loans/${loanId}`);
  expect(profile.ok()).toBe(true);

  const page = await borrowerCtx.newPage();
  await loginWithForm(page, borrower.email, borrower.password);
  await expect(page.locator('#login-error')).toContainText('sospeso');

  await row.getByRole('button', { name: /^Riattiva/ }).click();
  await admin.click('#confirm-ok');
  await expect(row).toContainText('attivo');
});

test('recupero della password dal link ricevuto per email', async () => {
  const page = await borrowerCtx.newPage();
  await page.goto('/reset-password.html');
  await page.fill('#email', borrower.email);
  await page.click('#step1-form button[type="submit"]');
  await expect(page.locator('#step2-confirm')).toBeVisible();

  const link = await linkFromEmail(
    page.request,
    borrower.email,
    'Reimposta la password',
    'reset-password.html'
  );
  await page.goto(link);
  borrower.password = `${borrower.password}x`;
  await page.fill('#pw1', borrower.password);
  await page.fill('#pw2', borrower.password);
  await page.click('#step3-form button[type="submit"]');
  await expect(page.locator('#step3-success')).toBeVisible();

  await loginWithForm(page, borrower.email, borrower.password, '/loans.html');
  await page.waitForURL(/\/loans\.html$/);
});

test('il lettore elimina il proprio account dal profilo', async () => {
  const page = await borrowerCtx.newPage();
  await page.goto('/profile-setup.html');
  await page.fill('#delete-password', borrower.password);
  await page.check('#delete-confirm');
  await page.click('#delete-account-btn');
  await page.waitForURL(/\/index\.html$/);
  expect((await borrowerCtx.request.get('/api/users/me')).status()).toBe(401);
  expect(await emailsFor(page.request, borrower.email, 'Account Lookup eliminato')).toHaveLength(1);
  // Il prestito sparisce con l'account
  expect((await lenderCtx.request.get(`/api/loans/${loanId}`)).status()).toBe(404);
});

test("l'amministratore elimina definitivamente l'altro account", async () => {
  const admin = await adminCtx.newPage();
  await admin.goto('/admin.html');
  await admin.fill('#search-users', lender.username);
  const row = admin.locator('#users-tbody tr', { hasText: lender.username });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: /^Elimina definitivamente/ }).click();
  await expect(admin.locator('#confirm-ok')).toBeDisabled();
  await admin.fill('#confirm-text', lender.username);
  await admin.click('#confirm-ok');
  await expect(row).toHaveCount(0);
  expect((await adminCtx.request.get(`/api/books/${bookId}`)).status()).toBe(404);
});
