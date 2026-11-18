# =============================================================================
# test-users.ps1 - Smoke test endpoint /api/users + likes
# =============================================================================
# Esegui da apps/api/ (richiede backend in esecuzione su :3000):
#   .\scripts\test-users.ps1
# =============================================================================

$BASE = "http://localhost:3000"
$USER1 = @{ "X-Lookup-User-Id" = 1 }   # Chiara Morandi (person)
$USER2 = @{ "X-Lookup-User-Id" = 2 }   # Marco De Vito (person)
$ORG7  = @{ "X-Lookup-User-Id" = 7 }   # Biblioteca Sanita (organization)

function Section($title) {
    Write-Host ""
    Write-Host "===== $title =====" -ForegroundColor Cyan
}

# --- 1. GET profilo pubblico ---
Section "GET /api/users/1 (profilo pubblico Chiara)"
$r = Invoke-RestMethod -Uri "$BASE/api/users/1" -Method Get
Write-Host "  displayName: $($r.displayName)" -ForegroundColor Green
Write-Host "  city:        $($r.city)"
Write-Host "  accountType: $($r.accountType)"
Write-Host "  counts: books=$($r.counts.books) followers=$($r.counts.followers) following=$($r.counts.following) reviews=$($r.counts.reviewsReceived)"
Write-Host "  avgRating:   $($r.averageRating)"
Write-Host "  isFollowing: $($r.isFollowing)  (atteso false: no auth)"

# --- 2. GET profilo pubblico con auth (deve avere isFollowing) ---
Section "GET /api/users/1 con auth (user 2 NON segue user 1)"
$r = Invoke-RestMethod -Uri "$BASE/api/users/1" -Method Get -Headers $USER2
Write-Host "  isFollowing: $($r.isFollowing)" -ForegroundColor Green

# --- 3. GET /api/users/me ---
Section "GET /api/users/me come user 1"
$me = Invoke-RestMethod -Uri "$BASE/api/users/me" -Method Get -Headers $USER1
Write-Host "  email:       $($me.email)" -ForegroundColor Green
Write-Host "  role:        $($me.role)"
Write-Host "  preferences: theme=$($me.preferences.theme) viewMode=$($me.preferences.viewMode)"

# --- 4. GET /api/users/me senza auth (deve essere 401) ---
Section "GET /api/users/me senza auth (atteso 401)"
try {
    Invoke-RestMethod -Uri "$BASE/api/users/me" -Method Get | Out-Null
    Write-Host "  [FAIL] Non ha dato errore!" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  [OK] HTTP $code (atteso 401)" -ForegroundColor Green
}

# --- 5. PATCH /api/users/me (aggiorna bio) ---
Section "PATCH /api/users/me (aggiorna bio user 1)"
$body = @{ bio = "Bio aggiornata dal test API a $(Get-Date -Format 'HH:mm:ss')" } | ConvertTo-Json
$patched = Invoke-RestMethod -Uri "$BASE/api/users/me" -Method Patch -Headers $USER1 -ContentType "application/json" -Body $body
Write-Host "  Nuova bio: $($patched.bio)" -ForegroundColor Green

# --- 6. PATCH organization (su account person, deve essere 400) ---
Section "PATCH /api/users/me con campo 'organization' su account person (atteso 400)"
$badBody = @{ organization = @{ legalName = "Test SRL" } } | ConvertTo-Json -Depth 5
try {
    Invoke-RestMethod -Uri "$BASE/api/users/me" -Method Patch -Headers $USER1 -ContentType "application/json" -Body $badBody | Out-Null
    Write-Host "  [FAIL] Non ha dato errore!" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  [OK] HTTP $code (atteso 400)" -ForegroundColor Green
}

# --- 7. PATCH organization su account organization ---
Section "PATCH /api/users/me con organization su Biblioteca Sanita (id=7)"
$orgBody = @{
    organization = @{
        contactPerson = "Mariarosaria Carfora (test)"
        publicPhone   = "081 9999999"
    }
} | ConvertTo-Json -Depth 5
$orgUpdated = Invoke-RestMethod -Uri "$BASE/api/users/me" -Method Patch -Headers $ORG7 -ContentType "application/json" -Body $orgBody
Write-Host "  contactPerson: $($orgUpdated.organizationProfile.contactPerson)" -ForegroundColor Green
Write-Host "  publicPhone:   $($orgUpdated.organizationProfile.publicPhone)"

# --- 8. POST recensione: user 2 recensisce user 1 ---
Section "POST /api/users/1/reviews come user 2 (crea recensione)"
$reviewBody = @{
    rating = 5
    text   = "Libreria meravigliosa, ottime conversazioni sui classici italiani!"
} | ConvertTo-Json
$rev = Invoke-RestMethod -Uri "$BASE/api/users/1/reviews" -Method Post -Headers $USER2 -ContentType "application/json" -Body $reviewBody
Write-Host "  Recensione #$($rev.id) creata" -ForegroundColor Green
Write-Host "  Rating: $($rev.rating)/5"
Write-Host "  Reviewer: $($rev.reviewer.displayName)"

# --- 9. POST stessa recensione (deve aggiornare via upsert) ---
Section "POST /api/users/1/reviews come user 2 di nuovo (upsert, non duplicato)"
$updatedBody = @{
    rating = 4
    text   = "Aggiornato: 4 stelle dopo seconda visita"
} | ConvertTo-Json
$rev2 = Invoke-RestMethod -Uri "$BASE/api/users/1/reviews" -Method Post -Headers $USER2 -ContentType "application/json" -Body $updatedBody
Write-Host "  Stessa id #$($rev2.id) ? $($rev2.id -eq $rev.id) (atteso True)" -ForegroundColor Green
Write-Host "  Nuovo rating: $($rev2.rating)"

# --- 10. GET recensioni ricevute da user 1 ---
Section "GET /api/users/1/reviews"
$reviews = Invoke-RestMethod -Uri "$BASE/api/users/1/reviews" -Method Get
Write-Host "  Total: $($reviews.pagination.total)" -ForegroundColor Green
Write-Host "  averageRating: $($reviews.averageRating)"
$reviews.data | ForEach-Object {
    Write-Host "    [$($_.rating)*] $($_.reviewer.displayName): $($_.text)"
}

# --- 11. Self-review (deve essere 400) ---
Section "POST recensione su SE STESSO (atteso 400)"
try {
    Invoke-RestMethod -Uri "$BASE/api/users/1/reviews" -Method Post -Headers $USER1 -ContentType "application/json" -Body $reviewBody | Out-Null
    Write-Host "  [FAIL] Non ha dato errore!" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  [OK] HTTP $code (atteso 400)" -ForegroundColor Green
}

# --- 12. POST follow: user 2 segue user 1 ---
Section "POST /api/users/1/follow come user 2 (follow)"
Invoke-RestMethod -Uri "$BASE/api/users/1/follow" -Method Post -Headers $USER2 | Out-Null
Write-Host "  [OK] Follow eseguito" -ForegroundColor Green

# --- 13. POST follow di nuovo (idempotente, niente errore) ---
Section "POST /api/users/1/follow di nuovo (idempotente)"
Invoke-RestMethod -Uri "$BASE/api/users/1/follow" -Method Post -Headers $USER2 | Out-Null
Write-Host "  [OK] Idempotente" -ForegroundColor Green

# --- 14. GET profilo: ora isFollowing deve essere true ---
Section "GET /api/users/1 con auth user 2 (isFollowing deve essere true)"
$r = Invoke-RestMethod -Uri "$BASE/api/users/1" -Method Get -Headers $USER2
Write-Host "  isFollowing: $($r.isFollowing)  (atteso True)" -ForegroundColor Green
Write-Host "  followers count: $($r.counts.followers)"

# --- 15. GET followers ---
Section "GET /api/users/1/followers"
$followers = Invoke-RestMethod -Uri "$BASE/api/users/1/followers" -Method Get
Write-Host "  Total: $($followers.pagination.total)" -ForegroundColor Green
$followers.data | ForEach-Object {
    Write-Host "    @$($_.username) - $($_.displayName)"
}

# --- 16. GET following ---
Section "GET /api/users/2/following"
$following = Invoke-RestMethod -Uri "$BASE/api/users/2/following" -Method Get
Write-Host "  Total: $($following.pagination.total)" -ForegroundColor Green
$following.data | ForEach-Object {
    Write-Host "    @$($_.username) - $($_.displayName)"
}

# --- 17. Self-follow (deve essere 400) ---
Section "POST /api/users/1/follow come user 1 (self-follow, atteso 400)"
try {
    Invoke-RestMethod -Uri "$BASE/api/users/1/follow" -Method Post -Headers $USER1 | Out-Null
    Write-Host "  [FAIL] Non ha dato errore!" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  [OK] HTTP $code (atteso 400)" -ForegroundColor Green
}

# --- 18. POST like su libro 1 ---
Section "POST /api/books/1/like come user 2"
$like = Invoke-RestMethod -Uri "$BASE/api/books/1/like" -Method Post -Headers $USER2
Write-Host "  $($like | ConvertTo-Json -Compress)" -ForegroundColor Green

# --- 19. DELETE like ---
Section "DELETE /api/books/1/like come user 2"
$unlike = Invoke-RestMethod -Uri "$BASE/api/books/1/like" -Method Delete -Headers $USER2
Write-Host "  $($unlike | ConvertTo-Json -Compress)" -ForegroundColor Green

# --- 20. Cleanup: DELETE recensione + unfollow ---
Section "Cleanup: DELETE recensione + unfollow"
Invoke-RestMethod -Uri "$BASE/api/users/1/reviews/me" -Method Delete -Headers $USER2 | Out-Null
Invoke-RestMethod -Uri "$BASE/api/users/1/follow" -Method Delete -Headers $USER2 | Out-Null
Write-Host "  [OK] Recensione + follow rimossi" -ForegroundColor Green

Write-Host ""
Write-Host "===== TUTTI I TEST USERS+REVIEWS+FOLLOWS+LIKES COMPLETATI =====" -ForegroundColor Cyan
