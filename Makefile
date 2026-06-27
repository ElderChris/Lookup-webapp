# =============================================================================
# Makefile — Lookup
# =============================================================================
# Shortcuts per operazioni comuni di sviluppo.
# Usa: `make help` per la lista completa.
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │ UTENTI WINDOWS                                                          │
# │ `make` non e' installato di default su Windows. Tre opzioni:            │
# │                                                                         │
# │ 1. Usa lo script PowerShell incluso:   .\dev.ps1 <comando>              │
# │ 2. Installa make:                       choco install make              │
# │ 3. Usa i comandi diretti (npm/docker)   vedi README sezione Sviluppo    │
# └─────────────────────────────────────────────────────────────────────────┘
# =============================================================================

.PHONY: help up up-d down logs ps restart clean test lint format check dev install \
        db-up db-down db-shell db-reset db-logs

help:
	@echo "Lookup — comandi disponibili:"
	@echo ""
	@echo "  Docker (full stack):"
	@echo "    make up            Avvia tutti i servizi via docker compose (foreground)"
	@echo "    make up-d          Avvia in background (detached)"
	@echo "    make down          Ferma e rimuove i container"
	@echo "    make logs          Segui i log di nginx"
	@echo "    make ps            Mostra lo stato dei container"
	@echo "    make restart       Restart pulito"
	@echo "    make clean         Rimuove anche i volumi (RESET DB) e le immagini"
	@echo ""
	@echo "  Database (postgres + redis):"
	@echo "    make db-up         Avvia solo postgres + redis (in background)"
	@echo "    make db-down       Ferma postgres + redis"
	@echo "    make db-shell      Apre psql nel container postgres"
	@echo "    make db-reset      Ferma + cancella volumi + ricrea DB pulito"
	@echo "    make db-logs       Segui i log di postgres"
	@echo ""
	@echo "  Sviluppo (rapido, locale):"
	@echo "    make dev           Avvia python no-cache-server (frontend) su :8765"
	@echo "    make install       Installa dev deps (npm + playwright browsers)"
	@echo "    make test          Esegue i test Playwright"
	@echo "    make lint          ESLint + Prettier check"
	@echo "    make format        Auto-fix con Prettier"
	@echo "    make check         Lint + format check + test (come CI)"

# =============================================================================
# Docker compose — full stack
# =============================================================================

up:
	docker compose up

up-d:
	docker compose up -d
	@echo ""
	@echo "✓ Lookup avviato:"
	@echo "  Web app:  http://localhost:8080"
	@echo "  Postgres: localhost:5432 (user: lookup / pw: lookup_dev)"
	@echo "  Redis:    localhost:6379"
	@echo "  Stop:     make down"

down:
	docker compose down

logs:
	docker compose logs -f web

ps:
	docker compose ps

restart:
	docker compose restart

clean:
	docker compose down --volumes --rmi local

# =============================================================================
# Database
# =============================================================================

db-up:
	docker compose up -d postgres redis
	@echo "✓ postgres + redis avviati"

db-down:
	docker compose stop postgres redis

db-shell:
	docker compose exec postgres psql -U lookup -d lookup

db-reset:
	@echo "⚠ Questo cancellera' TUTTI i dati del DB. Conferma con Ctrl+C entro 3 secondi..."
	@sleep 3
	docker compose down -v
	docker compose up -d postgres redis
	@echo "✓ DB ripristinato pulito"

db-logs:
	docker compose logs -f postgres

# =============================================================================
# Sviluppo locale
# =============================================================================

dev:
	@echo "Avvio server no-cache su http://localhost:8765"
	cd apps/web && python3 no-cache-server.py 8765

install:
	npm install
	npx playwright install --with-deps chromium

test:
	npm test

lint:
	npm run lint
	npm run format:check

format:
	npm run format

check:
	npm run check
