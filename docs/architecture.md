# Architettura target — Lookup Alpha

Documento di riferimento per lo stack target dell'Alpha. Il
prototipo `v2.6.0` è frontend statico con tutto in `localStorage`;
qui descriviamo l'architettura verso cui converge.

## Vincolo fondamentale: **self-hostable, zero dipendenze esterne**

Il cliente deve poter testare la web app **in tutte le sue
funzionalità** localmente, senza creare account su servizi cloud,
senza chiavi API a pagamento, senza connessione internet (se non
per il primo `docker pull` dei container).

Tutto lo stack gira via **un solo comando** (`docker compose up`)
su una macchina sviluppatore o su un piccolo server. I servizi
cloud (R2, Resend, Fly.io, Neon...) restano **opzioni di deploy
in produzione**, mai requisiti per il test.

---

## 1. Stack scelto

| Layer | Tecnologia | Versione | Self-host | Note |
|---|---|---|---|---|
| **Frontend** | Vanilla JS (ES Modules) + esbuild | Node 20 | Sì, build statico | Nessun framework. Bundler solo per minify/sourcemaps. |
| **Backend** | Node + Fastify + Prisma | Node 20, Fastify 4, Prisma 5 | Sì, container Node | Schema validation via Zod, miglior ORM TS. |
| **Database** | PostgreSQL + PostGIS | 16 + 3.4 | Sì, container ufficiale `postgis/postgis:16-3.4` | Schema già esistente in `docs/schema.sql`. |
| **Cache/Session** | Redis | 7 | Sì, container ufficiale | Rate limiting, session store, future queue. |
| **Auth** | lucia-auth | 3.x | Sì, pacchetto npm | Type-safe, framework-agnostic, niente JWT footgun. |
| **Storage file** | Filesystem locale (`./uploads/`) | — | Sì, volume Docker | In produzione opzionale: MinIO self-host o R2 cloud. |
| **Email (dev/test)** | **MailHog** | latest | Sì, container | Cattura tutte le email, web UI su `:8025` per leggerle. |
| **Email (prod opzionale)** | SMTP esterno (qualsiasi) | — | No | Postmark, Resend, AWS SES, server SMTP del cliente. Configurabile via env. |
| **Reverse proxy** | nginx o Caddy | latest | Sì, container | Servire frontend statico + proxy `/api/*` al backend. |
| **Logs** | stdout + file rotation | — | Sì, integrato | Opzionalmente Loki + Grafana (Docker compose opzionale). |
| **Monitoring (opt)** | Prometheus + Grafana | latest | Sì, container opzionale | Profilo `docker compose --profile monitoring`. |
| **CI/CD** | GitHub Actions | — | No, ma solo dev workflow | Build e test, **non** deploy obbligatorio. |

### Cosa rimane fuori dal critical path

| Servizio cloud | Sostituto self-host | Note |
|---|---|---|
| Cloudflare R2 / AWS S3 | Filesystem locale `./uploads/`, opzionale MinIO | API S3-compatible identica via MinIO |
| Resend / Postmark | MailHog (dev), SMTP del cliente (prod) | Stessa libreria nodemailer, configurazione env |
| Fly.io / Railway | `docker compose up` su qualsiasi VPS/server | Niente lock-in piattaforma |
| Neon / Supabase | Postgres in container | Backup via `pg_dump` cron |
| Sentry | Self-host Sentry (Docker, opzionale) o syslog | Sentry è open source, può essere self-hosted |
| Plausible | Plausible self-host (Docker, opzionale) | Plausible è open source |

**Tutti i servizi cloud restano opzionali**: il sistema funziona al
100% senza accesso a internet (dopo il primo `docker pull`).

---

## 2. Setup self-host (target)

Un solo comando per il cliente:

```bash
git clone https://github.com/<org>/lookup
cd lookup
cp .env.example .env       # → editare se serve, default OK per test
docker compose up          # → tutto avviato sulle porte locali
```

URL al primo avvio:

| Servizio | URL | Note |
|---|---|---|
| Web app | `http://localhost:8080` | nginx serve frontend + proxy `/api` |
| Backend API | `http://localhost:3000` | Diretto, normalmente passa da nginx |
| Database | `postgres://localhost:5432` | Credenziali in `.env` |
| MailHog (email catturate) | `http://localhost:8025` | UI web per leggere email "inviate" |
| Postgres admin (opzionale) | `http://localhost:5050` | pgAdmin con profilo `--profile admin` |

`docker-compose.yml` di riferimento:

```yaml
version: '3.9'

services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-libreria}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-libreria_dev}
      POSTGRES_DB: ${POSTGRES_DB:-lookup}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-libreria}"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"     # SMTP (il backend invia qui)
      - "8025:8025"     # Web UI per leggere le email

  api:
    build: ./apps/api
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    environment:
      DATABASE_URL: postgres://libreria:libreria_dev@postgres:5432/lookup
      REDIS_URL: redis://redis:6379
      SMTP_HOST: mailhog
      SMTP_PORT: 1025
      SESSION_SECRET: ${SESSION_SECRET}
      UPLOAD_DIR: /data/uploads
    volumes:
      - uploads-data:/data/uploads

  web:
    image: nginx:alpine
    depends_on: [api]
    ports:
      - "8080:80"
    volumes:
      - ./apps/web/dist:/usr/share/nginx/html:ro
      - ./infra/nginx.conf:/etc/nginx/conf.d/default.conf:ro

  # Opzionale: admin DB con `docker compose --profile admin up`
  pgadmin:
    image: dpage/pgadmin4:latest
    profiles: [admin]
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@localhost
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"

volumes:
  postgres-data:
  redis-data:
  uploads-data:
```

Tutto il sistema gira con **risorse modeste**: ~512 MB RAM totali a
riposo, ~1 GB con traffico Alpha. Un VPS €5/mese o un Raspberry Pi 4
ce la fa senza problemi.

---

```
lookup/
├── apps/
│   ├── web/                    # Frontend (evoluzione dell'attuale)
│   │   ├── src/
│   │   │   ├── pages/          # Una entry per pagina HTML
│   │   │   ├── components/     # Render helpers (book card, library card, post)
│   │   │   ├── state/
│   │   │   │   ├── api.ts      # Client API (fetch wrappers, query keys)
│   │   │   │   └── auth.ts     # Auth client (cookie-based, no token in JS)
│   │   │   ├── ui/             # SVG icons, design tokens
│   │   │   └── utils/
│   │   ├── public/             # Static assets
│   │   ├── index.html, profile.html, ...   # Entry points
│   │   ├── esbuild.config.mjs
│   │   └── package.json
│   └── api/                    # Backend
│       ├── src/
│       │   ├── routes/         # Fastify route handlers
│       │   ├── services/       # Business logic
│       │   ├── db/             # Prisma client + repositories
│       │   ├── auth/           # lucia config + middleware
│       │   ├── lib/            # Email, storage, geo
│       │   └── server.ts       # Fastify entry
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts         # I 12 SAMPLE_* di oggi
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── shared/                 # Tipi Zod condivisi
│   └── ui-tokens/              # Design tokens, palette, font stack
├── docker-compose.yml          # Dev: postgres + redis + minio (R2 mock)
├── .github/workflows/          # CI/CD
└── docs/                       # Esistenti + nuovi
```

---

## 3. Struttura monorepo

```
lookup/
├── apps/
│   ├── web/                    # Frontend (evoluzione dell'attuale)
│   │   ├── src/
│   │   │   ├── pages/          # Una entry per pagina HTML
│   │   │   ├── components/     # Render helpers (book card, library card, post)
│   │   │   ├── state/
│   │   │   │   ├── api.ts      # Client API (fetch wrappers)
│   │   │   │   └── auth.ts     # Auth client (cookie-based, no token in JS)
│   │   │   ├── ui/             # SVG icons, design tokens
│   │   │   └── utils/
│   │   ├── public/             # Static assets
│   │   ├── index.html, profile.html, ...   # Entry points
│   │   ├── esbuild.config.mjs
│   │   └── package.json
│   └── api/                    # Backend
│       ├── src/
│       │   ├── routes/         # Fastify route handlers
│       │   ├── services/       # Business logic
│       │   ├── db/             # Prisma client + repositories
│       │   ├── auth/           # lucia config + middleware
│       │   ├── lib/            # Email (nodemailer + SMTP), storage (fs locale), geo
│       │   └── server.ts       # Fastify entry
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts         # I 12 SAMPLE_* di oggi
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── shared/                 # Tipi Zod condivisi frontend/backend
│   └── ui-tokens/              # Design tokens, palette, font stack (CSS vars)
├── infra/
│   ├── nginx.conf              # Reverse proxy frontend + /api
│   └── backup.sh               # pg_dump cron script
├── docker-compose.yml          # Dev/test: postgres + redis + mailhog + api + web
├── .env.example
├── .github/workflows/          # CI: lint + test + build (no auto-deploy)
└── docs/                       # Roadmap, architecture, tech report, schema.sql
```

---

## 4. Modello dati (Prisma schema essenziale)

Estratto delle entità principali. Schema completo in `apps/api/prisma/schema.prisma`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              Int      @id @default(autoincrement())
  username        String   @unique
  email           String   @unique
  passwordHash    String   @map("password_hash")
  displayName     String   @map("display_name")
  accountType     AccountType @map("account_type")
  city            String?
  // PostGIS point per geolocation
  location        Unsupported("geography(POINT, 4326)")?
  bio             String?
  avatarUrl       String?  @map("avatar_url")
  publicProfile   Boolean  @default(true) @map("public_profile")
  libraryRole     String?  @default("borrower") @map("library_role")
  isAdmin         Boolean  @default(false) @map("is_admin")
  emailVerifiedAt DateTime? @map("email_verified_at")
  joined          DateTime @default(now())
  welcomeIndex    Int      @default(0) @map("welcome_index")
  deletedAt       DateTime? @map("deleted_at")

  books           Book[]
  loansAsRequester LoanRequest[] @relation("Requester")
  loansAsLender   LoanRequest[] @relation("Lender")
  reviews         Review[]      @relation("Author")
  receivedReviews Review[]      @relation("Subject")
  posts           Post[]
  sessions        Session[]
  bookViews       BookView[]
  notifications   Notification[]
  follows         Follow[] @relation("Follower")
  followers       Follow[] @relation("Following")

  @@map("users")
}

enum AccountType {
  person
  organization
}

model Book {
  id          Int       @id @default(autoincrement())
  ownerId     Int       @map("owner_id")
  owner       User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  title       String
  author      String
  year        Int?
  isbn        String?
  category    String
  categoryTags String[] @map("category_tags")
  description String?
  language    String?
  pages       Int?
  condition   String?
  available   Boolean   @default(true)
  coverGradient String? @map("cover_gradient")
  views       Int       @default(0)   // cache, source-of-truth è BookView count
  added       DateTime  @default(now())

  loanRequests LoanRequest[]
  bookViews    BookView[]
  likes        Like[]

  @@index([ownerId])
  @@index([added])
  @@map("books")
}

// ... posts, post_reactions, post_reports, reviews, loans, messages, notifications, follows, likes, book_views
```

---

## 5. API design

REST, mirror 1:1 dei metodi `API.*` esistenti per minimizzare il
refactor frontend. Stesso schema response, così le call site cambiano
solo da `API.getBooks()` a `await api.getBooks()`.

### Endpoint chiave

```
# Books
GET    /api/books?available=true&category=...&max_km=5&lat=...&lng=...
POST   /api/books                          (auth required)
GET    /api/books/:id
PATCH  /api/books/:id                      (owner or admin)
DELETE /api/books/:id                      (owner only — admin via /admin)
POST   /api/books/:id/views                (deduplicated server-side via session cookie)
GET    /api/books/featured                 → algoritmo trend
GET    /api/books/:id/timeline             → eventi cumulati per mese

# Users
GET    /api/users/:id
PATCH  /api/users/:id                      (self or admin)
DELETE /api/users/:id                      (admin only)
GET    /api/users/:id/library              → profilo pubblico libreria
GET    /api/users/nearby?lat=...&lng=...&max_km=10

# Loans
POST   /api/loans                          (richiesta prestito)
GET    /api/loans?as=requester|lender
PATCH  /api/loans/:id/transition           (status transitions: confirm/borrow/return/cancel)
POST   /api/loans/:id/messages

# Reviews
GET    /api/users/:id/reviews
POST   /api/reviews

# Posts
GET    /api/posts/feed                     → solo dei seguiti (no own)
GET    /api/users/:id/posts
POST   /api/posts                          (richiede ≥1 book pubblicato)
DELETE /api/posts/:id
POST   /api/posts/:id/reactions            (toggle)
POST   /api/posts/:id/reports

# Follows / Likes
PUT    /api/users/:id/follow
DELETE /api/users/:id/follow
PUT    /api/books/:id/like
DELETE /api/books/:id/like

# Notifications
GET    /api/me/notifications
PATCH  /api/me/notifications/:id/read

# Auth
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/me
POST   /auth/verify-email
POST   /auth/forgot-password
POST   /auth/reset-password

# Admin (admin role only)
GET    /admin/users
PATCH  /admin/users/:id
DELETE /admin/users/:id
GET    /admin/posts/reported
PATCH  /admin/posts/:id/clear-reports

# Stats
GET    /api/stats/global
GET    /api/stats/activity-timeline
GET    /api/stats/category-cooccurrence
GET    /api/stats/top-users-ridgeline

# Me (private dati propri)
GET    /api/me/export                      → ZIP download
DELETE /api/me                             → soft-delete account
POST   /api/me/avatar                      → presigned URL upload R2
```

### Convenzioni

- Auth: cookie httpOnly `lucia-session`, SameSite=lax, Secure in prod
- Errori: HTTP status code corretti + body `{ error: { code, message } }`
- Pagination: `?page=1&per_page=20` con header `X-Total-Count`
- Validazione: Zod schemas in `packages/shared`, applicati lato server via `@fastify/type-provider-zod`
- Rate limiting: globale 100req/min/IP, `/auth/*` 5req/min/IP
- Versioning: niente per Alpha (URL stabili), introdurre `/v1/` se serve breaking changes

---

## 6. Sicurezza

- **Password**: bcrypt cost 12. Check contro HaveIBeenPwned API (k-anonymity, no plaintext leak)
- **Session**: lucia + Postgres adapter, sliding expiration 30gg, refresh on activity
- **CSRF**: per cookie auth — middleware `@fastify/csrf-protection` con double-submit token
- **XSS**: già protetti lato client (escape via `textContent`), CSP `default-src 'self'`
- **SQL injection**: Prisma ORM (parameterized queries by design)
- **Headers**: `@fastify/helmet` con tutti i defaults sensati
- **Rate limiting**: Redis sliding window
- **Secrets**: solo env vars, mai in repo. Sealed-secrets per K8s se mai si scalerà

---

## 7. Migrazione dati prototipo → Alpha

Per i pochi utenti che hanno già "registrato" account nel prototipo
(via `localStorage`), pubblichiamo nel comunicato di lancio Alpha:

> Il prototipo `v2.6.0` salvava i tuoi dati solo nel tuo browser.
> Con il lancio Alpha questi dati non vengono migrati automaticamente.
> Ti invitiamo a registrarti di nuovo — è tutto rapido e gratuito.

Niente migration script complesso: dati di prototipo localStorage non
sono affidabili (potrebbero essere stati modificati arbitrariamente
dal devtools). Si reparte puliti.

---

## 8. Roadmap post-Alpha (preview)

- **Beta**: mobile-first PWA, push notifications, offline support
- **1.0**: app native (Capacitor o Tauri Mobile), federazione (ActivityPub?)
- **Espansione geografica**: oltre Napoli, città italiane > 100k abitanti

Le decisioni post-Alpha saranno guidate dai dati raccolti durante
l'Alpha closed.
