# =============================================================================
# test-books.ps1 - Smoke test manuale degli endpoint /api/books
# =============================================================================
# Esegui da apps/api/ (richiede backend in esecuzione su :3000):
#   .\scripts\test-books.ps1
#
# Usa l'utente id=1 (Chiara Morandi) come "current user" per le operazioni
# che richiedono auth (via header X-Lookup-User-Id).
# =============================================================================

$BASE = "http://localhost:3000"
$USER_ID = 1
$HEADERS = @{ "X-Lookup-User-Id" = $USER_ID }

function Section($title) {
    Write-Host ""
    Write-Host "===== $title =====" -ForegroundColor Cyan
}

function ShowJson($obj) {
    $obj | ConvertTo-Json -Depth 5 | Out-Host
}

# --- 1. GET lista (no filtri) ---
Section "GET /api/books (default, 20 libri attesi)"
$r = Invoke-RestMethod -Uri "$BASE/api/books" -Method Get
Write-Host "  Total: $($r.pagination.total), Returned: $($r.data.Count)" -ForegroundColor Green
$r.data[0..2] | ForEach-Object {
    Write-Host "    #$($_.id) `"$($_.title)`" - $($_.author) - owner: $($_.owner.displayName)"
}

# --- 2. GET lista filtrata per categoria ---
Section "GET /api/books?category=5 (Gialli e noir)"
$r = Invoke-RestMethod -Uri "$BASE/api/books?category=5" -Method Get
Write-Host "  Total: $($r.pagination.total)" -ForegroundColor Green
$r.data | ForEach-Object {
    Write-Host "    #$($_.id) `"$($_.title)`""
}

# --- 3. GET lista con ricerca testuale ---
Section "GET /api/books?q=napoli (ricerca su titolo+autore)"
$r = Invoke-RestMethod -Uri "$BASE/api/books?q=napoli" -Method Get
Write-Host "  Total: $($r.pagination.total)" -ForegroundColor Green
$r.data | ForEach-Object {
    Write-Host "    #$($_.id) `"$($_.title)`" - $($_.author)"
}

# --- 4. GET lista per owner ---
Section "GET /api/books?ownerId=1 (libri di Chiara Morandi)"
$r = Invoke-RestMethod -Uri "$BASE/api/books?ownerId=1" -Method Get
Write-Host "  Total: $($r.pagination.total)" -ForegroundColor Green
$r.data | ForEach-Object {
    Write-Host "    #$($_.id) `"$($_.title)`""
}

# --- 5. GET dettaglio ---
Section "GET /api/books/1 (dettaglio Il Gattopardo)"
$r = Invoke-RestMethod -Uri "$BASE/api/books/1" -Method Get
Write-Host "  Title:       $($r.title)" -ForegroundColor Green
Write-Host "  Author:      $($r.author)"
Write-Host "  Owner:       $($r.owner.displayName) ($($r.owner.city))"
Write-Host "  Categories:  $(($r.categories | ForEach-Object { $_.name }) -join ', ')"
Write-Host "  Likes:       $($r.likesCount)"

# --- 6. POST views (incrementa) ---
Section "POST /api/books/1/views (incrementa view)"
$r = Invoke-RestMethod -Uri "$BASE/api/books/1/views" -Method Post -Headers $HEADERS
Write-Host "  $($r | ConvertTo-Json -Compress)" -ForegroundColor Green
Write-Host "  Riprovando subito (deve risultare debounced)..."
$r2 = Invoke-RestMethod -Uri "$BASE/api/books/1/views" -Method Post -Headers $HEADERS
Write-Host "  $($r2 | ConvertTo-Json -Compress)" -ForegroundColor Yellow

# --- 7. POST nuovo libro (auth richiesta) ---
Section "POST /api/books (crea nuovo libro per user 1)"
$body = @{
    title       = "Libro di Test API"
    author      = "Tester"
    year        = 2026
    publisher   = "Editore Test"
    pages       = 100
    description = "Libro creato dal test script API."
    categoryIds = @(1, 5)  # Narrativa (primary) + Gialli
    tags        = @("test", "api")
} | ConvertTo-Json
$created = Invoke-RestMethod -Uri "$BASE/api/books" -Method Post -Headers $HEADERS -ContentType "application/json" -Body $body
Write-Host "  Creato libro #$($created.id) `"$($created.title)`"" -ForegroundColor Green
$newId = $created.id

# --- 8. PATCH (owner only) ---
Section "PATCH /api/books/$newId (modifica titolo)"
$patch = @{ title = "Libro di Test API (modificato)" } | ConvertTo-Json
$patched = Invoke-RestMethod -Uri "$BASE/api/books/$newId" -Method Patch -Headers $HEADERS -ContentType "application/json" -Body $patch
Write-Host "  Nuovo title: $($patched.title)" -ForegroundColor Green

# --- 9. PATCH come altro utente (deve fallire 403) ---
Section "PATCH /api/books/$newId come user 2 (deve essere 403 Forbidden)"
$otherHeaders = @{ "X-Lookup-User-Id" = 2 }
try {
    Invoke-RestMethod -Uri "$BASE/api/books/$newId" -Method Patch -Headers $otherHeaders -ContentType "application/json" -Body $patch
    Write-Host "  [FAIL] La richiesta NON ha dato errore!" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  [OK] HTTP $code (atteso 403)" -ForegroundColor Green
}

# --- 10. DELETE (owner only) ---
Section "DELETE /api/books/$newId (pulizia)"
Invoke-RestMethod -Uri "$BASE/api/books/$newId" -Method Delete -Headers $HEADERS | Out-Null
Write-Host "  [OK] Libro $newId eliminato" -ForegroundColor Green

# --- 11. GET libro eliminato (deve essere 404) ---
Section "GET /api/books/$newId (deve essere 404 Not Found)"
try {
    Invoke-RestMethod -Uri "$BASE/api/books/$newId" -Method Get
    Write-Host "  [FAIL] La richiesta NON ha dato errore!" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  [OK] HTTP $code (atteso 404)" -ForegroundColor Green
}

# --- 12. POST senza auth (deve essere 401) ---
Section "POST /api/books senza auth (deve essere 401 Unauthenticated)"
try {
    Invoke-RestMethod -Uri "$BASE/api/books" -Method Post -ContentType "application/json" -Body $body
    Write-Host "  [FAIL] La richiesta NON ha dato errore!" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  [OK] HTTP $code (atteso 401)" -ForegroundColor Green
}

# --- 13. POST con body invalido (deve essere 400) ---
Section "POST /api/books con body invalido (deve essere 400 Validation)"
$badBody = @{ title = ""; author = "X" } | ConvertTo-Json  # title vuoto, manca categoryIds
try {
    Invoke-RestMethod -Uri "$BASE/api/books" -Method Post -Headers $HEADERS -ContentType "application/json" -Body $badBody
    Write-Host "  [FAIL] La richiesta NON ha dato errore!" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  [OK] HTTP $code (atteso 400)" -ForegroundColor Green
}

Write-Host ""
Write-Host "===== TUTTI I TEST COMPLETATI =====" -ForegroundColor Cyan
