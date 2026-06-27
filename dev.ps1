# =============================================================================
# dev.ps1 - Equivalente PowerShell del Makefile per utenti Windows
# =============================================================================
# Uso: .\dev.ps1 <comando>
#
# Se PowerShell blocca l'esecuzione (policy execution), lancia una volta:
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#
# NOTA: questo file e' scritto in puro ASCII per compatibilita' con
# Windows PowerShell 5.1. Non aggiungere caratteri accentati o emoji.
# =============================================================================

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

function Show-Help {
    Write-Host "Lookup - comandi disponibili:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Docker (full stack):"
    Write-Host "    .\dev.ps1 up         Avvia tutti i servizi via docker compose [foreground]"
    Write-Host "    .\dev.ps1 up-d       Avvia in background [detached]"
    Write-Host "    .\dev.ps1 down       Ferma e rimuove i container"
    Write-Host "    .\dev.ps1 logs       Segui i log di nginx"
    Write-Host "    .\dev.ps1 ps         Mostra lo stato dei container"
    Write-Host "    .\dev.ps1 restart    Restart pulito"
    Write-Host "    .\dev.ps1 clean      Rimuove anche i volumi [RESET DB] e le immagini"
    Write-Host ""
    Write-Host "  Database (postgres + redis):"
    Write-Host "    .\dev.ps1 db-up      Avvia solo postgres + redis [background]"
    Write-Host "    .\dev.ps1 db-down    Ferma postgres + redis"
    Write-Host "    .\dev.ps1 db-shell   Apre psql nel container postgres"
    Write-Host "    .\dev.ps1 db-reset   Ferma + cancella volumi + ricrea DB pulito"
    Write-Host "    .\dev.ps1 db-logs    Segui i log di postgres"
    Write-Host ""
    Write-Host "  Sviluppo (rapido, locale):"
    Write-Host "    .\dev.ps1 dev        Avvia python no-cache-server su :8765"
    Write-Host "    .\dev.ps1 install    Installa dev deps [npm + playwright browsers]"
    Write-Host "    .\dev.ps1 test       Esegue i test Playwright"
    Write-Host "    .\dev.ps1 lint       ESLint + Prettier check"
    Write-Host "    .\dev.ps1 format     Auto-fix con Prettier"
    Write-Host "    .\dev.ps1 check      Lint + format check + test [come CI]"
    Write-Host ""
    Write-Host "Suggerimento: prima dei comandi 'up' verifica che Docker Desktop sia avviato." -ForegroundColor Yellow
}

function Test-DockerRunning {
    try {
        docker ps 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { return $false }
        return $true
    } catch {
        return $false
    }
}

function Require-Docker {
    if (-not (Test-DockerRunning)) {
        Write-Host "[ERROR] Docker Desktop non e' in esecuzione." -ForegroundColor Red
        Write-Host "        Apri Docker Desktop dal menu Start, aspetta che l'icona" -ForegroundColor Yellow
        Write-Host "        della balena sulla system tray sia stabile, poi riprova." -ForegroundColor Yellow
        exit 1
    }
}

switch ($Command.ToLower()) {
    "help"    { Show-Help }

    "up" {
        Require-Docker
        docker compose up
    }

    "up-d" {
        Require-Docker
        docker compose up -d
        Write-Host ""
        Write-Host "[OK] Lookup avviato:" -ForegroundColor Green
        Write-Host "     Web app:  http://localhost:8080"
        Write-Host "     Postgres: localhost:5432 (user: lookup / pw: lookup_dev)"
        Write-Host "     Redis:    localhost:6379"
        Write-Host "     Stop:     .\dev.ps1 down"
    }

    "down"    { docker compose down }
    "logs"    { docker compose logs -f web }
    "ps"      { docker compose ps }
    "restart" { docker compose restart }
    "clean"   { docker compose down --volumes --rmi local }

    # ==== Database commands ====
    "db-up" {
        Require-Docker
        docker compose up -d postgres redis
        Write-Host "[OK] postgres + redis avviati" -ForegroundColor Green
    }

    "db-down" {
        docker compose stop postgres redis
    }

    "db-shell" {
        Require-Docker
        docker compose exec postgres psql -U lookup -d lookup
    }

    "db-reset" {
        Write-Host "[WARN] Questo cancellera' TUTTI i dati del DB." -ForegroundColor Yellow
        $confirm = Read-Host "Procedere? [y/N]"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "Annullato."
            exit 0
        }
        docker compose down -v
        docker compose up -d postgres redis
        Write-Host "[OK] DB ripristinato pulito" -ForegroundColor Green
    }

    "db-logs" { docker compose logs -f postgres }

    # ==== Dev commands ====
    "dev" {
        Write-Host "Avvio server no-cache su http://localhost:8765" -ForegroundColor Cyan
        Push-Location apps/web
        try {
            python no-cache-server.py 8765
        } finally {
            Pop-Location
        }
    }

    "install" {
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] npm install fallito" -ForegroundColor Red
            exit 1
        }
        npx playwright install --with-deps chromium
    }

    "test"    { npm test }
    "lint"    { npm run lint; npm run format:check }
    "format"  { npm run format }
    "check"   { npm run check }

    default {
        Write-Host "[ERROR] Comando sconosciuto: $Command" -ForegroundColor Red
        Show-Help
        exit 1
    }
}
