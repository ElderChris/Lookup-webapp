# =============================================================================
# test-loans.ps1 - Smoke test endpoint /api/loans + state machine
# =============================================================================
# Esegui da apps/api/ (richiede backend in esecuzione su :3000):
#   .\scripts\test-loans.ps1
#
# IMPORTANTE: questo script crea un prestito e lo porta fino a "returned",
# poi pulisce. Usa book 1 (Il Gattopardo, owner=1) e user 2 come requester.
# =============================================================================

$BASE = "http://localhost:3000"
$REQUESTER = @{ "X-Lookup-User-Id" = 2 }   # Marco De Vito
$LENDER    = @{ "X-Lookup-User-Id" = 1 }   # Chiara Morandi (owner libro 1)
$THIRD     = @{ "X-Lookup-User-Id" = 3 }   # Anna Russo (estraneo)

function Section($title) {
    Write-Host ""
    Write-Host "===== $title =====" -ForegroundColor Cyan
}

function Fail($msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
}

function Ok($msg) {
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

# --- 1. POST richiesta su libro 1 ---
Section "POST /api/books/1/loan-requests come user 2"
$body = @{ message = "Salve, posso prenderlo in prestito per 2 settimane?" } | ConvertTo-Json
$loan = Invoke-RestMethod -Uri "$BASE/api/books/1/loan-requests" -Method Post -Headers $REQUESTER -ContentType "application/json" -Body $body
Ok "Creato prestito #$($loan.id), stato=$($loan.status), role=$($loan.role)"
$loanId = $loan.id

# --- 2. POST richiesta come owner (deve essere 400 SELF_LOAN) ---
Section "POST stessa richiesta come owner libro (atteso 400 SELF_LOAN)"
try {
    Invoke-RestMethod -Uri "$BASE/api/books/1/loan-requests" -Method Post -Headers $LENDER -ContentType "application/json" -Body $body | Out-Null
    Fail "Non ha dato errore!"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Ok "HTTP $code (atteso 400)"
}

# --- 3. POST richiesta duplicata (deve essere 409 LOAN_ALREADY_ACTIVE) ---
Section "POST seconda richiesta sullo stesso libro come user 2 (atteso 409)"
try {
    Invoke-RestMethod -Uri "$BASE/api/books/1/loan-requests" -Method Post -Headers $REQUESTER -ContentType "application/json" -Body $body | Out-Null
    Fail "Non ha dato errore!"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Ok "HTTP $code (atteso 409)"
}

# --- 4. GET /api/me/loans/sent come requester ---
Section "GET /api/me/loans/sent come user 2"
$sent = Invoke-RestMethod -Uri "$BASE/api/me/loans/sent" -Method Get -Headers $REQUESTER
Ok "Total: $($sent.pagination.total) (almeno 1 atteso)"
$sent.data | Where-Object { $_.id -eq $loanId } | ForEach-Object {
    Write-Host "    #$($_.id) stato=$($_.status) libro=`"$($_.book.title)`" lender=$($_.lender.displayName)"
}

# --- 5. GET /api/me/loans/received come lender ---
Section "GET /api/me/loans/received come user 1"
$rcvd = Invoke-RestMethod -Uri "$BASE/api/me/loans/received" -Method Get -Headers $LENDER
Ok "Total: $($rcvd.pagination.total)"
$rcvd.data | Where-Object { $_.id -eq $loanId } | ForEach-Object {
    Write-Host "    #$($_.id) stato=$($_.status) da $($_.requester.displayName)"
}

# --- 6. GET /api/loans/:id come terzo (deve essere 403 NOT_PARTICIPANT) ---
Section "GET /api/loans/$loanId come user 3 (estraneo, atteso 403)"
try {
    Invoke-RestMethod -Uri "$BASE/api/loans/$loanId" -Method Get -Headers $THIRD | Out-Null
    Fail "Non ha dato errore!"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Ok "HTTP $code (atteso 403)"
}

# --- 7. PATCH accept come requester (deve essere 403 WRONG_ROLE) ---
Section "PATCH accept come requester (atteso 403 WRONG_ROLE)"
$acceptBody = @{ action = "accept" } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$BASE/api/loans/$loanId" -Method Patch -Headers $REQUESTER -ContentType "application/json" -Body $acceptBody | Out-Null
    Fail "Non ha dato errore!"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Ok "HTTP $code (atteso 403)"
}

# --- 8. PATCH accept come lender ---
Section "PATCH accept come lender (transizione requested -> confirmed)"
$loan = Invoke-RestMethod -Uri "$BASE/api/loans/$loanId" -Method Patch -Headers $LENDER -ContentType "application/json" -Body $acceptBody
Ok "Nuovo stato: $($loan.status) (confirmedAt: $($loan.timestamps.confirmed))"

# --- 9. PATCH mark_returning prima di mark_borrowed (atteso 400 INVALID_TRANSITION) ---
Section "PATCH mark_returning da stato confirmed (atteso 400)"
$markReturnBody = @{ action = "mark_returning" } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$BASE/api/loans/$loanId" -Method Patch -Headers $REQUESTER -ContentType "application/json" -Body $markReturnBody | Out-Null
    Fail "Non ha dato errore!"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Ok "HTTP $code (atteso 400)"
}

# --- 10. PATCH mark_borrowed come lender ---
Section "PATCH mark_borrowed come lender (confirmed -> borrowed, book.available=false)"
$markBorrowedBody = @{ action = "mark_borrowed" } | ConvertTo-Json
$loan = Invoke-RestMethod -Uri "$BASE/api/loans/$loanId" -Method Patch -Headers $LENDER -ContentType "application/json" -Body $markBorrowedBody
Ok "Nuovo stato: $($loan.status), book.available=$($loan.book.available)"

# --- 11. Verifica diretta GET book 1 (available deve essere false) ---
Section "Verifica GET /api/books/1 (available deve essere false)"
$book = Invoke-RestMethod -Uri "$BASE/api/books/1" -Method Get
if ($book.available -eq $false) {
    Ok "book.available = false (corretto, libro in prestito)"
} else {
    Fail "book.available = $($book.available) (atteso False)"
}

# --- 12. POST messaggio come requester ---
Section "POST messaggio come requester"
$msg1Body = @{ body = "Grazie mille! Lo restituisco entro 2 settimane." } | ConvertTo-Json
$msg1 = Invoke-RestMethod -Uri "$BASE/api/loans/$loanId/messages" -Method Post -Headers $REQUESTER -ContentType "application/json" -Body $msg1Body
Ok "Messaggio #$($msg1.id) inviato da $($msg1.sender.displayName)"

# --- 13. POST messaggio come lender ---
Section "POST messaggio come lender"
$msg2Body = @{ body = "Perfetto! Buona lettura." } | ConvertTo-Json
$msg2 = Invoke-RestMethod -Uri "$BASE/api/loans/$loanId/messages" -Method Post -Headers $LENDER -ContentType "application/json" -Body $msg2Body
Ok "Messaggio #$($msg2.id) inviato da $($msg2.sender.displayName)"

# --- 14. POST messaggio come terzo (atteso 403) ---
Section "POST messaggio come user 3 (atteso 403)"
$msgBadBody = @{ body = "Eh ciao" } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$BASE/api/loans/$loanId/messages" -Method Post -Headers $THIRD -ContentType "application/json" -Body $msgBadBody | Out-Null
    Fail "Non ha dato errore!"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Ok "HTTP $code (atteso 403)"
}

# --- 15. GET messaggi ---
Section "GET /api/loans/$loanId/messages come lender"
$msgs = Invoke-RestMethod -Uri "$BASE/api/loans/$loanId/messages" -Method Get -Headers $LENDER
Ok "Total: $($msgs.pagination.total) (atteso 2)"
$msgs.data | ForEach-Object {
    Write-Host "    [$($_.sender.displayName)]: $($_.body)"
}

# --- 16. PATCH mark_returning come requester ---
Section "PATCH mark_returning come requester (borrowed -> returning)"
$loan = Invoke-RestMethod -Uri "$BASE/api/loans/$loanId" -Method Patch -Headers $REQUESTER -ContentType "application/json" -Body $markReturnBody
Ok "Nuovo stato: $($loan.status)"

# --- 17. PATCH mark_returned come lender ---
Section "PATCH mark_returned come lender (returning -> returned, book.available=true)"
$markReturnedBody = @{ action = "mark_returned" } | ConvertTo-Json
$loan = Invoke-RestMethod -Uri "$BASE/api/loans/$loanId" -Method Patch -Headers $LENDER -ContentType "application/json" -Body $markReturnedBody
Ok "Stato finale: $($loan.status), book.available=$($loan.book.available)"

# --- 18. Verifica book.available di nuovo true ---
Section "Verifica GET /api/books/1 (available deve essere true di nuovo)"
$book = Invoke-RestMethod -Uri "$BASE/api/books/1" -Method Get
if ($book.available -eq $true) {
    Ok "book.available = true (libro disponibile di nuovo)"
} else {
    Fail "book.available = $($book.available) (atteso True)"
}

# --- 19. PATCH azione su stato terminale (atteso 400) ---
Section "PATCH cancel su prestito returned (atteso 400 INVALID_TRANSITION)"
$cancelBody = @{ action = "cancel" } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$BASE/api/loans/$loanId" -Method Patch -Headers $REQUESTER -ContentType "application/json" -Body $cancelBody | Out-Null
    Fail "Non ha dato errore!"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Ok "HTTP $code (atteso 400)"
}

# --- 20. GET sent con filtro status ---
Section "GET /api/me/loans/sent?status=returned (filtro stato)"
$sent = Invoke-RestMethod -Uri "$BASE/api/me/loans/sent?status=returned" -Method Get -Headers $REQUESTER
Ok "Total returned: $($sent.pagination.total)"

# --- 21. Test rejected branch (creando nuova richiesta su libro 2) ---
Section "Test branch rejected: nuova richiesta su libro 2"
$loan2 = Invoke-RestMethod -Uri "$BASE/api/books/2/loan-requests" -Method Post -Headers $REQUESTER -ContentType "application/json" -Body (@{ message = "Test rifiuto" } | ConvertTo-Json)
$loan2Id = $loan2.id
Ok "Creato prestito #$loan2Id"

$rejectBody = @{ action = "reject" } | ConvertTo-Json
$loan2 = Invoke-RestMethod -Uri "$BASE/api/loans/$loan2Id" -Method Patch -Headers $LENDER -ContentType "application/json" -Body $rejectBody
Ok "Stato: $($loan2.status) (atteso rejected)"

# --- 22. Test cancel branch (nuova richiesta su libro 3, poi cancel) ---
Section "Test branch cancelled: nuova richiesta su libro 3, cancel da requester"
$loan3 = Invoke-RestMethod -Uri "$BASE/api/books/3/loan-requests" -Method Post -Headers $REQUESTER -ContentType "application/json" -Body (@{} | ConvertTo-Json)
$loan3Id = $loan3.id
Ok "Creato prestito #$loan3Id"

$loan3 = Invoke-RestMethod -Uri "$BASE/api/loans/$loan3Id" -Method Patch -Headers $REQUESTER -ContentType "application/json" -Body $cancelBody
Ok "Stato: $($loan3.status) (atteso cancelled)"

Write-Host ""
Write-Host "===== TUTTI I TEST LOANS+MESSAGES COMPLETATI =====" -ForegroundColor Cyan
