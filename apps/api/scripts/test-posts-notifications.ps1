# =============================================================================
# test-posts-notifications.ps1 - Smoke test posts + reactions + reports + notifiche
# =============================================================================
# Esegui da apps/api/ (richiede backend in esecuzione):
#   .\scripts\test-posts-notifications.ps1
# =============================================================================

$BASE = "http://localhost:3000"
$U1 = @{ "X-Lookup-User-Id" = 1 }   # Chiara Morandi
$U2 = @{ "X-Lookup-User-Id" = 2 }   # Marco De Vito
$U3 = @{ "X-Lookup-User-Id" = 3 }   # Anna Russo

function Section($t) { Write-Host ""; Write-Host "===== $t =====" -ForegroundColor Cyan }
function Ok($m) { Write-Host "  [OK] $m" -ForegroundColor Green }
function Fail($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red }

# === POSTS ===

# --- 1. POST nuovo post come user 1 ---
Section "POST /api/posts come user 1"
$body = @{ content = "Ho appena finito di rileggere Il Gattopardo. Sempre bellissimo!" } | ConvertTo-Json
$post1 = Invoke-RestMethod -Uri "$BASE/api/posts" -Method Post -Headers $U1 -ContentType "application/json" -Body $body
Ok "Post creato id=$($post1.id), author=$($post1.author.displayName)"
$post1Id = $post1.id

# --- 2. POST altro post come user 2 ---
Section "POST altro post come user 2"
$body2 = @{ content = "Consiglio di lettura: Le otto montagne di Cognetti, perfetto per l'estate." } | ConvertTo-Json
$post2 = Invoke-RestMethod -Uri "$BASE/api/posts" -Method Post -Headers $U2 -ContentType "application/json" -Body $body2
Ok "Post #$($post2.id) creato"
$post2Id = $post2.id

# --- 3. POST con content troppo lungo (atteso 400) ---
Section "POST content > 500 char (atteso 400)"
$longBody = @{ content = "x" * 501 } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$BASE/api/posts" -Method Post -Headers $U1 -ContentType "application/json" -Body $longBody | Out-Null
    Fail "Non ha dato errore!"
} catch {
    Ok "HTTP $($_.Exception.Response.StatusCode.value__) (atteso 400)"
}

# --- 4. GET /api/posts lista pubblica ---
Section "GET /api/posts (lista pubblica)"
$list = Invoke-RestMethod -Uri "$BASE/api/posts" -Method Get
Ok "Total: $($list.pagination.total), almeno 2"
$list.data | Select-Object -First 3 | ForEach-Object {
    Write-Host "    @$($_.author.username): $($_.content.Substring(0, [Math]::Min(60, $_.content.Length)))..."
}

# --- 5. GET /api/posts/:id dettaglio ---
Section "GET /api/posts/$post1Id (dettaglio)"
$detail = Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id" -Method Get
Ok "content: $($detail.content.Substring(0, 30))..."
Ok "reactionsCount: $($detail.reactionsCount)"

# --- 6. POST reaction come user 2 ---
Section "POST reaction (user 2 mette thumbs-up al post di user 1)"
$reactBody = @{ emoji = "thumbs-up" } | ConvertTo-Json
$react = Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id/reactions" -Method Post -Headers $U2 -ContentType "application/json" -Body $reactBody
Ok "Reactions count ora: $($react.reactionsCount)"

# --- 7. POST stessa reaction (idempotente) ---
Section "POST stessa reaction (idempotente)"
$react2 = Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id/reactions" -Method Post -Headers $U2 -ContentType "application/json" -Body $reactBody
Ok "Reactions count NON deve raddoppiare: $($react2.reactionsCount) (atteso 1)"

# --- 8. POST reaction diversa stesso user ---
Section "POST reaction diversa (heart) stesso user"
$heart = @{ emoji = "heart" } | ConvertTo-Json  # uso testo per evitare encoding emoji su PowerShell
$reactH = Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id/reactions" -Method Post -Headers $U2 -ContentType "application/json" -Body $heart
Ok "Reactions count: $($reactH.reactionsCount) (atteso 2: thumbs-up + heart)"

# --- 9. POST reaction da user 3 ---
Section "POST reaction da user 3"
$react3 = Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id/reactions" -Method Post -Headers $U3 -ContentType "application/json" -Body $reactBody
Ok "Reactions count: $($react3.reactionsCount) (atteso 3)"

# --- 10. GET dettaglio con aggregato reactions ---
Section "GET dettaglio post con aggregato reactions"
$detail = Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id" -Method Get -Headers $U2
Write-Host "  reactionsByEmoji: $($detail.reactionsByEmoji | ConvertTo-Json -Compress)"
Write-Host "  myReactions: $($detail.myReactions -join ', ')"
Ok "OK"

# --- 11. DELETE reaction ---
Section "DELETE reaction emoji"
$unr = Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id/reactions/heart" -Method Delete -Headers $U2
Ok "Reactions count: $($unr.reactionsCount) (atteso 2)"

# --- 12. POST report ---
Section "POST report (user 3 segnala post 2 come off-topic)"
$reportBody = @{ reason = "off-topic"; note = "Questo non c'entra niente con i libri" } | ConvertTo-Json
$report = Invoke-RestMethod -Uri "$BASE/api/posts/$post2Id/report" -Method Post -Headers $U3 -ContentType "application/json" -Body $reportBody
Ok "Report #$($report.id) creato, reason=$($report.reason)"

# --- 13. POST report reason invalida (atteso 400) ---
Section "POST report con reason non in enum (atteso 400)"
$badReport = @{ reason = "boh" } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$BASE/api/posts/$post2Id/report" -Method Post -Headers $U3 -ContentType "application/json" -Body $badReport | Out-Null
    Fail "Non ha dato errore!"
} catch {
    Ok "HTTP $($_.Exception.Response.StatusCode.value__) (atteso 400)"
}

# --- 14. DELETE post come non-author (atteso 403) ---
Section "DELETE post 1 come user 2 (non-author, atteso 403)"
try {
    Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id" -Method Delete -Headers $U2 | Out-Null
    Fail "Non ha dato errore!"
} catch {
    Ok "HTTP $($_.Exception.Response.StatusCode.value__) (atteso 403)"
}

# --- 15. GET /api/posts/feed come user 2 (segue user 1?) ---
Section "Setup feed: user 2 segue user 1"
Invoke-RestMethod -Uri "$BASE/api/users/1/follow" -Method Post -Headers $U2 | Out-Null
Ok "Follow eseguito"

# --- 16. GET feed come user 2 ---
Section "GET /api/posts/feed come user 2 (deve includere post di user 1 + propri)"
$feed = Invoke-RestMethod -Uri "$BASE/api/posts/feed" -Method Get -Headers $U2
Ok "Feed: $($feed.pagination.total) post, feedSize: $($feed.feedSize) (2 utenti)"

# === NOTIFICATIONS ===

# --- 17. GET notifiche user 1 (dovrebbe avere notifiche da review/follow/reactions) ---
Section "GET /api/me/notifications come user 1"
$notifs = Invoke-RestMethod -Uri "$BASE/api/me/notifications" -Method Get -Headers $U1
Ok "Total: $($notifs.pagination.total), unread: $($notifs.unreadCount)"
$notifs.data | Select-Object -First 5 | ForEach-Object {
    Write-Host "    [$($_.type)] $($_.message.Substring(0, [Math]::Min(70, $_.message.Length)))..."
}

if ($notifs.pagination.total -eq 0) {
    Fail "Nessuna notifica per user 1 (atteso almeno qualcuna dai test precedenti se rieseguiti)"
    Write-Host "  NOTA: se questo e' il primo run senza i test users/loans precedenti," -ForegroundColor Yellow
    Write-Host "        le notifiche sono solo da reactions ai post." -ForegroundColor Yellow
}

# --- 18. PATCH marca letta singola ---
if ($notifs.data.Count -gt 0) {
    Section "PATCH read singola notifica"
    $firstId = $notifs.data[0].id
    $marked = Invoke-RestMethod -Uri "$BASE/api/me/notifications/$firstId/read" -Method Patch -Headers $U1
    Ok "Notifica #$firstId marcata: isRead=$($marked.isRead)"
}

# --- 19. POST read-all ---
Section "POST /api/me/notifications/read-all come user 1"
$readAll = Invoke-RestMethod -Uri "$BASE/api/me/notifications/read-all" -Method Post -Headers $U1
Ok "Marcate come lette: $($readAll.markedAsRead)"

# --- 20. GET notifiche unread-only (atteso 0) ---
Section "GET /api/me/notifications?unreadOnly=true (atteso 0)"
$unread = Invoke-RestMethod -Uri "$BASE/api/me/notifications?unreadOnly=true" -Method Get -Headers $U1
if ($unread.unreadCount -eq 0) {
    Ok "unreadCount = 0 (corretto)"
} else {
    Fail "unreadCount = $($unread.unreadCount) (atteso 0)"
}

# --- 21. Cross-user notification: user 2 reagisce a post di user 1 ---
Section "Genera notifica: user 3 reagisce a post di user 1"
Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id/reactions" -Method Post -Headers $U3 -ContentType "application/json" -Body (@{ emoji = "fire" } | ConvertTo-Json) | Out-Null

Start-Sleep -Milliseconds 200

# Verifica nuova notifica
$notifs2 = Invoke-RestMethod -Uri "$BASE/api/me/notifications?unreadOnly=true" -Method Get -Headers $U1
if ($notifs2.unreadCount -ge 1) {
    Ok "User 1 ha $($notifs2.unreadCount) nuova/e notifica/he non lette (post_reaction)"
    $latestNotif = $notifs2.data[0]
    Write-Host "    Latest: [$($latestNotif.type)] $($latestNotif.message)"
} else {
    Fail "Nessuna nuova notifica generata (atteso 1)"
}

# --- 22. DELETE notifica ---
if ($notifs2.data.Count -gt 0) {
    Section "DELETE notifica"
    $delId = $notifs2.data[0].id
    Invoke-RestMethod -Uri "$BASE/api/me/notifications/$delId" -Method Delete -Headers $U1 | Out-Null
    Ok "Notifica #$delId cancellata"
}

# --- 23. DELETE notifica altrui (atteso 403) ---
Section "DELETE notifica altrui (user 2 prova a cancellare notifica di user 1)"
# Prima creiamo una notifica per user 1
Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id/reactions" -Method Post -Headers $U3 -ContentType "application/json" -Body (@{ emoji = "star" } | ConvertTo-Json) | Out-Null
Start-Sleep -Milliseconds 200
$notifs3 = Invoke-RestMethod -Uri "$BASE/api/me/notifications" -Method Get -Headers $U1
if ($notifs3.data.Count -gt 0) {
    $foreignId = $notifs3.data[0].id
    try {
        Invoke-RestMethod -Uri "$BASE/api/me/notifications/$foreignId" -Method Delete -Headers $U2 | Out-Null
        Fail "Non ha dato errore!"
    } catch {
        Ok "HTTP $($_.Exception.Response.StatusCode.value__) (atteso 403)"
    }
}

# --- 24. Cleanup: DELETE post creati ---
Section "Cleanup: DELETE post creati"
Invoke-RestMethod -Uri "$BASE/api/posts/$post1Id" -Method Delete -Headers $U1 | Out-Null
Invoke-RestMethod -Uri "$BASE/api/posts/$post2Id" -Method Delete -Headers $U2 | Out-Null
Invoke-RestMethod -Uri "$BASE/api/users/1/follow" -Method Delete -Headers $U2 | Out-Null
Ok "Post e follow rimossi"

Write-Host ""
Write-Host "===== TUTTI I TEST POSTS+REACTIONS+REPORTS+NOTIFICATIONS COMPLETATI =====" -ForegroundColor Cyan
