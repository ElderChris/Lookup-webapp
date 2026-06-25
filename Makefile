# =============================================================================
# Makefile — Libreria Diffusa
# =============================================================================
# Shortcuts per operazioni comuni di sviluppo.
# Usa: `make help` per la lista completa.
#
# Funziona su macOS, Linux e Windows (con WSL o git-bash).
# Su Windows nativo: usa direttamente i comandi docker/npm dalla colonna "esegue".
# =============================================================================

.PHONY: help up up-d down logs ps restart clean test lint format check dev install

# Default target: mostra help
help:
	@echo "Libreria Diffusa — comandi disponibili:"
	@echo ""
	@echo "  Docker (production-like, demo cliente):"
	@echo "    make up            Avvia la web app via docker compose (foreground)"
	@echo "    make up-d          Avvia in background (detached)"
	@echo "    make down          Ferma e rimuove i container"
	@echo "    make logs          Segui i log di nginx"
	@echo "    make ps            Mostra lo stato dei container"
	@echo "    make restart       Restart pulito"
	@echo "    make clean         Rimuove anche i volumi e l'immagine"
	@echo ""
	@echo "  Sviluppo (rapido, locale):"
	@echo "    make dev           Avvia python no-cache-server su :8765"
	@echo "    make install       Installa dev deps (npm + playwright browsers)"
	@echo "    make test          Esegue i test Playwright"
	@echo "    make lint          ESLint + Prettier check"
	@echo "    make format        Auto-fix con Prettier"
	@echo "    make check         Lint + format check + test (come CI)"

# =============================================================================
# Docker compose (Fase 0d)
# =============================================================================

up:
	docker compose up

up-d:
	docker compose up -d
	@echo ""
	@echo "✓ Libreria Diffusa avviata su http://localhost:8080"
	@echo "  Stop: make down"

down:
	docker compose down

logs:
	docker compose logs -f web

ps:
	docker compose ps

restart:
	docker compose restart web

clean:
	docker compose down --volumes --rmi local

# =============================================================================
# Sviluppo locale
# =============================================================================

dev:
	@echo "Avvio server no-cache su http://localhost:8765"
	python3 no-cache-server.py 8765

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
