# @lookup/api

Backend di Lookup. **Scaffold vuoto** creato in **Fase 1a**.

## Stato

Questo workspace contiene solo la struttura di cartelle. Niente codice runtime.

| Cartella | Scopo (popolato in) |
|---|---|
| `src/routes/` | Route handler Fastify (Fase 1d-1f) |
| `src/services/` | Logica applicativa (Fase 1d-1f) |
| `src/db/` | Prisma client + repositories (Fase 1b) |
| `src/auth/` | Configurazione lucia-auth + middleware (Fase 3) |
| `src/lib/` | Helper trasversali: email, storage, geo (Fase 1c-4) |
| `prisma/` | Schema, migration, seed (Fase 1b) |

## Avvio (Fase 1c+)

Quando il backend sarà implementato, da root:

```bash
docker compose up                  # avvia postgres + redis + api
npm run dev:api                    # avvia solo il backend Fastify
```

## Stack target

- **Node 20** + **Fastify 4** (HTTP server, schema validation)
- **Prisma 5** (ORM type-safe)
- **PostgreSQL 16 + PostGIS** (DB con geo nativo)
- **lucia-auth** (session-based, no JWT)
- **nodemailer** (SMTP — MailHog in dev, configurabile in prod)
- **Zod** (validazione condivisa con frontend via `packages/shared/`)

Vedi `docs/architecture.md` per i dettagli.

## Roadmap implementazione

- [ ] **1b** Prisma schema + migration + seed.ts
- [ ] **1c** Fastify skeleton (server, error handler, logger, `/api/health`)
- [ ] **1d** Endpoint Books
- [ ] **1e** Endpoint Users, Reviews, Loans, Posts, Notifications
- [ ] **1f** Endpoint Stats (featured, ridgeline, BISAC)
- [ ] **1g** Zod schemas condivisi
- [ ] **1h** Test backend (Vitest + supertest)
