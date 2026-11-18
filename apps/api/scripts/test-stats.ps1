# =============================================================================
# test-stats.ps1 - Smoke test endpoint /api/stats + /api/books/nearby (PostGIS)
# =============================================================================
# Esegui da apps/api/ (richiede backend in esecuzione + seed con PostGIS setup):
#   .\scripts\test-stats.ps1
#
# IMPORTANTE: prima esecuzione richiede che il seed sia stato eseguito DOPO
# che lo schema include la colonna location PostGIS. Se hai db esistente,
# esegui prima: cd apps/api && npx prisma db seed
# =============================================================================

$BASE = "http://localhost:3000"

function Section($t) { Write-Host ""; Write-Host "===== $t =====" -ForegroundColor Cyan }
function Ok($m) { Write-Host "  [OK] $m" -ForegroundColor Green }
function Fail($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red }

# === STATS ===

# --- 1. GET /api/stats/featured ---
Section "GET /api/stats/featured (top 10 libri trend, ultimi 7gg)"
$featured = Invoke-RestMethod -Uri "$BASE/api/stats/featured" -Method Get
Ok "Window: $($featured.windowDays) giorni, ritornati $($featured.data.Count) libri"
$featured.data | Select-Object -First 5 | ForEach-Object {
    $cat = if ($_.primaryCategory) { $_.primaryCategory.name } else { "(no cat)" }
    Write-Host "    #$($_.id) [$cat] `"$($_.title)`" - score=$($_.metrics.score) (loans=$($_.metrics.loanCount) likes=$($_.metrics.likeCount) views=$($_.metrics.viewCount))"
}

# --- 2. GET /api/stats/featured con window personalizzata ---
Section "GET /api/stats/featured?days=30&limit=5"
$f30 = Invoke-RestMethod -Uri "$BASE/api/stats/featured?days=30&limit=5" -Method Get
Ok "Window: $($f30.windowDays) giorni, $($f30.data.Count) libri (max 5)"

# --- 3. Diversity penalty: verifica che le prime 3 categorie siano diverse ---
Section "Verifica diversity penalty su featured"
if ($featured.data.Count -ge 3) {
    $cats = $featured.data | Select-Object -First 3 | ForEach-Object { $_.primaryCategory.id }
    $uniqueCats = $cats | Sort-Object -Unique
    if ($uniqueCats.Count -eq $cats.Count) {
        Ok "Prime 3 categorie distinte (diversity OK)"
    } else {
        Write-Host "  [WARN] Categorie ripetute nelle prime 3: $($cats -join ', ')" -ForegroundColor Yellow
    }
}

# --- 4. GET /api/stats/ridgeline ---
Section "GET /api/stats/ridgeline (default 10 utenti x 8 settimane)"
$ridge = Invoke-RestMethod -Uri "$BASE/api/stats/ridgeline" -Method Get
Ok "weekLabels ($($ridge.weekLabels.Count)): $($ridge.weekLabels -join ', ')"
Ok "Utenti ritornati: $($ridge.data.Count)"
$ridge.data | Select-Object -First 5 | ForEach-Object {
    $weekCounts = ($_.weeks | ForEach-Object { $_.count }) -join '/'
    Write-Host "    @$($_.username) ($($_.accountType)) total=$($_.total) settimane=[$weekCounts]"
}

# --- 5. Ridgeline customizzata ---
Section "GET /api/stats/ridgeline?users=3&weeks=4"
$ridge2 = Invoke-RestMethod -Uri "$BASE/api/stats/ridgeline?users=3&weeks=4" -Method Get
Ok "weekLabels=$($ridge2.weekLabels.Count), utenti=$($ridge2.data.Count)"

# --- 6. GET /api/stats/top-users ---
Section "GET /api/stats/top-users (top 20 multi-metrica)"
$top = Invoke-RestMethod -Uri "$BASE/api/stats/top-users" -Method Get
Ok "Utenti ritornati: $($top.data.Count)"
$top.data | Select-Object -First 5 | ForEach-Object {
    $m = $_.metrics
    Write-Host "    @$($_.username) - score=$($m.score) (loans=$($m.loanCount) reviews=$($m.reviewCount) posts=$($m.postCount) rating=$($m.avgRating))"
}

# --- 7. GET /api/stats/top-users con limit ---
Section "GET /api/stats/top-users?limit=3"
$top3 = Invoke-RestMethod -Uri "$BASE/api/stats/top-users?limit=3" -Method Get
if ($top3.data.Count -le 3) {
    Ok "Ritornati max 3 utenti (atteso <=3): $($top3.data.Count)"
} else {
    Fail "Ritornati $($top3.data.Count) (atteso <=3)"
}

# --- 8. GET /api/stats/bisac-cooccurrence ---
Section "GET /api/stats/bisac-cooccurrence (default minCount=2)"
$cooc = Invoke-RestMethod -Uri "$BASE/api/stats/bisac-cooccurrence" -Method Get
Ok "Coppie di categorie trovate: $($cooc.data.Count) (minCount=$($cooc.minCount))"
$cooc.data | Select-Object -First 5 | ForEach-Object {
    Write-Host "    `"$($_.a.name)`" <-> `"$($_.b.name)`" = $($_.count) libri"
}

# --- 9. Cooccurrence con minCount alto (filtra tutto) ---
Section "GET /api/stats/bisac-cooccurrence?minCount=99 (filtra tutto)"
$cooc99 = Invoke-RestMethod -Uri "$BASE/api/stats/bisac-cooccurrence?minCount=99" -Method Get
if ($cooc99.data.Count -eq 0) {
    Ok "Nessuna coppia con count>=99 (filtraggio OK)"
} else {
    Fail "Trovate $($cooc99.data.Count) coppie (atteso 0)"
}

# === GEO (PostGIS) ===

# --- 10. GET /api/books/nearby vicino a Chiaia (40.8358, 14.2351) ---
Section "GET /api/books/nearby vicino a Chiaia (radius=2km)"
$nearby = Invoke-RestMethod -Uri "$BASE/api/books/nearby?lat=40.8358&lng=14.2351&radius=2000" -Method Get
Ok "Center: ($($nearby.center.lat), $($nearby.center.lng)), radius=$($nearby.radius)m"
Ok "Total libri entro 2km: $($nearby.pagination.total), ritornati $($nearby.data.Count)"
$nearby.data | Select-Object -First 5 | ForEach-Object {
    Write-Host "    #$($_.id) `"$($_.title)`" - $($_.owner.displayName) @ $($_.owner.city) ($($_.distanceMeters)m)"
}

# --- 11. Distanza ordinata ASC ---
Section "Verifica che distanze siano ordinate ASC"
if ($nearby.data.Count -ge 2) {
    $sorted = $true
    for ($i = 1; $i -lt $nearby.data.Count; $i++) {
        if ($nearby.data[$i].distanceMeters -lt $nearby.data[$i-1].distanceMeters) {
            $sorted = $false; break
        }
    }
    if ($sorted) { Ok "Distanze ordinate ASC" } else { Fail "Distanze NON ordinate" }
}

# --- 12. Raggio piccolo (no risultati) ---
Section "GET /api/books/nearby con raggio piccolissimo (atteso 0 risultati)"
$small = Invoke-RestMethod -Uri "$BASE/api/books/nearby?lat=0&lng=0&radius=100" -Method Get
if ($small.data.Count -eq 0) {
    Ok "Nessun libro a (0,0) entro 100m"
} else {
    Fail "Inaspettato: $($small.data.Count) libri"
}

# --- 13. Validation: lat fuori range ---
Section "GET /api/books/nearby con lat=999 (atteso 400)"
try {
    Invoke-RestMethod -Uri "$BASE/api/books/nearby?lat=999&lng=0&radius=1000" -Method Get | Out-Null
    Fail "Non ha dato errore!"
} catch {
    Ok "HTTP $($_.Exception.Response.StatusCode.value__) (atteso 400)"
}

# --- 14. Validation: missing radius ---
Section "GET /api/books/nearby senza radius (atteso 400)"
try {
    Invoke-RestMethod -Uri "$BASE/api/books/nearby?lat=40&lng=14" -Method Get | Out-Null
    Fail "Non ha dato errore!"
} catch {
    Ok "HTTP $($_.Exception.Response.StatusCode.value__) (atteso 400)"
}

# --- 15. Confronto con il vecchio filtro geo (bounding box) ---
Section "Confronto: vecchio /api/books?lat&lng&radius vs nuovo /api/books/nearby"
$bbox = Invoke-RestMethod -Uri "$BASE/api/books?lat=40.8358&lng=14.2351&radius=2000" -Method Get
Write-Host "  /api/books (bbox): $($bbox.pagination.total) libri"
Write-Host "  /api/books/nearby (PostGIS): $($nearby.pagination.total) libri"
Ok "(Numbers possono differire: bbox e' un quadrato approssimato, ST_DWithin e' un cerchio esatto)"

Write-Host ""
Write-Host "===== TUTTI I TEST STATS + GEO COMPLETATI =====" -ForegroundColor Cyan
