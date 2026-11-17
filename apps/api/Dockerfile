# =============================================================================
# Dockerfile per @lookup/api
# =============================================================================
# Multi-stage build:
#   - builder: dipendenze (anche dev) dal lockfile + generazione Prisma Client
#   - runtime: Node 24 alpine, solo dipendenze di produzione + codice
#
# Il contesto di build e' la ROOT del monorepo (vedi docker-compose.yml):
# serve per leggere package-lock.json e risolvere il workspace @lookup/shared,
# che non e' pubblicato su npm.
#
# Build (dalla root del repository):
#   docker compose --profile backend build api
#
# Healthcheck integrato: GET /api/ping ogni 10s
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: builder
# -----------------------------------------------------------------------------
FROM node:24-alpine AS builder

# openssl: richiesto da Prisma su Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Manifest del monorepo + lockfile (layer in cache finche' non cambiano)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Installa solo il workspace apps/api (e le sue dipendenze di workspace) con
# le versioni esatte del lockfile. --ignore-scripts evita gli script di
# lifecycle del monorepo (husky, postinstall): Prisma Client si genera sotto.
RUN npm ci --workspace=apps/api --ignore-scripts --no-audit --no-fund

# Genera Prisma Client in node_modules/.prisma/client
# (scarica gli engine Prisma per la piattaforma del container)
COPY apps/api/prisma ./apps/api/prisma
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

# Codice sorgente
COPY packages/shared/src ./packages/shared/src
COPY apps/api/src ./apps/api/src

# -----------------------------------------------------------------------------
# Stage 2: runtime
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runtime

# wget: healthcheck Docker
# dumb-init: gestione corretta dei segnali (PID 1)
# openssl: richiesto da Prisma su Alpine
RUN apk add --no-cache wget dumb-init openssl

WORKDIR /app

# Utente non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S lookup -u 1001 -G nodejs

# Solo dipendenze di produzione, dal lockfile
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=apps/api --omit=dev --ignore-scripts --no-audit --no-fund && \
    npm cache clean --force

# Prisma Client generato + codice dallo stage builder
COPY --from=builder --chown=lookup:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=lookup:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=lookup:nodejs /app/packages/shared/src ./packages/shared/src
COPY --from=builder --chown=lookup:nodejs /app/apps/api/src ./apps/api/src
COPY --from=builder --chown=lookup:nodejs /app/apps/api/prisma ./apps/api/prisma

USER lookup
WORKDIR /app/apps/api

# Le variabili d'ambiente arrivano da docker-compose (blocco `environment:`)
ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/ping || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
