# =============================================================================
# scripts/verify.ps1 - Verifica completa dello stack Lookup su Windows
# =============================================================================
# Esegue in sequenza: prerequisiti, npm ci, pull/build delle immagini, avvio
# dei container con attesa degli healthcheck, migrazioni Prisma, controllo
# delle versioni dentro i container, smoke test HTTP (infrastruttura e
# applicativo: login, prestiti, SSE) e test suite Vitest.
#
# Uso (dalla root del progetto):
#   .\scripts\verify.ps1                      tutto
#   .\scripts\verify.ps1 -SkipInstall         salta npm ci (ignorato se package-lock.json
#                                             e' piu' recente di node_modules)
#   .\scripts\verify.ps1 -SkipPull -SkipBuild riusa immagini gia' presenti
#   .\scripts\verify.ps1 -SkipTests           salta Vitest
#   .\scripts\verify.ps1 -Down                ferma i container alla fine
#   .\scripts\verify.ps1 -Reseed              ricarica i dati di prova (AZZERA il DB)
#   .\scripts\verify.ps1 -Monitoring          verifica anche Prometheus e Grafana
#
# Output (cartella logs/, ignorata da git):
#   logs/verify-<timestamp>.log   log completo: ogni comando e il suo output
#   logs/verify-latest.log        copia dell'ultimo log
#   logs/verify-latest.json       riepilogo strutturato (JSON)
#
# Exit code: 0 se nessuno step e' FAIL, 1 altrimenti.
#
# Se PowerShell blocca l'esecuzione, una tantum:
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#
# NOTA: file in puro ASCII per Windows PowerShell 5.1. Niente accenti o emoji.
# =============================================================================

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipPull,
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$SkipSmoke,
    [switch]$Down,
    [switch]$Reseed,
    [switch]$Monitoring,
    [int]$HealthTimeoutSec = 180,
    [string]$ApiUrl = 'http://localhost:3000',
    [string]$WebUrl = 'http://localhost:8080',
    [string]$MailUrl = 'http://localhost:8025',
    [string]$PrometheusUrl = 'http://localhost:9090',
    [string]$GrafanaUrl = 'http://localhost:3001',
    [string]$GrafanaUser = 'admin',
    [string]$GrafanaPassword = 'admin',
    [string]$SeedEmail = 'c.morandi@mail.it',
    [string]$SeedPassword = 'Lookup2026!'
)

# 'Continue' e non 'Stop': in PowerShell 5.1 lo stderr dei programmi esterni
# (npm, docker) diventerebbe un errore terminante anche quando il comando
# riesce. Il successo di ogni comando si giudica dall'exit code.
$ErrorActionPreference = 'Continue'

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$LogDir = Join-Path $Root 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$Stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile = Join-Path $LogDir "verify-$Stamp.log"
$Utf8    = New-Object System.Text.UTF8Encoding $false
$Results = New-Object System.Collections.ArrayList
$Esc     = [char]27

# Output dei tool senza colori ANSI, cosi' il log resta leggibile.
$env:NO_COLOR    = '1'
$env:FORCE_COLOR = '0'

# -----------------------------------------------------------------------------
# Helper
# -----------------------------------------------------------------------------

function Write-Log([string]$Text) {
    [System.IO.File]::AppendAllText($LogFile, $Text + "`r`n", $Utf8)
}

function Say([string]$Text, [string]$Color = 'Gray') {
    Write-Host $Text -ForegroundColor $Color
    Write-Log $Text
}

function Remove-Ansi([string]$Text) {
    return ($Text -replace "$Esc\[[0-9;]*[A-Za-z]", '')
}

# Esegue un comando esterno passando da cmd.exe: stdout e stderr vengono
# uniti come testo semplice, senza che PowerShell 5.1 li trasformi in
# ErrorRecord. Evitare doppi apici nella riga di comando (l'escaping verso
# cmd.exe in PowerShell 5.1 non e' affidabile).
function Invoke-Native([string]$CommandLine, [switch]$Quiet) {
    if (-not $Quiet) { Write-Log ">>> $CommandLine" }
    $out  = & cmd.exe /d /c "$CommandLine 2>&1"
    $code = $LASTEXITCODE
    $text = Remove-Ansi (($out | Out-String).TrimEnd())
    if (-not $Quiet) {
        if ($text) { Write-Log $text }
        Write-Log "<<< exit $code"
    }
    return @{ Code = $code; Output = $text }
}

function Invoke-Http([string]$Url, $Session) {
    Write-Log ">>> GET $Url"
    try {
        $p = @{ Uri = $Url; UseBasicParsing = $true; TimeoutSec = 15 }
        if ($Session) { $p.WebSession = $Session }
        $resp = Invoke-WebRequest @p
        $body = [string]$resp.Content
        Write-Log ("<<< {0} {1}" -f [int]$resp.StatusCode, $body.Substring(0, [Math]::Min(300, $body.Length)))
        return @{ Code = [int]$resp.StatusCode; Body = $body }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        Write-Log "<<< $code $($_.Exception.Message)"
        return @{ Code = $code; Body = $_.Exception.Message }
    }
}

function Add-Result([string]$Name, [string]$Status, [double]$Seconds, [string]$Detail) {
    $sec = [Math]::Round($Seconds, 1)
    [void]$Results.Add([pscustomobject]@{ step = $Name; status = $Status; seconds = $sec; detail = $Detail })
    $color = 'Red'
    if ($Status -eq 'PASS') { $color = 'Green' }
    if ($Status -eq 'WARN') { $color = 'Yellow' }
    if ($Status -eq 'SKIP') { $color = 'DarkGray' }
    Say ("[{0}] {1} ({2}s) {3}" -f $Status, $Name, $sec, $Detail) $color
}

# Ogni step e' uno scriptblock che restituisce @{ Status; Detail }.
# Status: PASS, WARN (anomalia non bloccante), FAIL, SKIP.
function Invoke-Step([string]$Name, [bool]$Skip, [scriptblock]$Body) {
    if ($Skip) { Add-Result $Name 'SKIP' 0 'saltato da parametro'; return }
    Say ''
    Say "=== $Name ===" 'Cyan'
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $r = & $Body
        if ($r -is [array]) { $r = $r[-1] }
        if (-not $r) { $r = @{ Status = 'FAIL'; Detail = 'lo step non ha restituito un esito' } }
    } catch {
        $r = @{ Status = 'FAIL'; Detail = "eccezione: $($_.Exception.Message)" }
    }
    $sw.Stop()
    Add-Result $Name $r.Status $sw.Elapsed.TotalSeconds $r.Detail
}

function Wait-Healthy([string[]]$Containers, [int]$TimeoutSec) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $pending  = @($Containers)
    while ($pending.Count -gt 0 -and (Get-Date) -lt $deadline) {
        $still = @()
        foreach ($c in $pending) {
            $h = (Invoke-Native "docker inspect -f {{.State.Health.Status}} $c" -Quiet).Output
            if ($h -ne 'healthy') { $still += $c }
        }
        $pending = $still
        if ($pending.Count -gt 0) { Start-Sleep -Seconds 3 }
    }
    return ,$pending
}

function Write-Summary {
    $failed  = @($Results | Where-Object { $_.status -eq 'FAIL' }).Count
    $warned  = @($Results | Where-Object { $_.status -eq 'WARN' }).Count
    $overall = 'PASS'
    if ($warned -gt 0) { $overall = 'WARN' }
    if ($failed -gt 0) { $overall = 'FAIL' }

    $summary = [pscustomobject]@{
        timestamp = $Stamp
        overall   = $overall
        log       = "logs/verify-$Stamp.log"
        steps     = $Results
    }
    $json = $summary | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText((Join-Path $LogDir 'verify-latest.json'), $json, $Utf8)

    Say ''
    Say '=== RIEPILOGO ===' 'Cyan'
    foreach ($r in $Results) { Say ("  {0,-5} {1}" -f $r.status, $r.step) }
    Say ''
    $color = 'Green'
    if ($overall -eq 'WARN') { $color = 'Yellow' }
    if ($overall -eq 'FAIL') { $color = 'Red' }
    Say "ESITO: $overall   (log: logs\verify-$Stamp.log)" $color
    Say ''
    Say 'Restano da verificare a mano (UI):'
    Say "  1. $WebUrl - login con un utente seed"
    Say '  2. richiesta di prestito da un utente, accettazione dall altro'
    Say '  3. notifica realtime visibile nel secondo browser senza ricaricare'

    Copy-Item $LogFile (Join-Path $LogDir 'verify-latest.log') -Force
    if ($failed -gt 0) { exit 1 } else { exit 0 }
}

# -----------------------------------------------------------------------------
# Step
# -----------------------------------------------------------------------------

Say "Lookup verify - $Stamp" 'Cyan'
Say "Root: $Root"

Invoke-Step 'Prerequisiti' $false {
    $n = Invoke-Native 'node -v'
    $m = Invoke-Native 'npm -v'
    $d = Invoke-Native 'docker version --format {{.Server.Version}}'
    $c = Invoke-Native 'docker compose version --short'
    $g = Invoke-Native 'git rev-parse --abbrev-ref HEAD'
    $h = Invoke-Native 'git rev-parse --short HEAD'
    if ($d.Code -ne 0) { return @{ Status = 'FAIL'; Detail = 'Docker non risponde: avvia Docker Desktop e riprova' } }
    $detail = "node $($n.Output), npm $($m.Output), docker $($d.Output), compose $($c.Output)"
    if ($g.Code -eq 0) { $detail += ", git $($g.Output)@$($h.Output)" }
    $major = 0
    if ($n.Output -match '^v(\d+)\.') { $major = [int]$Matches[1] }
    if ($major -lt 26) { return @{ Status = 'FAIL'; Detail = "$detail - serve Node 26 o superiore" } }
    return @{ Status = 'PASS'; Detail = $detail }
}
if ($Results[-1].status -eq 'FAIL') { Write-Summary }

# -SkipInstall vale solo se node_modules e' allineato al lockfile: npm ci
# scrive node_modules/.package-lock.json, quindi se package-lock.json e' piu'
# recente (pull o cambio ramo con dipendenze nuove) l'installazione si rifa'.
# Senza questo controllo Vitest, che gira sull'host, userebbe pacchetti vecchi.
$LockFile   = Join-Path $Root 'package-lock.json'
$HiddenLock = Join-Path $Root 'node_modules\.package-lock.json'
$StaleDeps  = (-not (Test-Path $HiddenLock)) -or
              ((Get-Item $LockFile).LastWriteTimeUtc -gt (Get-Item $HiddenLock).LastWriteTimeUtc)
$ForcedInstall = $SkipInstall.IsPresent -and $StaleDeps

Invoke-Step 'npm ci (dal lockfile)' ($SkipInstall.IsPresent -and -not $StaleDeps) {
    if ($ForcedInstall) { Say 'package-lock.json piu recente di node_modules: -SkipInstall ignorato' 'Yellow' }
    $r = Invoke-Native 'npm ci --no-audit --no-fund'
    if ($r.Code -ne 0) { return @{ Status = 'FAIL'; Detail = 'npm ci fallito, vedi log' } }
    if ($ForcedInstall) { return @{ Status = 'WARN'; Detail = 'eseguito nonostante -SkipInstall: node_modules non allineato a package-lock.json' } }
    return @{ Status = 'PASS'; Detail = 'dipendenze installate da package-lock.json' }
}

Invoke-Step 'Pull immagini' $SkipPull.IsPresent {
    $r = Invoke-Native 'docker compose pull web postgres redis mailpit'
    if ($r.Code -ne 0) { return @{ Status = 'FAIL'; Detail = 'docker compose pull fallito, vedi log' } }
    return @{ Status = 'PASS'; Detail = 'web, postgres, redis, mailpit aggiornate' }
}

Invoke-Step 'Build immagine API' $SkipBuild.IsPresent {
    $r = Invoke-Native 'docker compose --profile backend build api'
    if ($r.Code -ne 0) { return @{ Status = 'FAIL'; Detail = 'build api fallita, vedi log' } }
    return @{ Status = 'PASS'; Detail = 'lookup/api:dev ricostruita' }
}

Invoke-Step 'Avvio container + healthcheck' $false {
    $r = Invoke-Native 'docker compose --profile backend up -d'
    if ($r.Code -ne 0) { return @{ Status = 'FAIL'; Detail = 'docker compose up fallito, vedi log' } }
    $targets = @('lookup-postgres', 'lookup-redis', 'lookup-mailpit', 'lookup-web', 'lookup-api')
    $left = Wait-Healthy $targets $HealthTimeoutSec
    if ($left.Count -gt 0) {
        [void](Invoke-Native 'docker compose --profile backend ps')
        foreach ($c in $left) {
            [void](Invoke-Native "docker inspect -f {{json .State.Health}} $c")
            [void](Invoke-Native "docker logs --tail 40 $c")
        }
        return @{ Status = 'FAIL'; Detail = "non healthy dopo $HealthTimeoutSec s: $($left -join ', ')" }
    }
    return @{ Status = 'PASS'; Detail = ($targets -join ', ') + ' healthy' }
}
if ($Results[-1].status -eq 'FAIL') { Write-Summary }

Invoke-Step 'Database: migrazioni + dati di prova' $false {
    $migDir = Join-Path $Root 'apps\api\prisma\migrations'
    $sql = @(Get-ChildItem -Path $migDir -Recurse -Filter 'migration.sql' -ErrorAction SilentlyContinue)
    if ($sql.Count -eq 0) {
        return @{ Status = 'FAIL'; Detail = 'nessuna migrazione in apps/api/prisma/migrations: eseguire npm run db:baseline -w apps/api' }
    }
    $r = Invoke-Native 'npm run db:migrate:deploy -w apps/api'
    if ($r.Code -ne 0) { return @{ Status = 'FAIL'; Detail = 'prisma migrate deploy fallito, vedi log' } }

    # Dati di prova solo se il database e' vuoto: il seed azzera le tabelle
    $count = (Invoke-Native 'echo SELECT count(*) FROM users; | docker exec -i lookup-postgres psql -U lookup -d lookup -tA').Output.Trim()
    if ($count -eq '0' -or $Reseed) {
        $seed = Invoke-Native 'npm run db:seed -w apps/api'
        if ($seed.Code -ne 0) { return @{ Status = 'FAIL'; Detail = 'seed fallito, vedi log' } }
        return @{ Status = 'PASS'; Detail = "$($sql.Count) migrazioni, dati di prova caricati" }
    }
    return @{ Status = 'PASS'; Detail = "$($sql.Count) migrazioni, $count utenti gia' presenti (seed non rieseguito)" }
}

Invoke-Step 'Versioni nei container' $false {
    $pg    = (Invoke-Native 'echo SHOW server_version; | docker exec -i lookup-postgres psql -U lookup -d lookup -tA').Output
    $gis   = (Invoke-Native 'echo SELECT postgis_full_version(); | docker exec -i lookup-postgres psql -U lookup -d lookup -tA').Output
    $redis = (Invoke-Native 'docker exec lookup-redis redis-server --version').Output
    $node  = (Invoke-Native 'docker exec lookup-api node -v').Output
    $nginx = (Invoke-Native 'docker exec lookup-web nginx -v').Output
    # 't' se la collation registrata nel database non corrisponde a quella
    # del sistema operativo dell'immagine (succede cambiando immagine)
    $coll  = (Invoke-Native "echo SELECT datcollversion IS DISTINCT FROM pg_database_collation_actual_version(oid) FROM pg_database WHERE datname='lookup'; | docker exec -i lookup-postgres psql -U lookup -d lookup -tA").Output.Trim()

    $gisVer = '?'
    if ($gis -match 'POSTGIS="([0-9.]+)') { $gisVer = $Matches[1] }
    $redisVer = '?'
    if ($redis -match 'v=([0-9.]+)') { $redisVer = $Matches[1] }
    $nginxVer = '?'
    if ($nginx -match 'nginx/([0-9.]+)') { $nginxVer = $Matches[1] }
    $pgVer = ($pg -split '\s')[0]

    $detail = "postgres $pgVer, postgis $gisVer, redis $redisVer, node $node, nginx $nginxVer"
    $issues = @()
    if ($node -notmatch '^v26\.')        { $issues += 'node atteso 26.x' }
    if ($nginxVer -notmatch '^1\.30\.')  { $issues += 'nginx atteso 1.30.x' }
    if ($redisVer -notmatch '^8\.')       { $issues += 'redis atteso 8.x' }
    if ($pgVer -match '^16\.(\d+)') {
        if ([int]$Matches[1] -lt 16)     { $issues += 'postgres atteso 16.16 o superiore' }
    } else                               { $issues += 'postgres atteso 16.x' }
    if ($gisVer -notmatch '^3\.7\.')     { $issues += 'postgis atteso 3.7.x' }
    if ($gis -match 'need upgrade')      { $issues += 'postgis segnala need upgrade: eseguire ALTER EXTENSION postgis UPDATE' }
    if ($coll -eq 't')                   { $issues += 'collation del database da aggiornare: REINDEX DATABASE lookup e ALTER DATABASE lookup REFRESH COLLATION VERSION' }
    if ($issues.Count -gt 0) { return @{ Status = 'WARN'; Detail = "$detail - " + ($issues -join '; ') } }
    return @{ Status = 'PASS'; Detail = $detail }
}

Invoke-Step 'Smoke HTTP infrastruttura' $SkipSmoke.IsPresent {
    $issues = @()
    $ping = Invoke-Http "$ApiUrl/api/ping"
    if ($ping.Code -ne 200) { $issues += "ping $($ping.Code)" }
    $health = Invoke-Http "$ApiUrl/api/health"
    if ($health.Code -ne 200) {
        $issues += "health $($health.Code)"
    } else {
        $h = $health.Body | ConvertFrom-Json
        if ($h.status -ne 'ok') { $issues += "health status=$($h.status) db=$($h.db) redis=$($h.redis)" }
    }
    $web = Invoke-Http "$WebUrl/"
    if ($web.Code -ne 200) { $issues += "web $($web.Code)" }
    $docs = Invoke-Http "$ApiUrl/api/docs/json"
    if ($docs.Code -ne 200) { $issues += "openapi $($docs.Code)" }
    if ($issues.Count -gt 0) { return @{ Status = 'FAIL'; Detail = $issues -join '; ' } }
    return @{ Status = 'PASS'; Detail = 'ping, health (db+redis ok), web, openapi' }
}

# Stessi percorsi del browser: login, sessione e SSE passano dal frontend
# (nginx inoltra /api/* all'API), le chiamate REST vanno all'API sulla 3000.
Invoke-Step 'Smoke applicativo (login, prestiti, SSE)' $SkipSmoke.IsPresent {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $body = @{ email = $SeedEmail; password = $SeedPassword } | ConvertTo-Json
    Write-Log ">>> POST $WebUrl/api/auth/sign-in/email ($SeedEmail)"
    try {
        $login = Invoke-WebRequest -Uri "$WebUrl/api/auth/sign-in/email" -Method Post -Body $body `
            -ContentType 'application/json' -Headers @{ Origin = $WebUrl } `
            -WebSession $session -UseBasicParsing -TimeoutSec 15
        Write-Log "<<< $([int]$login.StatusCode)"
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        Write-Log "<<< $code $($_.Exception.Message)"
        # Il corpo della risposta e i log dell'API servono a capire la causa
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Log ('<<< corpo: ' + $reader.ReadToEnd())
        } catch { }
        [void](Invoke-Native 'docker logs --tail 80 lookup-api')
        return @{ Status = 'FAIL'; Detail = "login $code - dettagli e log dell API nel file di log" }
    }

    $issues = @()
    $sess = Invoke-Http "$WebUrl/api/auth/get-session" $session
    if ($sess.Code -ne 200 -or $sess.Body -notmatch [regex]::Escape($SeedEmail)) { $issues += "get-session $($sess.Code)" }
    $me = Invoke-Http "$ApiUrl/api/users/me" $session
    if ($me.Code -ne 200) { $issues += "users/me $($me.Code)" }
    $sent = Invoke-Http "$ApiUrl/api/me/loans/sent" $session
    if ($sent.Code -ne 200) { $issues += "loans/sent $($sent.Code)" }
    $recv = Invoke-Http "$ApiUrl/api/me/loans/received" $session
    if ($recv.Code -ne 200) { $issues += "loans/received $($recv.Code)" }

    # SSE: basta ricevere gli header con Content-Type text/event-stream,
    # poi si chiude la connessione (lo stream resterebbe aperto per sempre).
    Write-Log ">>> GET $WebUrl/api/me/events (SSE, solo header)"
    try {
        $req = [System.Net.HttpWebRequest]::Create("$WebUrl/api/me/events")
        $req.CookieContainer = $session.Cookies
        $req.Accept  = 'text/event-stream'
        $req.Timeout = 10000
        $resp = $req.GetResponse()
        $ct = $resp.ContentType
        $req.Abort()
        Write-Log "<<< $([int]$resp.StatusCode) $ct"
        if ($ct -notmatch 'text/event-stream') { $issues += "sse content-type $ct" }
    } catch {
        Write-Log "<<< errore $($_.Exception.Message)"
        $issues += 'sse non raggiungibile'
    }

    if ($issues.Count -gt 0) {
        [void](Invoke-Native 'docker logs --tail 80 lookup-api')
        return @{ Status = 'FAIL'; Detail = $issues -join '; ' }
    }
    return @{ Status = 'PASS'; Detail = "login e sessione via frontend ($SeedEmail), users/me, prestiti inviati/ricevuti, stream SSE via frontend" }
}

# Email: richiesta di reset password dal frontend, poi controllo in Mailpit
# che il messaggio sia arrivato (SMTP dal container API a Mailpit).
Invoke-Step 'Email (reset password -> Mailpit)' $SkipSmoke.IsPresent {
    $before = Invoke-Http "$MailUrl/api/v1/messages?limit=1"
    if ($before.Code -ne 200) { return @{ Status = 'FAIL'; Detail = "Mailpit non risponde su $MailUrl ($($before.Code))" } }
    $total0 = ($before.Body | ConvertFrom-Json).total
    $body = @{ email = $SeedEmail; redirectTo = "$WebUrl/reset-password.html" } | ConvertTo-Json
    Write-Log ">>> POST $WebUrl/api/auth/request-password-reset ($SeedEmail)"
    try {
        $r = Invoke-WebRequest -Uri "$WebUrl/api/auth/request-password-reset" -Method Post -Body $body `
            -ContentType 'application/json' -Headers @{ Origin = $WebUrl } -UseBasicParsing -TimeoutSec 15
        Write-Log "<<< $([int]$r.StatusCode)"
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        Write-Log "<<< $code $($_.Exception.Message)"
        [void](Invoke-Native 'docker logs --tail 40 lookup-api')
        return @{ Status = 'FAIL'; Detail = "request-password-reset $code" }
    }
    # L'invio e' asincrono: si attende fino a 10 secondi
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        $after = Invoke-Http "$MailUrl/api/v1/messages?limit=1"
        if ($after.Code -eq 200) {
            $j = $after.Body | ConvertFrom-Json
            if ($j.total -gt $total0 -and $after.Body -match [regex]::Escape($SeedEmail)) {
                # Mailpit accetta solo connessioni STARTTLS autenticate: se
                # l'email e' arrivata, TLS e credenziali hanno funzionato.
                # Il log di avvio dell'API lo conferma esplicitamente.
                $logs = Invoke-Native 'docker logs lookup-api' -Quiet
                $tls = 'STARTTLS + credenziali'
                if ($logs.Output -match 'server SMTP raggiungibile') { $tls += ', controllo SMTP di avvio OK' }
                return @{ Status = 'PASS'; Detail = "email di reset per $SeedEmail arrivata in Mailpit ($tls)" }
            }
        }
    }
    [void](Invoke-Native 'docker logs --tail 40 lookup-api')
    return @{ Status = 'FAIL'; Detail = 'nessuna email arrivata in Mailpit entro 10 s' }
}

# Monitoraggio (solo con -Monitoring): Prometheus raccoglie le metriche
# dell'API, Grafana e' raggiungibile, datasource e dashboard caricati.
Invoke-Step 'Monitoraggio (Prometheus + Grafana)' (-not $Monitoring.IsPresent) {
    $r = Invoke-Native 'docker compose --profile backend --profile monitoring up -d prometheus grafana'
    if ($r.Code -ne 0) { return @{ Status = 'FAIL'; Detail = 'avvio di prometheus/grafana fallito, vedi log' } }
    $issues = @()

    # Prometheus: target lookup-api 'up' (attesa fino a 60 s: scrape ogni 15 s)
    $up = $false
    for ($i = 0; $i -lt 30 -and -not $up; $i++) {
        $t = Invoke-Http "$PrometheusUrl/api/v1/targets"
        if ($t.Code -eq 200) {
            $api = ($t.Body | ConvertFrom-Json).data.activeTargets | Where-Object { $_.labels.job -eq 'lookup-api' }
            if ($api -and $api.health -eq 'up') { $up = $true; break }
        }
        Start-Sleep -Seconds 2
    }
    if (-not $up) { $issues += 'prometheus: target lookup-api non up' }
    $pv = '?'
    $b = Invoke-Http "$PrometheusUrl/api/v1/status/buildinfo"
    if ($b.Code -eq 200) { $pv = ($b.Body | ConvertFrom-Json).data.version }

    # Grafana: salute, datasource e dashboard (autenticazione di base)
    $gv = '?'
    $h = $null
    for ($i = 0; $i -lt 30; $i++) {
        $h = Invoke-Http "$GrafanaUrl/api/health"
        if ($h.Code -eq 200) { break }
        Start-Sleep -Seconds 2
    }
    if ($h.Code -ne 200) {
        $issues += "grafana /api/health $($h.Code)"
    } else {
        $gv = ($h.Body | ConvertFrom-Json).version
        $pair = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($GrafanaUser):$($GrafanaPassword)"))
        $hdr = @{ Authorization = "Basic $pair" }
        try {
            $ds = Invoke-WebRequest -Uri "$GrafanaUrl/api/datasources/uid/prometheus/health" -Headers $hdr -UseBasicParsing -TimeoutSec 15
            Write-Log "<<< datasource $([int]$ds.StatusCode) $($ds.Content)"
            if ($ds.Content -notmatch '"status":"OK"') { $issues += 'grafana: datasource prometheus non OK' }
        } catch { $issues += 'grafana: datasource prometheus non trovato o non OK' }
        try {
            $se = Invoke-WebRequest -Uri "$GrafanaUrl/api/search?type=dash-db" -Headers $hdr -UseBasicParsing -TimeoutSec 15
            $uids = @(($se.Content | ConvertFrom-Json) | ForEach-Object { $_.uid })
            Write-Log "<<< dashboard: $($uids -join ', ')"
            foreach ($u in @('lookup-overview', 'lookup-business', 'lookup-jobs-sse')) {
                if ($uids -notcontains $u) { $issues += "grafana: dashboard $u mancante" }
            }
        } catch { $issues += 'grafana: ricerca dashboard fallita' }
    }

    $detail = "prometheus $pv, grafana $gv"
    if ($issues.Count -gt 0) { return @{ Status = 'FAIL'; Detail = "$detail - " + ($issues -join '; ') } }
    return @{ Status = 'PASS'; Detail = "$detail, target lookup-api up, datasource OK, 3 dashboard caricati" }
}

Invoke-Step 'Test suite Vitest' $SkipTests.IsPresent {
    $setup = Invoke-Native 'npm run test:setup-db -w apps/api'
    if ($setup.Code -ne 0) { return @{ Status = 'FAIL'; Detail = 'setup del DB di test fallito, vedi log' } }
    $t = Invoke-Native 'npm test -w apps/api'
    $line = 'riepilogo non trovato'
    if ($t.Output -match '(?m)^\s*Tests\s+(.+)$') { $line = $Matches[1].Trim() }
    if ($t.Code -ne 0) { return @{ Status = 'FAIL'; Detail = "Tests: $line" } }
    return @{ Status = 'PASS'; Detail = "Tests: $line" }
}

if ($Down) {
    Say ''
    Say '=== Arresto container ===' 'Cyan'
    [void](Invoke-Native 'docker compose --profile backend down')
}

Write-Summary
