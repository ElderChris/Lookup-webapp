# Roadmap verso Alpha — Lookup

Documento strategico per la transizione del prototipo accademico
(`v2.6.0` localStorage-only) verso una release **Alpha closed**
con backend reale, database persistente, autenticazione effettiva
e validazione con utenti reali a Napoli.

**Ultima revisione**: redatta sulla baseline `v2.6.0`.

> **Vincolo fondamentale**: il sistema deve essere **self-hostable
> senza dipendenze esterne**. Il cliente deve poter testare tutte le
> funzionalità in locale via `docker compose up`, senza account su
> servizi cloud, senza chiavi API a pagamento. I servizi cloud
> (Fly.io, Resend, R2…) restano opzioni di deploy in produzione,
> mai requisiti per il test. Vedi `docs/architecture.md`.

---

## 1. Stato attuale

Il prototipo è funzionalmente completo: 19.890 righe fra HTML/CSS/JS,
15 pagine, 50+ metodi API, sistema di prestiti a 5 stati, recensioni,
chat, post sociali, pannello admin con CRUD, statistiche avanzate.
**Tutto vive in `localStorage`**: zero persistenza cross-device, zero
multi-utente reale. È un mockup interattivo, non un'applicazione.

## 2. Hard-coded residui da sostituire prima dell'Alpha

| Categoria | Componente | File / linee | Sostituzione Alpha |
|---|---|---|---|
| **Auth** | Password accettata se ≥8 char (eccetto admin/admin) | `app.js:2895-2904` | bcrypt cost 12 + validazione server + HaveIBeenPwned check |
| **Auth** | `auth-toggle` per simulare stato auth | tutti gli HTML + `app.js:5252-5320` | Rimuovere; sostituire con session cookie httpOnly |
| **Email** | Tutte simulate in `simulated_emails[]` | `app.js:1666-1680, 3252` | SMTP via nodemailer → MailHog (dev) o SMTP del cliente (prod) |
| **Reset password** | Token `Math.random()` in localStorage | `app.js:3530-3550` | UUID v4 + single-use + expiry 1h + tabella DB |
| **Geolocation** | Fallback `[40.8358, 14.2488]` (Napoli centro) | `app.js:2974-2976` | Geolocalizzazione obbligatoria al primo login, default null |

### Cosa NON cambia

I `SAMPLE_*` (12 array fixture) restano come `prisma/seed.ts` per
dev/staging. BISAC taxonomy, gradient copertine, welcome messages,
ID random base36 sono pattern legittimi.

---

## 3. Piano in 6 fasi

| Fase | Durata | Obiettivo | Tag |
|---|---|---|---|
| 0 — Chiusura prototipo | 1–2 settimane | Cleanup, modularizzazione, test in CI | `v3.0.0-alpha.0` |
| 1 — Backend skeleton | 4–6 settimane | API REST funzionante, DB Postgres+PostGIS | `v3.0.0-alpha.1-backend` |
| 2 — Migrazione frontend→API | 3–4 settimane | `Storage.*` → `fetch()`, gestione loading/error | `v3.0.0-alpha.2` |
| 3 — Auth + email reali | 2–3 settimane | bcrypt, session cookie, email verification, reset reale | `v3.0.0-alpha.3` |
| 4 — Storage immagini + infra | 2–3 settimane | Filesystem locale + Docker compose completo + CI | `v3.0.0-alpha.4` |
| 5 — Privacy hardening + monitoring | 2 settimane | GDPR data export, Sentry, headers sicurezza | `v3.0.0-alpha.5` |
| 6 — **Alpha closed** | ongoing | 20–50 inviti, feedback settimanale | `v3.0.0-alpha` |

Stima totale: **3–4 mesi full-time**, **6–8 mesi part-time**.

### Fase 0 — Chiusura prototipo (in dettaglio)

**Fase 0a — Pulizia iniziale ✅ COMPLETATA (v3.0.0-alpha.0)**

- [x] Rimosso `auth-toggle` da tutte le 15 pagine + JS associato
- [x] Marcati con `TODO(alpha)` i 5 hard-coded residui (commenti grep-abili)
- [x] Privacy policy aggiornata: distinzione esplicita prototipo/Alpha
- [x] Documentazione strategica creata: `alpha_roadmap.md`, `architecture.md`

**Fase 0b — Modularizzazione JavaScript ✅ COMPLETATA (v3.0.0-alpha.0)**

- [x] Estratto `app.js` (5594 righe) in 5 moduli ES con dipendenze unidirezionali:
  - `data.js` (1065 righe): seed fixtures + costanti tassonomiche
  - `storage.js` (162 righe): wrapper localStorage + reseed logic
  - `api.js` (2621 righe): logica applicativa (business)
  - `ui.js` (1809 righe): rendering DOM + wiring eventi
  - `app.js` (63 righe): entry point + init + esposizione globali
- [x] Aggiornati tutti i 15 HTML con `<script type="module">`
- [x] CSS lasciato unificato (52 sezioni numerate, già leggibile — motivato in rapporto §4.30.2)
- [x] Inline script HTML lasciati dove sono (pagine auto-contenute, scope naturale — motivato in rapporto §4.30.2)
- [x] 43/43 smoke test Playwright verdi su tutte le combinazioni page × stato auth

**Fase 0c — CI con npm test ✅ COMPLETATA (v3.0.0-alpha.0)**

- [x] Conversione degli smoke Playwright in 3 spec reali in `tests/`:
  - `smoke.spec.js`: 15 pagine × 3 stati auth = 45 casi
  - `nav.spec.js`: invariants di consistenza nav
  - `api.spec.js`: contratti algoritmi business (featured, welcome, ...)
- [x] `package.json` con devDeps: Playwright, ESLint 9, Prettier 3, Husky, lint-staged
- [x] `playwright.config.js` con `webServer` integrato (avvio automatico)
- [x] `eslint.config.js` flat config minimale
- [x] `.prettierrc.json` che riflette stile esistente
- [x] `.github/workflows/ci.yml`: lint + format check + test su push/PR main
- [x] Pre-commit hook via Husky + lint-staged
- [x] `.gitignore` completo

**Fase 0d — Docker compose dev ✅ COMPLETATA (v3.0.0-alpha.0)**

- [x] Creato `docker-compose.yml` reale con servizio `web` attivo (nginx Alpine) per Fase 0d
- [x] Tutti i servizi futuri (postgres, redis, mailhog, api, pgadmin) commentati come `TODO(fase1+)` nello stesso file — si attivano nelle fasi successive senza riscrivere
- [x] `infra/nginx.conf` con static serving + healthcheck + headers di sicurezza + placeholder per proxy `/api` (Fase 1) e `/uploads` (Fase 4)
- [x] Volumi montati read-only per hot-reload (modifica file → refresh → vedi modifica)
- [x] `.env.example` con WEB_PORT attivo e tutte le variabili future commentate
- [x] `Makefile` con shortcuts per Docker + sviluppo + test (`make help` per lista)
- [x] `.dockerignore` per ridurre build context
- [x] README aggiornato con sezione "Self-hosting (Docker)" completa
- [x] Struttura repo documentata in README

**Fase 0 chiusura ✅ COMPLETATA**: baseline `v3.0.0-alpha.0` stabile e pronta per tag Git. Tutti gli artefatti del prototipo sono ora organizzati, testati, e self-hostable senza dipendenze esterne. Fase 1 può iniziare.

### Fase 1 — Backend skeleton (suddiviso in sotto-fasi)

#### Fase 1a — Monorepo + DB containers ✅ COMPLETATA

- [x] Repo monorepo `lookup/` con `apps/web/` (frontend) e `apps/api/` (scaffold)
- [x] `package.json` root con npm workspaces orchestratore
- [x] `apps/web/package.json` (workspace `@lookup/web`)
- [x] `apps/api/package.json` (workspace `@lookup/api`) — scaffold, niente runtime
- [x] PostgreSQL 16 + PostGIS 3.4 containerizzato (volume persistente)
- [x] Redis 7 containerizzato (volume persistente, AOF)
- [x] `infra/postgres/init.sql` con `CREATE EXTENSION postgis, pg_trgm, citext`
- [x] pgAdmin opt-in (profilo `admin`, porta 5050)
- [x] Comandi `db-up`, `db-down`, `db-shell`, `db-reset`, `db-logs` in Makefile + dev.ps1
- [x] npm scripts root: `db:up`, `db:down`, `db:shell`, `db:reset`
- [x] `tests/` → `tests-e2e/` in root (cross-workspace)
- [x] File SQL legacy in `apps/api/prisma/_reference/` come riferimento storico
- [x] Path aggiornati in playwright.config, eslint.config, gitignore, dockerignore
- [x] 24/24 smoke test verdi dopo refactor
- [x] README + changelog + roadmap aggiornati con struttura monorepo

**Tag git suggerito**: `v3.0.0-alpha.1-monorepo`

#### Fase 1b — Prisma schema + migration + seed (PROSSIMO)

- [ ] `cd apps/api && npm install prisma @prisma/client`
- [ ] `apps/api/prisma/schema.prisma` con 12 modelli (User, Book, LoanRequest,
      LoanMessage, Review, Post, PostReaction, PostReport, Follow, Like,
      BookView, Notification) tradotti da `_reference/schema.sql`
- [ ] Adattamento PostGIS: campo `location` come `Unsupported("geography(Point, 4326)")`
      con index GIST custom in migration manuale
- [ ] `npx prisma migrate dev --name init` — prima migration generata
- [ ] `apps/api/prisma/seed.ts` che traduce i 12 array `SAMPLE_*` da
      `apps/web/js/data.js` in Prisma `create()` calls
- [ ] `npx prisma db seed` — popolamento DB
- [ ] Verifica via `make db-shell`: `\dt` mostra 12+ tabelle, `SELECT count(*) FROM users;` → 11

#### Fase 1c — Fastify skeleton

- [ ] `cd apps/api && npm install fastify @fastify/cors @fastify/helmet pino`
- [ ] `apps/api/src/server.js` con bootstrap Fastify
- [ ] Error handler centralizzato (mapping Prisma errors → HTTP status)
- [ ] Request logger (pino con redaction di password)
- [ ] Healthcheck `/api/health` → `{status:'ok', db:'ok', redis:'ok'}`
- [ ] OpenAPI auto-gen via `@fastify/swagger`
- [ ] Decommentare service `api` in `docker-compose.yml`

#### Fase 1d — Endpoint Books

- [ ] `GET /api/books` (filtri: q, bisac, ownerId, lat/lng/radius)
- [ ] `POST /api/books` (auth required)
- [ ] `GET /api/books/:id`
- [ ] `PATCH /api/books/:id` (owner only)
- [ ] `DELETE /api/books/:id` (owner only)
- [ ] `POST /api/books/:id/views` (debounce 1/min/user)

#### Fase 1e — Endpoint Users, Reviews, Loans, Posts, Notifications

- [ ] Users: `GET /api/users/:id`, `PATCH /api/users/me`, `GET /api/users/:id/library`
- [ ] Reviews: `GET /api/users/:id/reviews`, `POST /api/users/:id/reviews`
- [ ] Loans: `POST /api/books/:id/loan-requests`, `GET /api/me/loans/{sent,received}`,
      `PATCH /api/loan-requests/:id` (accept/decline/return), `POST /api/loan-requests/:id/messages`
- [ ] Posts: `GET /api/posts/feed`, `POST /api/posts`, `POST /api/posts/:id/reactions`,
      `POST /api/posts/:id/report`
- [ ] Notifications: `GET /api/me/notifications`, `PATCH /api/me/notifications/:id/read`

#### Fase 1f — Endpoint Stats

- [ ] `GET /api/stats/featured` (algoritmo trend score con diversity penalty)
- [ ] `GET /api/stats/ridgeline` (10 utenti × 8 settimane attività)
- [ ] `GET /api/stats/bisac-cooccurrence` (per chart correlazioni)
- [ ] `GET /api/stats/top-users` (con conferma popover)

#### Fase 1g — Zod schemas condivisi

- [ ] Creare `packages/shared/` workspace (Zod schemas riusabili)
- [ ] Schemi per body POST/PATCH di ogni endpoint
- [ ] Schemi per response (per validare anche client side)
- [ ] Refactor route handlers per usare gli schemi (validazione automatica Fastify)

#### Fase 1h — Test backend

- [ ] `cd apps/api && npm install -D vitest supertest @vitest/coverage-v8`
- [ ] Test unitari per ogni service (logica trend score, diversity penalty, geo)
- [ ] Test integration per ogni endpoint (con DB di test isolato)
- [ ] Coverage ≥80% sui module business
- [ ] Integrazione in `ci.yml` (test backend dopo lint frontend)

### Fase 2 — Migrazione frontend → API

- [ ] Refactor `Storage` module: ogni metodo diventa async + fetch
- [ ] Aggiungere **TanStack Query** (works on vanilla via `@tanstack/query-core`) per:
  - Cache delle response
  - Optimistic updates
  - Background refetch
  - Loading/error states
- [ ] Aggiornare 200+ call site per gestire async (await + try/catch)
- [ ] Skeleton screens dove ora c'è "instant render"
- [ ] Error boundary globale con toast

### Fase 3 — Auth reale

- [ ] Setup `lucia-auth` con session adapter Postgres
- [ ] Endpoint `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/verify-email`, `/auth/reset-password`
- [ ] bcrypt cost 12 per password
- [ ] Cookie httpOnly + SameSite=lax + Secure (in prod)
- [ ] Email verification obbligatoria al signup (token JWT 24h)
- [ ] Password reset: UUID v4 in `password_reset_tokens` table, single-use, expiry 1h
- [ ] Rate limit `/auth/*`: 5 req/min/IP via Redis sliding window
- [ ] Email via **nodemailer**: in dev punta a MailHog (cattura su `:8025`), in prod a SMTP configurabile via env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- [ ] Template HTML inline con identità visiva del sito, testati su MailHog
- [ ] Admin: utente seed `admin@lookup.local` con password generata e mostrata in console al primo seed

### Fase 4 — Storage immagini + infrastruttura

- [ ] Storage filesystem locale: volume Docker `./uploads/`, strutturato `avatars/<userId>.jpg` + `books/<bookId>.jpg`
- [ ] Endpoint `POST /api/uploads/avatar` con multer/sharp: client invia multipart, server valida + resize + salva
- [ ] Backend serve `/uploads/*` come static via `@fastify/static`
- [ ] In produzione opzionale: cliente può montare il volume su MinIO o S3 senza cambiare codice (path stessi)
- [ ] `user.avatar_url` invece di `user.avatar_data_url`
- [ ] Migration: utenti esistenti perdono avatar (mostrare banner che invita re-upload) — accettabile in Alpha
- [ ] Dockerfile multi-stage per backend (build → runtime, ~80MB finale)
- [ ] GitHub Actions:
  - `ci.yml`: lint + typecheck + test (Playwright) su ogni PR
  - `deploy-staging.yml`: deploy su push `main`
  - `deploy-prod.yml`: deploy su tag `v*`
- [ ] Documentazione `docs/deploy.md` con tutti i secret env

### Fase 5 — Privacy hardening + monitoring

- [ ] Cookie banner minimal (no cookie analitici, solo essenziali → niente banner obbligatorio in EU?
      Verificare; nel dubbio metterlo discreto)
- [ ] Data export: `GET /api/me/export` → ZIP con `user.json`, `books.json`, `loans.json`, `reviews.json`, `posts.json`, `messages.json`, `avatar.jpg`
- [ ] Account deletion: soft-delete con `deleted_at`, hard-delete dopo 30 giorni via cron
- [ ] Sentry: free tier sufficiente per Alpha closed
- [ ] Plausible/PostHog: analytics privacy-friendly, no cookie, no fingerprinting
- [ ] Headers di sicurezza via `@fastify/helmet`:
  - CSP `default-src 'self'`
  - HSTS `max-age=63072000; includeSubDomains; preload`
  - X-Frame-Options DENY
  - Permissions-Policy
- [ ] Audit accessibility con `@axe-core/cli` in CI (failing su violations critiche)

### Fase 6 — Alpha closed

- [ ] Sistema inviti: codice univoco al signup, lista whitelist email
- [ ] Onboarding email post-signup con tutorial
- [ ] Feedback widget in-app (mailto: o widget Plausible)
- [ ] Dashboard interno KPI: DAU, prestiti avviati/completati/cancellati, NPS dopo 2 settimane
- [ ] Roadmap Beta condivisa con i tester
- [ ] Target inviti: 20 librerie diffuse + 30 lettori della zona Vomero/Chiaia/Spaccanapoli

---

## 4. Cosa portiamo avanti

Tutto il lavoro su identità visiva, design system, scelte UX,
algoritmi (featured books, ridgeline, BISAC co-occorrenza), schema dati,
microcopy in italiano. Tutto questo è il **valore differenziante**
del progetto e va preservato pixel-per-pixel nella transizione.

## 5. Cosa lasciamo indietro

L'`auth-toggle`, la simulazione di email, il backend-in-localStorage,
il file `app.js` monolitico. Sono stati ottimi per il prototipo perché
permettevano iterazione velocissima senza infrastruttura. In Alpha
diventano debito tecnico e rischi di sicurezza.

## 6. Decisioni aperte

- **Frontend framework**: **deciso → vanilla bundlato con esbuild**. Mantiene il valore differenziante dell'UX curata, evita riscrittura di 6+ mesi di lavoro.
- **Backend language**: Node/TS vs Python/FastAPI. **Raccomandazione**: Node, condivide tipi con frontend via Zod.
- **DB hosting**: **deciso → Postgres in container Docker** (vincolo self-host). Backup via `pg_dump` cron. Migrazione futura a managed (Neon, Supabase) possibile senza cambio codice grazie a Prisma.
- **Modello pricing futuro**: gratuito per sempre? Donation-based? Freemium per organizzazioni? **Rinviata a Beta**.

## 7. Rischi principali

1. **Scope creep durante fase 1**: backend di un'app simil-social è facile da iniziare e difficile da chiudere. Mitigation: rispettare strettamente l'1:1 con API esistente.
2. **Migrazione frontend dolorosa**: 200+ call site da convertire ad async. Mitigation: pattern repository, test E2E che girano contro entrambe le versioni.
3. **Email deliverability** (solo in produzione, non in test locale): le email transactional finiscono in spam senza warm-up del dominio. Mitigation: il cliente configura il suo SMTP affidabile (es. Postmark, SES, server SMTP aziendale); il sistema funziona con qualsiasi SMTP via env vars.
4. **Sicurezza**: rolling-your-own-auth è una trappola. Mitigation: usare lucia o better-auth, mai improvvisare.
5. **Tempo**: una persona sola che fa tutto rischia di esaurirsi. Mitigation: cercare un co-maintainer prima di Beta.
