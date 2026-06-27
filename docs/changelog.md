# Changelog — Lookup

Tutte le modifiche rilevanti al prototipo sono documentate qui.
Il formato si ispira a [Keep a Changelog](https://keepachangelog.com/it/);
il progetto adotta un versionamento incrementale `0.x` (prototipo didattico).

> **Legenda** — ✨ Nuovo · 🔧 Modificato · 🐛 Corretto · 🗄️ Database · 📚 Documentazione · ⚠️ Breaking

---

## [3.0.0-alpha.1-monorepo] — Fase 1a: setup monorepo + DB containers

**Refactor strutturale** che prepara il terreno per il backend.
Nessuna nuova feature utente; il frontend continua a funzionare
identico, sempre localStorage-based.

### Fase 1a — Monorepo + Postgres + Redis

- 📦 **Monorepo npm workspaces**: tutto il frontend spostato in
  `apps/web/` (workspace `@lookup/web`). Creato scaffold `apps/api/`
  (workspace `@lookup/api`) — solo struttura cartelle e `package.json`
  con stub scripts, il runtime arriva in 1c.
- 🐘 **PostgreSQL 16 + PostGIS 3.4** containerizzato. Volume nominato
  persistente `lookup-postgres-data`. Init script
  `infra/postgres/init.sql` abilita le extension `postgis`, `pg_trgm`,
  `citext` al primo avvio. **Le tabelle vere arrivano via Prisma
  migration in Fase 1b** — qui il DB è vuoto.
- 🔴 **Redis 7** containerizzato con persistenza AOF. Volume
  `lookup-redis-data`. Servirà in 1c+ per session store (lucia-auth),
  rate limiting, queue future.
- 🛠️ **pgAdmin** sotto profilo `admin` (opt-in). Attivabile con
  `docker compose --profile admin up -d`, accessibile su
  `http://localhost:5050`.
- 🧰 **Nuovi comandi orchestratori**:
  - `make db-up` / `.\dev.ps1 db-up` — avvia solo postgres + redis
  - `make db-shell` / `.\dev.ps1 db-shell` — apre psql nel container
  - `make db-reset` / `.\dev.ps1 db-reset` — wipe + ricrea DB pulito
  - `make db-logs` / `.\dev.ps1 db-logs` — segue log postgres
  - npm scripts root: `db:up`, `db:down`, `db:shell`, `db:reset`
- 📁 **`tests/` → `tests-e2e/`** in root (non sotto `apps/web/`). In
  Fase 1+ i test E2E attraverseranno frontend↔backend, quindi non
  "appartengono" a un singolo workspace.
- 📁 **File SQL legacy** spostati da `apps/web/sql/` a
  `apps/api/prisma/_reference/`. Restano come riferimento storico per
  scrivere lo schema Prisma in 1b. Il README in `_reference/`
  documenta che non vengono mai eseguiti.
- 🔧 **Path aggiornati**: `playwright.config.js` ora ha
  `cwd: 'apps/web'`, `eslint.config.js` cerca in `apps/web/js/**`
  e `tests-e2e/**`, `docker-compose.yml` monta dai nuovi path,
  `.gitignore` / `.dockerignore` / `.prettierignore` includono
  `apps/*/node_modules/`.
- ✅ **24/24 smoke test verdi** dopo il refactor (test E2E che girano
  da `tests-e2e/` puntando al server da `apps/web/`).

### Cosa funziona alla fine di Fase 1a

- `docker compose up` lancia 3 servizi: nginx (web), postgres (vuoto), redis
- Postgres ascolta su `localhost:5432`, ispezionabile via `psql` o pgAdmin
- Frontend continua a funzionare al 100% identico, sempre localStorage-based
- Test Playwright girano dal monorepo con `npm test` da root

### Cosa NON funziona ancora (atteso)

- Nessun endpoint API risponde (`api` service commentato in docker-compose)
- Nessuna tabella in Postgres (lo schema arriva con Prisma in 1b)
- Frontend non parla con backend, continua a leggere/scrivere localStorage

---

## [3.0.0-alpha.0] — Chiusura prototipo, baseline per Alpha

**Major bump** che marca l'inizio della transizione del prototipo
verso una release **Alpha closed** self-hostable. Niente nuove
feature utente; questa è una pulizia strutturale, di modularità
del codice, di documentazione, e di branding.

### Fase 0e — Rinominamento prodotto: "Libreria Diffusa" → "Lookup"

- ⚠️ **Nuovo nome del prodotto: Lookup**. Doppio significato in linea
  con il manifesto valoriale del prodotto: "cercare/consultare"
  (un libro, un'informazione) **e** "guardare in alto" (alzare gli
  occhi dal telefono, dal proprio recinto, verso il quartiere).
  Stile imperativo e mobile-first, in linea con il target giovane
  e i cenni social del prodotto.
- 🔧 **128 sostituzioni in 36 file**: tutti i riferimenti al prodotto
  ("Libreria Diffusa", "libreria-diffusa", "libreria_diffusa")
  sostituiti con "Lookup" / "lookup". Audit chirurgico: zero
  contaminazione delle entità sample (i nomi delle librerie
  fittizie tipo "Libreria Indipendente Spaccanapoli", "Biblioteca
  di Comunità Rione Sanità", "Centro Culturale Mezzogiorno"
  restano invariati perché sono *dati within the product*, non
  il nome del prodotto stesso).
- 🔧 **Slug tecnici**: `package.json` (`"name": "lookup"`),
  container Docker (`lookup-web`, e per il futuro `lookup-postgres`,
  `lookup-redis`, ecc.), nome DB `lookup`, cartella repo `lookup/`.
- 📚 **Documentazione totalmente rebrand**ata: README, changelog,
  alpha_roadmap, architecture, rapporto tecnico, privacy.html,
  terms.html, tutti gli HTML, tutti i commenti nei moduli JS.
- ✅ **43+ smoke test verdi** dopo il rebrand. Nessuna regressione.
- 📚 **URL produzione**: non assegnato per ora. Il prodotto verrà
  prima testato dal cliente sulla sua macchina via `docker compose up`,
  in linea con il vincolo self-host. Un dominio definitivo verrà
  scelto più avanti, dopo la validazione Alpha.

### Fase 0a — Pulizia iniziale

- ⚠️ **`auth-toggle` rimosso** da tutte le 15 pagine HTML + JS associato.
  Era un bottone DEV ("VISITA AUTENTICATA / VISITA ANONIMA") che
  permetteva di simulare lo stato di autenticazione senza login.
  Inaccettabile in Alpha — apriva un buco di sicurezza enorme. La
  funzione `UI.initAuthToggle()` è stata ridotta a mantenere solo
  il `data-authState` sul body per i selettori CSS `.auth-only` /
  `.guest-only`.
- 🔧 **5 hard-coded residui marcati con `TODO(alpha)`**: ogni
  occorrenza ha un commento grep-abile che spiega cosa va sostituito
  e con che pattern.
- 📚 Documentazione strategica nuova: `docs/alpha_roadmap.md`
  (piano in 6 fasi, 3-4 mesi full-time / 6-8 part-time),
  `docs/architecture.md` (stack target con vincolo self-host esplicito).
- 🔧 **Vincolo "zero dipendenze cloud per il test"** confermato dal
  cliente: l'intero sistema deve girare via `docker compose up` su
  una macchina qualsiasi (anche Raspberry Pi 4). Servizi cloud restano
  opzioni di deploy in produzione, mai requisiti.
- 📚 README aggiornato con sezione *"Stato del progetto"*.
- 📚 Privacy policy aggiornata con distinzione esplicita fra
  comportamento *(solo prototipo)* e *(Alpha)*.

### Fase 0b — Modularizzazione JavaScript

- ⚠️ **`app.js` (5594 righe) spezzato in 5 moduli ES**:
  - `data.js` (1065 righe): seed fixtures + costanti tassonomiche
  - `storage.js` (162 righe): wrapper localStorage + reseed logic
  - `api.js` (2621 righe): logica applicativa (business)
  - `ui.js` (1809 righe): rendering DOM + wiring eventi
  - `app.js` (63 righe): entry point + init + esposizione globali
- ⚠️ **Tag `<script>` nei 15 HTML aggiornati**: aggiunto
  `type="module"`. Rimosso `defer` esplicito da login.html (ridondante).
- 🔧 **`window.API/UI/Storage` esposti come globali** dal nuovo
  `app.js` entry: gli inline script delle pagine continuano a
  funzionare senza modifiche. Vedi §4.30.3 del rapporto tecnico.
- 📚 **CSS lasciato unificato** (52 sezioni numerate già esistenti)
- 📚 **Inline script HTML lasciati dove sono** (pagine auto-contenute,
  scope naturale per pagina, debug più chiaro). Decisioni motivate
  in §4.30.2 del rapporto tecnico.
- 📚 Rapporto tecnico §4.30: 5 sotto-sezioni che documentano la
  granularità scelta, cosa non è stato spezzato (e perché), il
  pattern di esposizione globale via `window`, le conseguenze
  tecniche del `type="module"`, e cosa cambierà in Fase 2.

### Fase 0c — Toolchain di sviluppo e CI

- ✨ **`package.json`** con script `npm test`, `npm run lint`,
  `npm run format`, `npm run check` (lint + format + test in
  un solo comando). Dev dependencies: Playwright, ESLint 9,
  Prettier 3, Husky, lint-staged.
- ✨ **`playwright.config.js`** con `webServer` integrato: i test
  avviano automaticamente `python3 no-cache-server.py 8765` e lo
  fermano al termine. Niente più "avvia server in un terminale, poi
  i test in un altro".
- ✨ **3 spec Playwright** in `tests/`:
  - `smoke.spec.js`: 15 pagine × 3 stati auth = 45 casi che
    verificano zero errori JS. Sostituisce gli smoke manuali.
  - `nav.spec.js`: invariants di consistenza nav (auth-toggle
    rimosso, icon-only, CTA solo guest, admin icon solo admin).
  - `api.spec.js`: contratti degli algoritmi business (featured
    books con diversity penalty, welcome messages gender-neutral,
    isBookRecent/isLibraryFresh, getPostsFromFollowed senza self).
- ✨ **`eslint.config.js`** con flat config moderna (ESLint 9):
  solo `eslint:recommended` + qualche regola sensata. Globals
  configurati per i moduli del progetto (API, UI, Storage…) e
  per le librerie CDN (Leaflet, Chart.js).
- ✨ **`.prettierrc.json`** con stile che riflette l'esistente:
  single quotes, semi, trailing comma, 2 spazi, max 100.
- ✨ **`.github/workflows/ci.yml`** che esegue lint + format check
  + Playwright tests su ogni push/PR verso main. Upload del
  report Playwright come artifact in caso di failure (14gg).
  **Niente deploy automatico** (vincolo self-host).
- ✨ **Pre-commit hook** via Husky + lint-staged: ESLint --fix +
  Prettier --write sui soli file modificati prima del commit.
  Bypassabile con `git commit --no-verify`.
- ✨ **`.gitignore`** completo: node_modules, test artifacts, env.
- 📚 README aggiornato con sezione *"Sviluppo"* completa: tabella
  dei comandi npm, setup iniziale, descrizione delle 3 spec test,
  funzionamento della CI. Rimossa la vecchia sezione *"Doppio click
  + 3 server statici"* (obsoleta dopo i moduli ES).

### Fase 0d — Docker compose dev

- ✨ **`docker-compose.yml`** completo con un servizio `web` attivo
  (nginx Alpine) per Fase 0d, e tutti i servizi futuri commentati come
  `TODO(fase1)`: postgres+postgis, redis, mailhog, api, pgadmin.
  Il file resta lo stesso per tutte le fasi successive — basta
  decommentare i blocchi.
- ✨ **`infra/nginx.conf`**: serve i file statici dal volume Docker,
  Cache-Control no-store (coerente con `no-cache-server.py`), headers
  di sicurezza base (X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy), healthcheck endpoint `/health`, MIME type esplicito
  per i moduli ES, placeholder commentati per il proxy `/api` (Fase 1)
  e per `/uploads` (Fase 4).
- ✨ **`.env.example`**: documenta `WEB_PORT` (Fase 0d) e tutte le
  variabili future (POSTGRES_*, REDIS_*, MAILHOG_*, SESSION_SECRET,
  SMTP_*, PGADMIN_*) commentate. Copy → `.env` → personalizza.
- ✨ **`Makefile`** con shortcuts per le operazioni comuni:
  - Docker: `make up`, `make up-d`, `make down`, `make logs`, `make ps`,
    `make restart`, `make clean`
  - Sviluppo: `make dev`, `make install`, `make test`, `make lint`,
    `make format`, `make check`
  - `make help` mostra la lista completa
- ✨ **`.dockerignore`**: riduce il build context (escludendo
  node_modules, test artifacts, .git, ZIP).
- 📚 README: nuova sezione *"Self-hosting (Docker)"* con prerequisiti,
  avvio, dettaglio del compose, modifica porta, stop/cleanup, tabella
  comparativa dei 3 modi di eseguire l'app (Python statico / Docker /
  npm test).
- 📚 README: sezione *"Come eseguire il prototipo"* aggiornata con
  Opzione 4 (Docker compose); struttura del repo aggiornata per
  riflettere tutti i nuovi file di Fase 0c+0d.

### Note operative per il cliente

Tre modi indipendenti di eseguire l'app, ognuno con il suo target:

1. **`python3 no-cache-server.py 8765`** — sviluppo locale veloce.
   Modifica un file in `js/` o `css/`, refresh browser, vedi modifica.
   Nessuna dipendenza esterna oltre Python 3.

2. **`docker compose up`** — demo cliente / deploy production-like.
   Tutto in container, configurazione persistente via `.env`. Pronto
   per essere esteso ai servizi futuri (postgres, redis, api...) senza
   modificare il file principale.

3. **`npm test`** — esecuzione test E2E in CI o locale. Avvia
   automaticamente il server Python, esegue Playwright contro tutte
   le 15 pagine, riporta i fallimenti.

### Fase 0 conclusa

Con il completamento di Fase 0a (cleanup), 0b (modularizzazione), 0c
(toolchain CI) e 0d (Docker compose), la **baseline `v3.0.0-alpha.0`
è stabile** e pronta per il taglio del tag Git. Niente più funzionalità
nuove fino a Fase 1 — il prossimo passo è costruire il backend Fastify
+ Postgres che renderà l'app multi-utente reale.

### Cosa non è ancora cambiato (verrà nelle prossime fasi)

- ⏳ Backend reale (Node + Fastify + Postgres) — Fase 1
- ⏳ Migrazione frontend → API — Fase 2
- ⏳ Auth bcrypt + email SMTP reali — Fase 3
- ⏳ Storage immagini su filesystem + Docker production — Fase 4
- ⏳ Privacy GDPR + monitoring (Sentry, Plausible) — Fase 5
- ⏳ Alpha closed con 20-50 inviti — Fase 6

Tutto il piano in `docs/alpha_roadmap.md`.

---

## [2.6.0] — Welcome neutri, libri-novità con aura, ridgeline editoriale, "Selezione" reale

**In sintesi:** la home autenticata diventa più viva — saluti
gender-neutral che ruotano a ogni login, libri "novità" enfatizzati
con aura animata e tag, librerie appena aperte segnalate con un badge.
La pagina statistiche guadagna un grande grafico ridgeline editoriale
("partitura visiva" dei top 10 utenti) e un popover di conferma al
click sull'utente per non interrompere il flow. La "Selezione della
settimana" passa da `top_books per views` a un vero algoritmo di
trend (Reddit Hot + HN, con quality multiplier e diversity penalty).

- ✨ **Algoritmo "Selezione della settimana"** (`API.getFeaturedBooks(4)`):
  ```
  trend_score = (views_7d × 1 + loans_7d × 3 + likes × 2)
                × quality_multiplier (1 ± 0.4 × (avg_rating-3)/2)
                ÷ √(days_since_added + 7)
  ```
  Con **diversity penalty** ×0.5 sui candidati di una categoria già
  presente 2 volte, per evitare la dominanza di un singolo genere.
  Fallback su `book.views` storiche se nessuna attività recente (caso
  app appena seedata). I prestiti pesano 3× perché sono il segnale più
  forte di interesse reale; views 1×; like 2×.
- ✨ **17 messaggi di benvenuto gender-neutral** (`API.WELCOME_MESSAGES`)
  che ruotano a ogni login. Niente più "Bentornata Francesco". Esempi:
  *"Ciao Chiara, buona lettura."*, *"È bello rivederti, Marco."*,
  *"La pagina ti aspettava, Anna."*, *"Quante storie da scoprire oggi,
  Luca."* La rotazione è deterministica via `welcome_index` su user,
  incrementato in `authenticate()` ad ogni login riuscito.
- ✨ **Tag "Novità" + aura animata** per i libri aggiunti da meno di
  14 giorni (`API.isBookRecent`), visibile nella sezione *"Novità da
  chi segui"* della home. L'aura usa un gradient `burgundy/gold/sage`
  blur 6px con shimmer keyframe da 4s. Il tag è una pill bordeaux
  con stella `✦ NOVITÀ` nell'angolo top-left.
- ✨ **Badge "✦ Appena aperta"** sulle nearby cards delle librerie
  fresche (`API.isLibraryFresh`, default 14 giorni dalla `joined`).
  Posizione in alto a destra sulla cover, paper/burgundy con bordo.
- 🔧 **Fix spacing card librerie senza recensioni**: la sezione stelle
  ora ha `min-height: 22px` con placeholder *"Nessuna recensione
  ancora"* in font-mono soft. Tutte le card mantengono lo stesso
  layout indipendentemente dalla presenza di rating.
- 🔧 **`getPostsFromFollowed` esclude i post propri**: in
  *"Aggiornamenti recenti"* l'utente vede solo i post degli **altri**
  utenti che segue. I propri post sono comunque visibili nella tab
  Post del proprio profilo.
- ✨ **Popover di conferma sui top-user-item** (stats page): cliccando
  un utente nella classifica appare un popover ancorato con
  *"Vuoi visitare la libreria di X?"* + bottoni *Annulla* / *Vai al
  profilo*. Il click esterno o Annulla chiudono il popover senza
  navigare. Non interrompe il flow di esplorazione delle statistiche.
- ✨ **Grafico ridgeline editoriale "Cronache dei più attivi"**:
  SVG custom (non Chart.js — Chart.js non ha ridgeline). 10 corsie
  orizzontali, ognuna è una "strofa visiva" dell'utente: linea
  cubic-bezier morbida che traccia l'attività settimanale (libri +
  prestiti + recensioni + messaggi) negli ultimi 26 settimane,
  riempita con area a `opacity: 0.18` e linea `stroke: 1.6`.
  Sovrapposizione `Joy Division-style` (overlap 22px), alternanza
  colori `bordeaux/gold/sage`. Etichetta nome a sinistra, totale
  attività a destra, asse mensile in basso. Hover su una riga fa
  desaturare le altre. **Niente library esterna**.
- ✨ **2 nuovi helper API**: `getFeaturedBooks(limit)`,
  `getUserActivityRidgeline(limit, weeks)`, `getWelcomeMessage(user)`,
  `isBookRecent(book, days)`, `isLibraryFresh(user, days)`.
- 🗄️ **Seed aggiornato**: 3 sample books con `daysAgo(1/3/8)` per
  dimostrare l'aura recente, user 10 (Centro Mezzogiorno) iscritto
  da 5 giorni per dimostrare badge "Appena aperta", `SAMPLE_FOLLOWS`
  esteso a `[7, 8, 3, 9, 10]` così Chiara vede i nuovi.
- 📚 Rapporto tecnico: nuova sezione §4.29.

---

## [2.5.0] — Nav a icone SVG, foto profilo personalizzata

**In sintesi:** la navigazione principale passa da bottoni testuali
a icone SVG minimali generate da Claude (Anthropic). Il link "Home"
viene assorbito dal logo a sinistra, il link "Profilo" dall'avatar
circolare. Gli utenti possono caricare e cambiare la propria foto
profilo direttamente dal profilo, con riadattamento automatico a
cerchio.

- ✨ **Nav principale con icone SVG inline**: tutte minimali, 24×24
  viewBox, stroke 1.8 px, currentColor, line-cap round. Coerenti
  come "tratto" — la stessa mano grafica. Le icone sono **generate
  da Claude (Anthropic)** specificamente per Lookup.
  - **Home**: eliminato. Il logo *"Lookup"* a sinistra
    funge da link a `index.html` (pattern standard di web app).
  - **Esplora**: mappa stilizzata (pannelli ripiegati) con lente di
    ingrandimento nell'angolo
  - **Statistiche**: 4 barre verticali su una baseline (bar chart)
  - **Prestiti**: fumetto chat con due righe di testo
  - **Profilo**: eliminato. L'avatar circolare dell'utente (già
    presente in nav) funge da accesso al profilo (pattern Twitter/
    Gmail/Slack).
  - **Admin**: scudo con segno di spunta dentro (visibile solo a
    `is_admin: true`, colore oro per distinguerlo dagli altri)
  - **Pubblica**: documento/libro con segno + dentro (stile call-to-
    action, sfondo bordeaux)
- 🔧 **Label responsive**: su desktop ≥1100px icona + label di testo
  ("Esplora", "Statistiche"…); sotto i 1100px solo icona, label
  visually-hidden ma accessibile via `aria-label` e `title`.
- ✨ **Foto profilo personalizzata**:
  - **Avatar cliccabile** nel profilo (`profile.html`): cerchio con
    contorno burgundy al hover/focus, overlay con icona "edit" al
    passaggio del mouse, role="button" + tabindex per accessibilità
  - **Menu a tendina** al click con due voci: *"Carica foto…"* (apre
    file input) e *"Rimuovi foto"* (visibile solo se foto presente,
    con conferma)
  - **`UI.cropImageToSquare(dataUrl, 320, 0.85)`**: ridimensiona e
    centra-crop l'immagine in un quadrato 320×320 px, salvata come
    JPEG base64 in `user.avatar_data_url` (qualità 0.85). Limite
    upload 5 MB, accetta qualsiasi formato `image/*`.
  - **Riadattamento a cerchio via CSS** (`border-radius: 50%`,
    `object-fit: cover`): l'immagine quadrata diventa il cerchio
    perfetto, anche se l'originale era rettangolare/verticale.
- ✨ **Foto visibile ovunque l'utente appare**:
  - Nav avatar header (`UI.initProfileAvatar` rileva `avatar_data_url`
    e mostra `<img>` invece delle iniziali)
  - Profile page (avatar grande)
  - Post composer (`UI.renderPostComposer` mostra mini-foto)
  - Post card autore (`UI._renderPostCard` con `authorAvatarInner`)
- ✨ **Nuovi metodi API**:
  - `API.setUserAvatar(dataUrl)` — setta la foto profilo dell'utente corrente
  - `API.clearUserAvatar()` — rimuove la foto
  - Campo `avatar_data_url` aggiunto alla whitelist di `updateUser`
- 📚 Rapporto tecnico: nuova sezione §4.28 con la giustificazione
  delle scelte iconografiche e dell'architettura dell'avatar.

---

## [2.4.0] — Post sociali, security fix, library cleanup

**In sintesi:** gli utenti curatori (chi ha almeno un volume) possono
ora pubblicare post brevi sulla propria libreria; reazioni, segnalazioni
e notifiche ai follower funzionano end-to-end; l'admin ha una nuova
tab "Segnalazioni" per moderare; il bottone Elimina Volume su
`book-detail.html` è ora gated solo al proprietario; la pagina
`library.html` è stata pulita da elementi superflui.

- 🐛 **Security fix grave** sul bottone *"🗑 Elimina volume"* in
  `book-detail.html`: ora visibile e utilizzabile **solo** al
  proprietario del libro. L'admin non lo vede più (deve usare il
  pannello admin se vuole moderare). Prima permetteva anche all'admin
  di cancellare un libro senza passare dall'audit del pannello.
- 🔧 **`library.html` ripulita**: rimosso il banner *"Stai visitando
  la libreria di un altro membro… la vista è in sola lettura"*
  (ridondante: ovvio dal contesto). Rimossi i 4 bottoni di switch
  layout (Griglia/Elenco/Scaffale/Cronologia): ora la pagina rispetta
  sempre `prefs.view_mode` salvata dal curatore in `profile-setup` —
  i visitatori vedono la libreria *come l'ha pensata il proprietario*.
  Rimosso il riquadro statistica *"consultazioni totali"* (rumore).
- ✨ **Sistema Post completo**:
  - **Store `posts[]`** con `{id, author_id, content, created_at,
    reactions: {emoji: [userId]}, reports: [...]}`
  - **`API.canPublishPosts(userId)`**: requisito di pubblicazione =
    almeno un volume pubblicato (coerente con modello Lettore→Curatore)
  - **`API.createPost(content)`**: validazione (non vuoto, ≤500 char),
    notifica automatica a tutti i follower con tipo `new_post`
  - **`API.togglePostReaction(postId, emoji)`**: 4 emoji possibili
    (👍 ❤️ 👏 🤔), 1 reazione max per utente per post (sostitutiva)
  - **`API.reportPost(postId, reason, note)`**: motivo enum
    (offensivo, spam, off-topic, violenza, altro) + nota libera ≤300
    char, 1 segnalazione max per utente per post
  - **`API.deletePost(postId)`**: solo autore o admin
  - **`API.clearPostReports(postId)`**: solo admin, archivia
    segnalazioni mantenendo il post
- ✨ **Nuova tab *"Post"* su `profile.html`** (fra "La mia libreria" e
  "Richieste ricevute"): composer in cima per chi può pubblicare (con
  contatore caratteri che diventa burgundy oltre 85%), cronologia dei
  propri post sotto, con bottone elimina sui propri.
- ✨ **Sezione *"Aggiornamenti dalla libreria"* su `library.html`** —
  vista pubblica dei post del curatore, raggiungibile da notifica
  `new_post` via anchor `#posts`.
- ✨ **Sezione *"Aggiornamenti recenti"* su `index.html`** (`auth-only`):
  posta sopra l'hero per utenti loggati, mostra fino a 10 post degli
  utenti seguiti + propri, in ordine cronologico inverso. Empty state
  che invita ad esplorare la mappa per iniziare a seguire profili.
- ✨ **Notifica `new_post`**: icona 📝, generata per ogni follower
  alla pubblicazione, routing a `library.html?id=N#posts`. Inclusa
  nel filtro "social" della campanella.
- ✨ **Tab *"Segnalazioni"* nel pannello admin** con badge contatore
  live: per ogni post segnalato mostra autore, contenuto inline,
  conteggio motivi e elenco completo delle segnalazioni con
  reporter/motivo/nota/data. Due azioni: *"Archivia segnalazioni"*
  (post resta) o *"Elimina post"* (rimosso).
- ✨ **Modal di segnalazione**: costruito on-demand quando l'utente
  clicca *"⚐ Segnala"*, con select motivo + textarea facoltativa.
  Coerente visivamente con `.admin-modal` del pannello admin.
- ✨ **5 post di esempio** in `SAMPLE_POSTS` per popolare la feature
  dal primo load: 4 post curatoriali + 1 post controverso di Luca
  Esposito con una segnalazione di Marco De Vito (motivo "off-topic")
  per dimostrare la tab Segnalazioni dell'admin.
- 📚 Rapporto tecnico: nuova sezione §4.27 con le risposte tecniche
  sulla distinzione Persone/Organizzazioni e Curatori/Lettori, oltre
  che la giustificazione delle scelte sui post.

---

## [2.3.0] — View tracking reale, eliminazione volume, admin CRUD

**In sintesi:** sparisce la sezione "Dati simulati" perché ora le
visualizzazioni sono tracciate come eventi timestampati veri; ogni
top-book nella pagina stats si espande con un grafico cumulativo
"dalla pubblicazione a oggi"; i proprietari (e gli admin) possono
eliminare definitivamente un volume con conferma; il pannello admin
è completamente rifatto con CRUD operativi su utenti e libri.

- ✨ **View tracking reale** (`API.recordBookView(bookId)`): ogni
  visita a `book-detail.html` registra un evento `{id, book_id,
  viewer_id, ts}` in `book_views[]`. Deduplicato per session via
  `sessionStorage` (un reload non gonfia il contatore). Il vecchio
  `incrementViews` è sostituito ovunque. La `book.views` resta
  sincronizzata per backward compat.
- 🔧 **Sezione "Dati simulati" rimossa da `stats.html`**: i KPI
  `total_views` e `avg_views_per_book` sono ora calcolati dagli
  eventi reali e migrati nella sezione "Dati della piattaforma".
  La pagina ha ora 7 KPI tutti reali, con un'unica sezione e un
  unico tag verde.
- ✨ **`API.deleteBook(bookId)`** — cancellazione hard del libro con
  cascade su `loan_requests`, `book_views`, `likes_<userId>`. Permesso
  solo a proprietario e admin. Pulsante *"🗑 Elimina volume"* su
  `book-detail.html` visibile solo per il proprietario, con modale di
  conferma che elenca cosa verrà cancellato (richieste, viste, like).
- ✨ **Top-book espandibili su `stats.html`**: ogni voce della top 8
  ha un toggle che si espande in un pannello con:
  - 6 mini-KPI (visualizzazioni, richieste, conclusi, attivi, like,
    giorni in piattaforma)
  - Data di pubblicazione formattata in italiano
  - **Line chart cumulativo Chart.js** con 3 serie sovrapposte
    (visualizzazioni, richieste prestito, like) per ogni mese dalla
    pubblicazione a oggi (`API.getBookTimeline(bookId)`)
  - Caricamento lazy: il chart si costruisce solo alla prima
    espansione, click successivi sono solo show/hide
- ✨ **Pannello admin completamente rifatto** (`admin.html`):
  - **6 KPI strip** in cima (utenti, volumi, prestiti, viste,
    recensioni, messaggi) tutti reali
  - **Tab "Utenti"**: tabella con ID, nome, username, email, città,
    ruolo, count libri, azioni (modifica + elimina). Ricerca live
    sui campi. Riga admin evidenziata in oro con pill "ADMIN" e
    senza bottone elimina. Bottone elimina nascosto sull'admin
    corrente per evitare auto-suicidio.
  - **Tab "Volumi"**: tabella con ID, titolo, autore, anno,
    proprietario, categoria, stato (disponibile/no), azioni.
    Ricerca live.
  - **Tab "Sistema"**: tre azioni — esporta backup JSON di tutto il
    localStorage, reset al seed iniziale (con conferma), svuota
    completamente localStorage (con conferma forte).
  - **Modal di edit utente**: 7 campi (nome, username, email, città,
    account type, library role, bio) con validazione client.
  - **Modal di edit libro**: 9 campi (titolo, autore, anno, lingua,
    ISBN, proprietario, categoria, disponibilità, descrizione).
  - **Modal di conferma** riusabile per ogni operazione distruttiva.
- ✨ **5 nuovi metodi API** per il CRUD: `updateBook(id, patch)`,
  `updateUser(id, patch)`, `deleteUser(id)`, `adminAddBook(data)`,
  e già introdotti `recordBookView`, `getBookTimeline`, `deleteBook`.
- ✨ **`API.deleteUser(userId)`** — cancella un utente non admin
  insieme a tutti i suoi libri, prestiti, recensioni, view events,
  preferences. Non può cancellare sé stesso. Solo admin.
- 🔧 **`createUser` riusato dall'admin** per "Nuovo utente": stesso
  metodo, stessa validazione di unicità username/email — niente
  codice duplicato.
- 🐛 I grafici hardcoded del vecchio admin (`chart-users-growth`,
  `chart-loans-status`) sono stati eliminati. Erano placeholder
  che non riflettevano dati reali.
- 📚 Rapporto tecnico: nuova sezione §4.26.

---

## [2.2.0] — Stats redesign, admin login, separazione dati reali/simulati

**In sintesi:** la pagina statistiche è completamente rifatta per
separare con chiarezza i KPI calcolati dai dati persistenti da quelli
che derivano dai seed iniziali, con una timeline reale di attività
piattaforma, un sunburst gerarchico BISAC con matrice di co-occorrenza
per le intersezioni di generi, e classifiche di libri e utenti
multi-metrica. Il pannello admin è ripristinato dietro autenticazione
`admin/admin`.

- ✨ **Pagina statistiche completamente rinnovata** con 6 sezioni:
  - **Dati reali della piattaforma** — 6 KPI calcolati al 100% dai
    dati persistiti: volumi, utenti (con breakdown curatori/lettori),
    prestiti (totali, conclusi, in corso), recensioni (con media ★),
    messaggi chat, notifiche. Tag verde "calcolato dai dati persistenti".
  - **Dati simulati (seed del prototipo)** — 2 KPI esplicitamente
    etichettati: visualizzazioni totali e media per libro, derivati
    dai seed iniziali di `book.views`. Tag oro "non da tracciamento
    reale" per non confondere l'utente sulla provenienza del dato.
  - **Timeline attività ultime 12 settimane** — stacked bar chart
    aggregato dai timestamp REALI di 4 tipi di evento: libri pubblicati,
    prestiti avviati, recensioni scritte, messaggi inviati. Colori
    coordinati con la palette del sito.
  - **Distribuzione per genere BISAC** — sunburst gerarchico (doughnut
    nidificato: anello esterno = 11 macro-generi, anello interno = sotto-
    generi) + matrice di co-occorrenza 11×11 colorata con intensità
    proporzionale al numero di libri che condividono due macro-categorie.
    La diagonale (libri "puri" di una categoria) è in bordeaux; le
    intersezioni sono in oro.
  - **Volumi più richiesti** — top 8 libri con micro-sparkline mensile
    su 12 mesi delle interazioni reali (richieste di prestito + like).
    Layout responsive: su mobile la sparkline va sotto.
  - **Utenti più attivi** — 8 utenti ordinati con 5 tab di metrica:
    punteggio composito (prestiti × 3 + recensioni × 2 + libri + follower),
    prestiti completati, recensioni scritte, volumi pubblicati, follower.
    Tab a pill, click per cambiare ranking, link al profilo dell'utente.
- ✨ **7 nuovi metodi API**: `getRealStats()`, `getSimulatedStats()`,
  `getActivityTimeline()` (bucketing per settimana), `getBisacHierarchy()`
  (gerarchia macro→sub), `getCategoryCooccurrence()` (matrice 11×11),
  `getTopBooksWithTimeline(limit)` (con sparkline mensile),
  `getTopUsers(limit)` (5 ranking diversi).
- ✨ **Utente admin** (`id: 11`, `username: 'admin'`, `is_admin: true`,
  `library_role: 'admin'`) aggiunto a `SAMPLE_USERS`.
- ✨ **`API.authenticate(usernameOrEmail, password)`** — login reale
  (prima la form era decorativa). Per admin: password deve essere
  esattamente `admin`. Per altri sample user: qualsiasi password
  ≥8 caratteri (siamo in demo). Restituisce `{ok, user}` o
  `{ok: false, reason}`.
- ✨ **`API.requireAdmin()`** — gate per pagine amministrative:
  reindirizza a `login.html` se non autenticato, a `index.html` se
  autenticato ma non admin. Applicato all'inizio dello script di
  `admin.html`.
- ✨ **`UI.initAdminLink()`** — inietta automaticamente il link
  *"🛡 Admin"* (oro) nella nav header subito dopo *Profilo*, ma solo
  per utenti con `is_admin: true`. Non visibile ad altri.
- 🔧 **Form login funzionale**: `login.html` ora ha banner di errore
  (`#login-error`) che mostra messaggi specifici per ogni reason
  (`wrong-password`, `user-not-found`, `password-too-short`,
  `missing-credentials`). Su successo: admin → `admin.html`, gli
  altri → `profile.html`.
- 🔧 **`library_role: 'curator'`** aggiunto ai 10 sample users (era
  presente solo su utenti registrati via wizard di v1.9). Sblocca la
  separazione "curatori vs lettori" sui KPI reali.
- 📚 Rapporto tecnico: nuova sezione §4.25.

---

## [2.1.0] — Username univoco, empty-state centrato, enfasi visibilità libreria

**In sintesi:** la registrazione ora rifiuta correttamente username
ed email duplicati con feedback live; l'empty-state della libreria
viene riallineato visualmente; e chi non ha ancora completato
l'apertura della libreria vede uno stato di visibilità esplicito
con i bottoni di azione nascosti finché la libreria non è
effettivamente pubblicabile.

- ✨ **Validazione univocità username/email in `API.createUser`**:
  prima del salvataggio, il metodo controlla case-insensitive sia
  l'username (`username-taken`) che l'email (`email-taken`) contro
  gli utenti esistenti. Restituisce ora `{ok: true, user}` invece
  dell'utente nudo, così il chiamante può gestire i casi d'errore
  in modo idiomatico. `register.html` mostra il messaggio puntuale
  (es. *"Questo nome utente è già in uso. Scegline uno diverso."*)
  e riporta l'utente allo step 1 con focus sul campo problematico.
- ✨ **Check live di univocità su `blur`** dei campi `#username` e
  `#email` in register.html: dopo che l'utente esce dal campo, il
  sistema confronta il valore con gli utenti esistenti e, se già
  preso, applica la classe `is-invalid-unique` (bordo bordeaux,
  sfondo soft) + un piccolo messaggio mono *"Nome utente già in
  uso."* / *"Email già registrata."* sotto al campo. Feedback
  immediato senza attendere il submit.
- 🔧 **`library_role` ora sul user object** invece che solo nelle
  prefs. Era un'incoerenza fra `createUser` (che lo salvava nelle
  prefs) e il wizard inline di v1.9 (che lo metteva su `user`),
  causando ambiguità nelle query. Ora vive in entrambi i posti per
  retrocompatibilità.
- 🐛 **Empty-state della libreria centrato visivamente**:
  il container `.empty-state--first-book` ora usa `display: flex;
  flex-direction: column; align-items: center` invece di affidarsi
  a `margin: 0 auto` sui figli (che non veniva applicato per un
  qualche edge case di layout). Risultato: titolo, paragrafo,
  bottone e hint sono ora visibilmente allineati al centro,
  indipendentemente dalla larghezza del contenuto.
- 🔧 **Uniformata max-width** di `h3`, `> p` e `.empty-state__hint`
  a `48ch` (prima h3 era 38ch, hint era 56ch). Coerenza visuale
  fra le righe consecutive.
- ✨ **Pill di stato visibilità libreria** (`.visibility-pill`)
  accanto al titolo *"La mia libreria"*. Due varianti:
  - `--locked` (bordeaux) per Lettori puri: *🔒 NON ANCORA VISIBILE*
  - `--empty` (oro) per Curatori con 0 libri: *◐ IN ATTESA DEL PRIMO VOLUME*
  Stile monospace, uppercase, letter-spacing piccolo — coerente
  con la grammatica visiva degli altri badge della piattaforma.
- ✨ **Banner enfasi visibilità** (`.visibility-banner`) sopra
  all'empty-state, due livelli di severità:
  - `--strong` (border-left bordeaux, icona ⓘ bordeaux): per
    Lettori, spiega che serve aprire la libreria E pubblicare
    almeno un volume per essere visibili
  - `--soft` (border-left oro, icona oro): per Curatori con 0
    libri, ricorda che basta un volume per apparire negli elenchi
- ✨ **Hide condizionale dei bottoni** *"+ Aggiungi volume"* e
  *"⚙ Personalizza profilo"* nel header della tab libri: nascosti
  quando l'utente è `library_role === 'borrower'` (non ha ancora
  aperto la libreria, quindi quei bottoni non avrebbero senso).
  Restano visibili per i Curatori, anche con 0 libri.
- 📚 Rapporto tecnico: nuova sezione §4.24.

---

## [2.0.0] — Master-detail prestiti, badge esperienza, nav "Prestiti"

**In sintesi:** la pagina dei prestiti è completamente ripensata in
master-detail con filter pills; ogni profilo utente mostra il numero
di prestiti completati accanto alle recensioni; e "Prestiti" diventa
una voce di prima classe nella navigazione principale. Bump a 2.0
perché la riorganizzazione è sostanziale e cambia il modello mentale
con cui l'utente interagisce con i propri scambi.

- ✨ **Master-detail layout su `loans.html`**: due colonne su desktop
  (lista 360px a sinistra, dettaglio a destra), stack view su mobile
  (lista OR dettaglio con bottone *← Torna alla lista*). La lista è
  sticky (`position: sticky; top: var(--sp-4)`) e scorrevole
  indipendentemente dal dettaglio.
- ✨ **Filter pills**: quattro chip in cima alla lista — *Tutti / In
  corso / Completati / Annullati* — ognuna con counter live (es.
  "In corso 9"). "In corso" raggruppa `requested + confirmed +
  borrowed + returning`; "Completati" è `returned`; "Annullati" è
  `rejected + cancelled`. Il filtro attivo è bordeaux pieno; gli
  altri outline soft.
- ✨ **Lista item compatti** (`.loan-listitem`): copertina
  miniaturizzata (50×70px) con tema dell'altra parte, titolo del
  libro, "da/a [nome dell'altro]", status pill colorato per stato,
  time-ago, e un **badge rosso unread** in alto a destra se ci sono
  messaggi chat non letti nel prestito. Click → apre il dettaglio.
- ✨ **Dettaglio inline**: il vecchio "card prestito" completo
  (timeline, chat, simulatore, azioni, eventuali email simulate) ora
  vive nel pannello di destra; cambia man mano che si clicca un item
  diverso, **senza ricaricare la pagina**.
- ✨ **Aggregazione richiedente + prestatore**: `loans.html` ora
  mostra prestiti dove l'utente è uno qualsiasi dei due ruoli (prima
  vedeva solo quelli come richiedente). Nuovo metodo API
  `getLoansForUser(userId)` che unisce le due viste. Le azioni
  contestuali si adattano: se sono prestatore vedo *Conferma /
  Rifiuta* su `requested` e *Conferma restituzione* su `returning`;
  se sono richiedente vedo *Annulla / Conferma ritiro / Inizia
  restituzione / Lascia recensione* come prima.
- ✨ **Deep-linking** via hash `#loan-N`: ogni click su un item
  aggiorna `history.replaceState` (no nuovo entry nella history,
  bottone back resta utile) con `#loan-N`. Il caricamento diretto
  della pagina con `#loan-3` apre il dettaglio del prestito 3.
  Compatibilità: i vecchi link `loans.html?id=N` (dalle notifiche
  pre-2.0) continuano a funzionare come deep-link al dettaglio.
- ✨ **Badge "↺ N prestiti completati"** (`.loan-experience`)
  visibile sia su `library.html` (profilo pubblico) sia su
  `profile.html` (proprio hub), accanto alle stelle delle
  recensioni. Stile: pillola sage soft con icona ↺, conteggio in
  display font, etichetta in mono. Mostrato solo se count > 0
  (chi è all'inizio non viene "marchiato" come inesperto). Conta
  loan in stato `returned` dove l'utente è uno qualsiasi dei due
  ruoli — è l'indicatore di esperienza promesso dall'utente per
  affiancare le recensioni.
- ✨ **Nuovi metodi API**: `getCompletedLoansCount(userId)` per il
  badge, `getLoansForUser(userId)` per la pagina master-detail.
- ✨ **Nav "Prestiti"**: nuova voce nella `<nav>` di ogni pagina
  HTML (13 file aggiornati via `perl -i -pe`), inserita tra
  *Statistiche* e *Profilo*. Marcata `class="auth-only"` così è
  nascosta agli ospiti (che non possono avere prestiti). Quando si
  è su `loans.html`, il link è auto-highlighted dal sistema
  esistente di `UI.highlightActiveNav()`.
- 🔧 **Status labels human-friendly** sui list item (mappa
  `STATUS_LABELS`): "In attesa" / "Confermato" / "In tuo possesso"
  / "In restituzione" / "Concluso" / "Rifiutato" / "Annullato". Le
  etichette tecniche (requested/confirmed/ecc.) sopravvivono solo
  come selettori CSS per i colori.
- 📚 Rapporto tecnico: nuova sezione §4.23.

---

## [1.9.0] — Pulizia registrazione, simulatore stato, wizard apertura libreria inline

**In sintesi:** rimossa la ridondanza del banner del Lettore, aggiunto un
simulatore di transizioni di stato sui prestiti con risposte di chat
contestuali automatiche, e completata la separazione tra "Lettore" e
"Curatore" con un wizard di apertura libreria che si materializza
nello stesso spazio dell'empty-state.

- 🔧 **Box "💡 Da lettore..." rimosso da register.html** (era ridondante:
  il banner bordeaux in cima dice già la stessa cosa). Il `#borrower-hint`
  è stato eliminato dal DOM; il riferimento JS è null-safe.
- ✨ **Simulatore di stato del prestito** in `loans.html`: ogni card di
  prestito in stato `requested`/`confirmed`/`borrowed`/`returning` mostra
  in fondo un bottone *"🎬 Simula prossimo stato (demo)"* con stile
  monospazio oro distinto dalle azioni reali. Click:
  1. Animazione `state-fade` (0.5s) su timeline e azioni — opacità↓, scale↓, blur
  2. Bypass dei controlli di ruolo via swap temporaneo di `current_user_id`
  3. Chiamata al metodo di transizione corrispondente (`confirmLoan`,
     `confirmPickup`, `startReturn`, `confirmReturn`)
  4. Risposta contestuale automatica dall'**altra parte** nella chat
  5. Toast informativo + re-render
- ✨ **Risposte contestuali automatiche** (nuovo `API._contextualReply`):
  banca di 3 frasi diverse per ogni combinazione `(nuovo_stato × ruolo_altra_parte)`,
  con il nome dell'utente corrente interpolato. Esempi: stato `confirmed`
  con prestatore = altro → *"Ciao [nome]! Ti ho confermato la richiesta,
  puoi venire a prenderti il libro quando ti torna comodo. Ti serve aiuto
  con la posizione?"*; stato `returning` con prestatore = altro →
  *"Va bene, ho ricevuto la notifica di restituzione. Quando passi
  a riportarlo? Stessi orari di prima."* Una frase a caso fra le 3.
- ✅ **Notifiche per messaggi chat confermate già presenti**: il metodo
  `sendMessage` (v1.7) genera correttamente una notifica di tipo
  `loan_message` per l'altro partecipante a ogni invio, anche quando
  il messaggio è generato dal simulatore. Verificato nello smoke test.
- 🔧 **Banner "Apri la tua libreria" sopra le tab del profilo
  rimosso**: spostato come CTA dedicata dentro all'empty-state della
  tab libri. Eliminata la chiave `localStorage[open_library_cta_dismissed_*]`
  che non ha più ragione di esistere.
- ✨ **Empty-state intelligente** sulla tab libri:
  - se `user.library_role === 'borrower'` (Lettore puro): CTA
    *"📚 Apri ufficialmente la tua libreria"* con illustrazione SVG
    (libro + simbolo `+`) + testo *"Vuoi diventare anche tu un
    curatore?"* + hint *"Bastano due minuti: ti chiediamo bio, città,
    motto e tema cromatico"*. Cliccando avvia il **wizard inline**
    (non una pagina nuova).
  - se Curatore con 0 libri: empty-state classico *"+ Aggiungi il
    primo volume"* (link a `add-book.html`).
- ✨ **Wizard inline apertura libreria** (`startOpenLibraryWizard`):
  fade-out dell'empty-state (`.is-transitioning`, 280ms) → fade-in
  del wizard nello stesso `#my-books` (`.is-wizard-active`). Tre step:
  1. **Identità**: bio (min 20 char) + città (richiesta) + motto (facoltativo)
  2. **Estetica**: theme picker con le 4 card swatch già introdotte in v1.8
  3. **Conferma**: riepilogo `<dl>` di tutto + bottone *"📚 Apri la libreria"*
  Step indicator in alto in monospazio, ognuno con stati `is-active`/`is-done`.
  Submit → `user.library_role = 'curator'`, bio/city aggiornati,
  `profile_prefs_{id}` con motto + theme, toast di successo,
  `location.reload()` per mostrare l'empty-state classico.
- ✨ **Gate add-book.html per Lettori**: `if (me.library_role === 'borrower')`
  → toast *"Apri prima la tua libreria dal profilo per pubblicare volumi"*
  + redirect a `profile.html#panel-books`. I Lettori non possono saltare
  il wizard navigando direttamente alla pagina.
- 🐛 **Fix profile header**: `${user.bio}` ora è null-safe (era
  `undefined` come stringa per Lettori senza biografia).
- 📚 Rapporto tecnico: nuova sezione §4.22.

---

## [1.8.0] — Fast-track Lettore, banner libreria, theme picker visuale

**In sintesi:** la registrazione per chi vuole solo prendere in prestito
diventa un **singolo passo** che porta direttamente alla pagina del
proprio prestito già creato; sull'hub appare un banner che invita ad
aprire la libreria quando si vorrà; e la scelta del tema cromatico
abbandona il menu a tendina testuale per diventare **quattro card
cliccabili** con anteprima visuale del gradiente.

- ✨ **Fast-track registrazione Lettore con `?intent=borrow`**: la
  scelta del ruolo è nascosta (Lettore pre-selezionato), il banner
  bordeaux mostra il testo *"Da lettore puoi richiedere prestiti subito
  dopo l'iscrizione, senza pubblicare alcun volume. Quando vorrai
  condividere i tuoi libri, potrai aprire la tua libreria in qualsiasi
  momento dalla tua area personale — diventando a tutti gli effetti
  un curatore."* I consensi GDPR vengono **spostati nello step 1** al
  volo (sono nello step 2 nel flow standard), `lastStep()` ritorna 1
  invece di 2, il pulsante finale diventa direttamente *"Completa
  l'iscrizione"*. Gli step 2 e 3 dell'indicator vengono marcati come
  *is-skipped* per chiarezza visiva.
- ✨ **Creazione automatica del prestito dopo il fast-track**: alla
  conferma dei dati, oltre alla creazione dell'utente e al login, il
  sistema legge `pending_loan_book`, `pending_loan_days`,
  `pending_loan_message` dal sessionStorage (salvati da
  `book-detail.html` al momento del primo tentativo) e chiama
  `API.requestLoan(...)` con i parametri esatti. L'utente viene poi
  reindirizzato a `loans.html?id=N` con il prestito già evidenziato:
  in totale, **un solo passaggio di form** dal momento "richiedo
  prestito senza essere loggato" al momento "vedo la mia richiesta
  sulla timeline".
- ✨ **Notifica onboarding "Apri la tua libreria"**: contemporaneamente
  al fast-track, viene generata una notifica `type: 'onboarding'`,
  `onboarding_action: 'open-library'` per il nuovo utente, che porta a
  `add-book.html` cliccandola dalla campanella.
- ✨ **Banner "Apri la tua libreria" sull'hub** (profile.html): per
  utenti con zero libri pubblicati appare un blocco prominente sopra
  alle tab, con illustrazione SVG (scaffale + simbolo "+"), titolo
  *"Vuoi condividere i tuoi libri?"*, copy che spiega il passaggio
  da Lettore a Curatore, bottone primario *"+ Apri la tua libreria"*
  che porta ad `add-book.html`, e una × per dismiss persistente in
  `localStorage` (key `open_library_cta_dismissed_{userId}`).
- ✨ **Theme picker buttons-with-preview** (registrazione step 2):
  il vecchio `<select>` testuale con 4 opzioni viene sostituito da
  **quattro card cliccabili** che mostrano l'anteprima reale del
  gradiente del tema. Ogni card ha: gradient di sfondo, nome del tema
  in display (es. *"Salvia"*) e descrizione in monospazio (es.
  *"verde e oro"*), entrambi in bianco con text-shadow per
  leggibilità. La card attiva ha bordo nero, alone bianco e un tick
  ✓ in alto a destra. La griglia è responsive (auto-fit, min 140px,
  che diventa 1 colonna sotto i 380px circa).
- 🔧 **CSS `.theme-swatch` riprogettato**: da semplici cerchi 56×56
  con nome sotto a card-button rettangolari (min-height 110px) con
  anteprima del gradiente come sfondo. Lo stesso componente è ora
  usato sia in `register.html` (step "La tua libreria") sia in
  `profile-setup.html`, dove anche profile-setup ha ricevuto le
  descrizioni mancanti per simmetria.
- 🔧 **`book-detail.html`** salva anche `pending_loan_days` e
  `pending_loan_message` in sessionStorage prima del redirect a
  register, così il fast-track ha tutti i parametri necessari per
  creare il prestito senza ulteriori passaggi.
- 📚 Rapporto tecnico: nuova sezione §4.21.

---

## [1.7.0] — Chat di prestito, filtri notifiche, documenti legali, export GDPR

**In sintesi:** ogni prestito ha ora una **mini-chat** in stile Vinted con
messaggi liberi e messaggi di sistema che raccontano la storia del prestito
inline. Il centro notifiche ha cinque chip di filtro e il bottone "Segna
tutte come lette". Sono nate due pagine legali reali (Privacy + Termini)
e il diritto di portabilità GDPR diventa effettivo con un bottone che
scarica l'intera storia dell'utente in JSON.

- ✨ **Chat per prestito** (inline, espandibile sotto a ogni card su
  `loans.html` e su `profile.html > Richieste ricevute`). Toggle
  *"💬 Chat con [utente] (N nuovi)"* con badge bordeaux per i messaggi
  non letti, click → pannello con messaggi, input + bottone Invia.
  Auto-mark-as-read all'apertura, auto-scroll sull'ultimo messaggio,
  Enter invia / Shift+Enter va a capo, MAX 2000 caratteri.
- ✨ **Tre tipi di messaggio**: *user* (bolla bordeaux a destra se
  mia, crema a sinistra se dell'altro, con avatar tematico), *system*
  (pill centrale piccola in oro pallido con icona evento e "X tempo
  fa" in monospazio). Le bolle sistema sono generate automaticamente
  da OGNI transizione di stato: `requested`, `confirmed`, `borrowed`,
  `returning`, `returned`, `rejected` (con motivo!), `cancelled`,
  `overdue_reminder`. La chat racconta inline tutta la storia del
  prestito senza dover guardare la timeline.
- ✨ **Notifica `loan_message`** con icona 💬 viene inviata a ogni
  invio di messaggio (al destinatario, non a chi scrive). Routing:
  apre la pagina prestiti evidenziando quello specifico.
- ✨ **Filtri nel centro notifiche**: cinque chip pillola sopra alla
  lista — *Tutte / Prestiti / Recensioni / Social / Sistema*. Il
  filtro attivo è stilizzato bordeaux; il counter sulla campanella
  resta sempre sul totale generale (non filtrato). Empty state
  dedicato quando una categoria è vuota.
- 🔧 **"Segna tutte come lette"** era già presente in v1.6 ma ora è
  documentato e gioca insieme ai filtri: marca SEMPRE tutte le
  notifiche (non solo quelle del filtro corrente).
- ✨ **Privacy policy reale** (`privacy.html`): 9 sezioni in italiano
  che coprono natura del prototipo, titolare, dati raccolti, servizi
  esterni (OSM, Open Library, CDN), email simulate, diritti GDPR,
  sicurezza. Sostituisce il vecchio placeholder `<a href="#">` nel
  footer di tutte le pagine.
- ✨ **Termini di utilizzo reali** (`terms.html`): 10 sezioni che
  coprono natura del servizio, iscrizione, pubblicazione volumi,
  prestiti, recensioni, comportamento accettabile, proprietà
  intellettuale (con riferimento alla licenza GPL-3.0), disclaimer
  e legge applicabile.
- ✨ **Esportazione GDPR (art. 20)**: nella tab *Impostazioni* del
  profilo, nuovo bottone *"↓ Scarica i miei dati (JSON)"*. Genera un
  file con tutto quanto la piattaforma sa dell'utente: user, prefs,
  org_profile, books, loans (as_requester + as_lender), messages,
  reviews (received + written), follows, likes, notifications,
  simulated_emails. Filename `lookup-export-{username}-{date}.json`.
  Solo dati dell'utente o di cui è partecipante (no dati privati altrui).
- ✨ Nuovi metodi API: `getMessagesForLoan`, `getUnreadMessageCount`,
  `getTotalUnreadMessages`, `markLoanMessagesRead`, `sendMessage`,
  `_addSystemMessage`, `exportUserData`. Nuovo helper UI:
  `UI.renderLoanChat(container, loan, opts)` con `_renderChatMessage`
  privato.
- ✨ **26 messaggi di esempio** (`SAMPLE_MESSAGES`) seminati su 5
  prestiti (id 2, 3, 4, 6, 9) con mix di user/system e date dinamiche
  via `daysAgo()`, alcuni con `read_by` parziale per dimostrare il
  badge unread sulla card.
- 🗄️ **Schema esteso**: nuova tabella `loan_messages(id, loan_id,
  sender_id NULL, type, event_type, content, created_at)`. Tracking
  letture in JSON `read_by[]` nel prototipo (in produzione: tabella
  separata `message_reads`).
- 📚 Rapporto tecnico: nuova sezione §4.20.

---

## [1.6.0] — Rifiuto e annullamento, scadenza con sollecito, recensioni scritte

**In sintesi:** il ciclo del prestito guadagna due percorsi laterali
(rifiuto motivato e annullamento), un meccanismo di scadenza
automatica con sollecito doppio (notifica + email), e l'area
recensioni si arricchisce della vista *"Scritte"*. La richiesta di
prestito ora porta con sé una durata desiderata, scelta dall'utente
con uno slider compreso fra 5 e 28 giorni.

- ✨ **Slider "Per quanti giorni vorresti tenerlo?"** nel dialog di
  richiesta su `book-detail.html`. Range 5–28, default 14, valore
  visualizzato in tempo reale in una pillola bordeaux a destra
  dell'etichetta. Stile coerente con la palette editoriale: thumb
  bordeaux con bordo crema, scale min/max in monospazio sotto al
  cursore. Valore salvato su `loan.days_requested`.
- ✨ **Rifiuto richiesta dal prestatore** (status `rejected`): nuovo
  bottone *"✕ Rifiuta"* accanto a *"✓ Conferma richiesta"* nella tab
  "Richieste ricevute" del profilo. Click → modale dedicato che chiede
  una **motivazione obbligatoria** (min 10 caratteri, testo libero) —
  niente rifiuto in silenzio. La motivazione viene mostrata al
  richiedente sulla card del prestito al posto della timeline, con
  border-left bordeaux e tipografia corsiva.
- ✨ **Annullamento da parte del richiedente** (status `cancelled`):
  bottone *"✕ Annulla richiesta"* sulla card del prestito in stato
  `requested` (solo prima della conferma). Click → conferma JS →
  notifica al prestatore. La card mostra un banner soft "Richiesta
  annullata da te" al posto della timeline.
- ✨ **Sollecito automatico per prestiti scaduti**: ogni prestito in
  stato `borrowed` ha una *deadline* calcolata come
  `borrowed_at + days_requested`. Al raggiungimento, il nuovo metodo
  `API.checkOverdueLoans()` (chiamato a ogni `Storage.init` e su
  `loans.html` load) genera **una sola volta** per prestito (flag
  `reminder_sent_at`) un sollecito doppio:
  1. Notifica nella campanella con icona ⏰
  2. Email simulata (registrata in `simulated_emails`) con oggetto
     *"Sollecito restituzione: …"* e link diretto al prestito
- ✨ **Badge "Scaduto da X giorni"** sulla card del prestito in
  ritardo (bordeaux pulsante), o *"Restituisci entro N giorni"* in
  oro quando mancano 3 giorni o meno alla scadenza. Sotto al titolo
  della card compare anche *"Periodo pattuito: X giorni"* per i
  prestiti `borrowed`.
- ✨ **Suggerimento "Lascia una recensione" più visibile**: dopo che
  un prestito passa a `returned`, il bottone sulla card non è più
  ghost ma **primario bordeaux**. Se l'utente ha già recensito il
  prestatore, il bottone scompare e al suo posto un piccolo tag verde
  *"✓ Recensione lasciata"*. Le notifiche `loan_returned` ora puntano
  direttamente a `loans.html?id=…` per chiudere il cerchio.
- ✨ **Sub-tabs "Ricevute" / "Scritte" nella tab Recensioni del
  profilo**: pulizia dell'esistente (era *Recensioni ricevute*) +
  nuova sotto-pagina **"Scritte"** che elenca le recensioni
  dell'utente verso altri. Ogni card *Scritta* ha un'etichetta
  *"HAI RECENSITO"* in monospazio, il target al posto dell'autore,
  e due bottoni nel footer: *✎ Modifica* (link alla libreria target)
  e *🗑 Cancella* (con conferma). Conteggio mostrato nella pillola
  della sub-tab.
- 🗄️ **Schema `loan_requests` esteso**: nuovi campi `days_requested
  SMALLINT CHECK (5..28)`, `reminder_sent_at TIMESTAMPTZ`,
  `rejection_reason TEXT`, `rejected_at TIMESTAMPTZ`,
  `cancelled_at TIMESTAMPTZ`. Tabella `simulated_emails` già esistente
  ospita anche i solleciti automatici.
- 🔧 **Notifiche estese**: nuovi tipi `loan_rejected` (✕),
  `loan_cancelled` (⊘), `loan_overdue` (⏰), con icone dedicate e
  routing intelligente — quelle del richiedente portano a
  `loans.html?id=…`, quelle del prestatore a `profile.html#panel-requests`.
- 🔧 **Sample loans aggiornati**: ognuno dei 15 prestiti porta
  `days_requested` variabile (7, 10, 14, 21, 28 giorni). Il loan
  id=4 (*Napoli milionaria!* da Spaccanapoli, in possesso da 15 giorni
  con periodo 7) scade automaticamente al primo caricamento e
  attiva il sollecito di esempio.
- ✨ Nuovi metodi API: `rejectLoan(loanId, reason)`, `cancelLoan(loanId)`,
  `checkOverdueLoans()`, `getReviewsByReviewer(userId)`. Nuovo helper
  UI: `UI.renderReviewsByReviewerList(container, reviewerId)`.
- 📚 Rapporto tecnico: nuova sezione §4.19.

---

## [1.5.0] — Ciclo del prestito, timeline visuale, recensioni ancorate al prestito

**In sintesi:** il prestito diventa il fulcro vero della piattaforma. Cinque
stati ben definiti (richiesta → conferma → ritiro → restituzione → chiusura),
una pagina dedicata *"I miei prestiti"* con timeline orizzontale di stato,
wizard di restituzione con notifica + email simulata al prestatore, e
recensioni che ora si possono lasciare solo dopo aver concluso un prestito.

- ✨ **Ciclo prestito a 5 stati**: `requested` → `confirmed` → `borrowed` →
  `returning` → `returned`. Ogni transizione porta il proprio timestamp
  (`requested_at`, `confirmed_at`, `borrowed_at`, `returning_at`,
  `returned_at`). Ruoli: il **prestatore** conferma la richiesta e la
  ricezione del libro restituito; il **richiedente** conferma il ritiro
  fisico e avvia la restituzione.
- ✨ **Nuova pagina `loans.html`** ("I miei prestiti"), raggiungibile dal
  dropdown del profilo (voce *↪ I miei prestiti*). Mostra in alto tre
  statistiche (totali / in tuo possesso / richieste aperte) e in colonna
  tutti i prestiti del richiedente con timeline visuale a 5 nodi.
- ✨ **Timeline orizzontale visualmente appagante**: cinque cerchi
  connessi da linee orizzontali, il nodo dello stato corrente è
  ingrossato e pulsa con un alone bordeaux, i nodi raggiunti sono pieni
  con il segno di spunta, i futuri sono "ghost" con il numero d'ordine.
  Quando lo stato è *Prestato* (3° su 5), il nodo grosso pulsante è
  letteralmente al centro della timeline. Su mobile la timeline diventa
  verticale per leggibilità. Helper `UI.renderLoanTimeline(loan, opts)`,
  opzione `compact` per la versione ridotta usata in profile.html.
- ✨ **Wizard di restituzione** (modale): si apre da *↦ Inizia
  restituzione* sulla card del prestito in stato *Prestato*. Mostra
  riepilogo del volume + prestatore, copy chiara sul prossimo step,
  pulsanti *Annulla* e *Conferma e avvia*. Conferma → status diventa
  *Restituzione in corso*, parte una notifica al prestatore e si genera
  un'**email simulata** registrata in `localStorage` (chiave
  `simulated_emails`) con oggetto + corpo HTML + link diretto alla
  pagina del prestito.
- ✨ **Box "Demo del prototipo"** sotto la card del prestito quando
  lo stato è *Restituzione in corso*: mostra esattamente l'email che il
  prestatore "riceverebbe" (a, oggetto, corpo, link alla pagina del
  prestito). Stesso pattern del password reset.
- 🔧 **"Richieste ricevute" sul profilo** ora dinamica e collegata al
  modello reale: ogni richiesta è una card con timeline compatta e il
  bottone azione appropriato allo stato:
  - `requested` → *✓ Conferma richiesta*
  - `returning` → *✓ Conferma ricezione del volume*
  Tabella HTML statica sostituita interamente.
- 🔧 **Recensioni ora richiedono un prestito concluso**: `canReview`
  controlla che esista almeno un prestito con status `returned` fra
  l'utente corrente e il target (in qualsiasi direzione). Nuovo motivo
  `no-completed-loan` gestito nel form con messaggio dedicato. Le 45
  recensioni di esempio restano *grandfathered* (sono pre-esistenti al
  vincolo). I prestiti di esempio in stato `returned` (`SAMPLE_LOANS`
  id 6, 11–15) permettono di testare il flusso.
- ✨ **"X tempo fa"** sopra alla data assoluta nelle card recensione:
  *"un giorno fa"*, *"3 settimane fa"*, *"un anno fa"*, ecc. Nuova
  utility `UI.timeAgo(iso)` con supporto secondi/minuti/ore/giorni/
  settimane/mesi/anni in italiano. La data assoluta resta sotto, in
  monospazio uppercase.
- 🐛 **Niente self-like sui propri libri**: il cuore "Mi piace" nelle
  card libro non appare quando l'utente sta visualizzando un proprio
  volume. Stessa logica anche per il bottone *Mi piace* su
  `book-detail.html`. Risolve l'incongruenza visiva e il rischio di
  contatori gonfiati artificialmente.
- 🗄️ **Schema SQL aggiornato**: tabella `loan_requests` riscritta con
  i 5 stati nuovi + timestamp per transizione + indici dedicati
  (`idx_loans_requester`, `idx_loans_lender`, `idx_loans_book`).
  Aggiunta tabella `simulated_emails` per la dimostrazione del flusso
  di notifica (in produzione non serve: si usa SMTP).
- 🗄️ **15 prestiti di esempio** (`SAMPLE_LOANS`) seminati con date
  dinamiche (calcolate ad ogni reseed con `daysAgo(N)`), distribuiti
  fra Chiara (l'utente di default per la demo) come richiedente e
  prestatore + 5 prestiti chiusi per altri utenti, così la regola
  *"recensisci solo dopo un prestito"* ha già del materiale su cui
  funzionare.
- ✨ Nuove notifiche: `loan_request`, `loan_confirmed`, `loan_picked_up`,
  `loan_returning`, `loan_returned` — ognuna porta l'utente al punto
  giusto della piattaforma (la card del prestito, la libreria, la pagina
  recensioni).
- 📚 Rapporto tecnico: nuova sezione §4.18.

---

## [1.4.0] — Recensioni e valutazioni a stelle

**In sintesi:** la comunità acquista uno strumento di reputazione. Ogni
libreria riceve recensioni a 5 stelle dagli altri membri, il voto medio è
visibile accanto al nome ovunque appaia il profilo, e una sezione dedicata
raccoglie tutte le valutazioni in dettaglio.

- ✨ **Sistema completo di recensioni** (1–5 stelle + testo) fra utenti
  autenticati. Una recensione per coppia recensore/destinatario, ricreabile
  in modalità upsert (modifica) o eliminazione dal proprio autore. Non si
  può recensire la propria libreria.
- ✨ **Stelle d'oro accanto al nome** in tutti i punti dove appare un
  profilo: hero di `library.html`, header di `profile.html`, card
  *Librerie vicine* sulla home, popup della mappa in *Esplora*. Le stelle
  sono SVG inline coerenti col tema (colore `--color-gold`), tre stati
  (vuota, mezza, piena) gestiti dal helper `UI.renderStars(rating, opts)`.
- ✨ **Sezione "Recensioni della libreria"** in fondo a `library.html`
  (ancorata a `#recensioni`): grande riepilogo con voto medio (font
  display, 3.4rem) + 5 stelle + breakdown 1★–5★ con barre proporzionali,
  form per scrivere/aggiornare la recensione, lista delle recensioni
  esistenti ordinate per data (più recente prima) con card che mostrano
  avatar tematico del recensore, stelle, data e testo.
- ✨ **Tab "Recensioni" nel profilo personale** (`profile.html`),
  raggiungibile direttamente cliccando le stelle nell'header. Mostra solo
  le recensioni ricevute (non c'è form: non puoi recensirti).
- ✨ **Form recensione "state of the art"**: 5 stelle cliccabili con
  preview al hover/focus, etichetta dinamica del giudizio (*Inadeguato /
  Insufficiente / Discreto / Buono / Eccellente*), textarea con contatore
  caratteri (minimo 20), modalità *Aggiorna* con bottone *Elimina* se
  l'utente ha già recensito.
- 🗄️ **Nuova tabella `reviews`** in `sql/schema.sql` con vincoli a
  livello DB: `CHECK rating BETWEEN 1 AND 5`, `CHECK char_length(text) >= 20`,
  `UNIQUE (target_user_id, reviewer_id)`, `CHECK target_user_id <> reviewer_id`.
  Indici su `target_user_id` e `reviewer_id` con `created_at DESC` per
  l'ordinamento veloce.
- 🗄️ **45 recensioni di esempio** in `js/app.js` (SAMPLE_REVIEWS) e in
  `sql/seed_data.sql` (INSERT corrispondenti): ~5 per ognuno dei 10
  utenti campione, con contenuti realistici differenziati per tipo di
  account (toni formali per gli enti, personali per le persone), voti
  prevalentemente fra 4 e 5 con qualche 3 per evitare l'effetto "tutto
  perfetto".
- ✨ Nuovi metodi API: `getReviewsForUser(userId)`, `getReviewSummary(userId)`
  (media + count + distribuzione), `getReviewByPair`, `canReview`,
  `submitReview` (upsert), `deleteReview`. Wiring nel `_reseedSampleDataIfStale`
  per preservare le recensioni create dall'utente al cambio versione.
- 📚 Rapporto tecnico: nuova sezione §4.17.

---

## [1.3.0] — Onboarding fluido, dropdown profilo, password reset

**In sintesi:** iterazione orientata al primo accesso e alla cura quotidiana
del proprio account. Iscriversi diventa più rapido (i primi volumi non sono
più richiesti), il nuovo iscritto viene guidato a popolare la libreria con
notifiche dedicate e un grosso CTA sul profilo, il menu profilo nel nav
diventa un dropdown con uscita, e il "Password dimenticata?" del login è
ora un flusso completo in tre step con strength meter e link simulato.

- 🔧 **Auth-switch in cima alla registrazione**: «Hai già un account? Accedi»
  si trova subito in alto a destra, non più sepolto in fondo dopo il
  wizard. Bordo inferiore sottile, allineamento a destra — non invade.
- 🔧 **Primi volumi opzionali in registrazione**: il vincolo "almeno un
  libro" è rimosso. Lo step 3 si chiama ora "I tuoi primi volumi
  *(opzionale)*" e l'utente può completare l'iscrizione subito.
- ✨ **Notifiche di onboarding** (`type: 'onboarding'`, icona 👋): alla
  creazione dell'account la campanella si popola di due inviti — "Pubblica
  il primo volume" → `add-book.html`, "Personalizza la tua libreria" →
  `profile-setup.html`. Esistono accanto alle notifiche sociali (new_book,
  book_available, profile_update) e si comportano come queste (lette/
  non lette, contate nel badge, ecc.).
- ✨ **Empty-state grosso e accogliente sul profilo** quando l'utente non
  ha ancora pubblicato nulla: pile di libri SVG, copy chiaro, CTA
  "+ Aggiungi il primo volume" pulsante, suggerimento alle impostazioni
  per scegliere tema e cover.
- ✨ **Dropdown menu sull'avatar nel nav**: il pallino-avatar in alto a
  destra ora è un `<button>` che apre un menu a tendina con il nome
  dell'utente in intestazione e tre voci — "Vai al profilo", "Personalizza"
  e "Esci". Si chiude cliccando fuori o con *Escape*. *Esci* azzera lo
  stato di autenticazione, mostra un toast di saluto e riporta alla home
  (i dati dell'utente — preferenze, like, follow — restano salvati,
  ricompaiono al login successivo).
- ✨ **Password reset simulato in tre step** (`reset-password.html`):
   1. Richiesta email (risposta uniforme anche se l'account non esiste,
      per non rivelare la presenza di registrazioni).
   2. Conferma "controlla la tua posta" + **box "email simulata"** con
      il link cliccabile (necessario per la demo: non c'è un backend di
      posta), oggetto e corpo del messaggio.
   3. Form nuova password con **strength meter** a 5 livelli (lunghezza
      + maiuscole/minuscole + numeri + simboli), toggle mostra/nascondi
      su entrambi i campi, validazione "le password coincidono".
   Il token è single-use, scade dopo 60 minuti, gestito via `localStorage`
   (`password_reset_tokens`). In produzione la stessa logica si appoggia
   alla tabella `password_reset_tokens(user_id, token, expires_at,
   used_at)` con hash bcrypt sulla password.
- 📚 Rapporto tecnico: nuova sezione §4.16.

---

## [1.2.0] — Navbar semplificata, varietà nelle "Librerie vicine", ISBN canonici

**In sintesi:** rifinitura di consistenza e UX. La barra di navigazione è
ripulita e standardizzata su tutte le pagine, le librerie vicine si
limitano a sei con varietà di profilo, i libri in evidenza mostrano solo
quelli realmente prestabili, le copertine non sbagliano più libro, e
l'esperienza loggato/anonimo è coerente ovunque.

- 🔧 **Nav standardizzata** su tutti i file (`index`, `explore`, `library`,
  `book-detail`, `stats`, `add-book`, `profile`, `profile-setup`, `admin`).
  Sequenza unica: Home · Esplora · Statistiche · [Profilo · Pubblica
  (auth-only)] · CTA *Registrati / Accedi* (guest-only) · campanella +
  avatar (auto-iniettati) · toggle visita.
- 🔧 **Rimosso "Personalizza" dalla nav** ovunque. Unico ingresso a
  `profile-setup.html`: un nuovo bottone *⚙ Personalizza profilo* nella
  pagina `profile.html`. Rimossi anche i riferimenti residui nel footer
  e nel banner dell'owner di una libreria.
- ✨ **Iconcina-avatar del profilo nel nav** (auto-iniettata accanto alla
  campanella): pallino circolare col simbolo/iniziale dell'utente,
  sfondo colorato secondo il tema scelto. Si aggiorna se l'utente
  cambia tema.
- ✨ **"+ Pubblica" come piccolo bottone primario** nella nav loggata
  (era un semplice link), per dare risalto all'azione creativa centrale.
- ✨ **Switch visita anonima/autenticata su tutte le pagine pubbliche**
  (index, explore, library, book-detail, stats). Resta assente sulle
  pagine solo-loggato (add-book, profile, profile-setup, admin) e su
  login/register (auth-flow).
- 🔧 **Librerie vicine limitate a 6** con varietà forzata: almeno 2 enti
  e 3 librerie personali nella selezione, le restanti dal rank globale.
- 🔧 **Numero "libri disponibili" centrato** nelle nearby card (era
  allineato a destra), con spaziatura più equilibrata e tipografia
  più ampia (2.4rem).
- 🔧 **Libri in evidenza: solo disponibili al prestito**. Sulle pagine
  libreria invece restano visibili in grigio per il quadro completo.
- 🔧 **"Novità da chi segui"** ora in griglia (5 colonne ~200px su
  desktop, auto-fill) — non più giganti su una colonna.
- 🐛 **Link "Vai alla libreria" nei popup di Esplora**: ora porta a
  `library.html?id=…` (era `profile.html?id=…`, che reindirizzava al
  login per gli ospiti).
- 🐛 **Bordo CTA "Registrati / Accedi"** ora bordeaux pieno (era 0.45
  opacità, percepibile solo all'hover).
- 🐛 **Mismatch copertine ↔ ISBN**: cercati e applicati gli ISBN canonici
  reali per i libri della v1.0 dove disponibili (*Napoli milionaria!*
  Einaudi `9788806065850`, *Le vie dei canti* Adelphi `9788845911415`,
  *L'oro di Napoli* Rizzoli `9788817010917`). Per i libri con ISBN
  inverificati gli ISBN sono stati svuotati: l'Open Library Covers API
  non viene chiamata e si vede il gradiente, mai una copertina sbagliata.
- 📚 Rapporto tecnico: nuova sezione §4.16.

---

## [1.1.0] — UX mobile-first, 15 cover personalizzabili, mini-mappa libreria

**In sintesi:** iterazione di rifinitura UX orientata al mobile-first. La
home diventa più discreta (eyebrow rimossa, statistiche accorpate accanto
ai bottoni), il CTA di accesso ha bordo sempre visibile, le "Librerie
vicine" hanno 15 grafiche cover scegliibili e segnalano in arancione quando
ne restano pochi, le copertine dei libri arrivano direttamente da Open
Library, e la pagina libreria guadagna una mini-mappa, statistiche
centrate, libri in prestito grigi e un filtro completo dei volumi.

- 🐛 **Bordo CTA "Registrati / Accedi"** sempre pienamente visibile
  (era a 0.45 di opacità, si percepiva solo all'hover).
- 🔧 **Rimossa l'eyebrow** «piattaforma di condivisione culturale»: la home
  va dritta al titolo.
- 🔧 **Statistiche live accorpate accanto a "Esplora la mappa"**: un solo
  blocchetto in tipografia mono, piccolo, con pip pulsante. Su mobile va a
  capo. La sezione `hero__stats` indipendente è stata eliminata.
- ✨ **15 grafiche cover personalizzabili** (mix di 5 pattern + 5 icone +
  5 glifi tipografici) selezionabili da `profile-setup.html`. Default
  differente per tipo (enti → scaffale, personali → glifo §). Le card
  "Librerie vicine" ora mostrano la grafica scelta.
- ✨ **Avviso "pochi volumi disponibili"** sulle nearby card: quando una
  libreria ne ha 1–2 disponibili, il numero diventa arancione e il blocco
  pulsa con un bordo morbido (rispetta `prefers-reduced-motion`).
- ✨ **Copertine reali dei libri** via Open Library Covers API (per ISBN,
  parametro `default=false` per il vero 404). Fallback automatico al
  gradiente generato. Funziona ovunque (grid card, dettaglio libro,
  vista libreria).
- ✨ **Mini-mappa Leaflet** nella pagina libreria: un solo pin coerente
  col tipo (📖 / 🏛), zoom di quartiere, controlli ridotti.
- 🔧 **Statistiche libreria al centro** (`library-stats--hero`):
  *disponibili al prestito* e *volumi totali* a font grande, accanto a
  *consultazioni totali*. Su mobile vanno a 2 colonne.
- 🔧 **Libri in prestito grigi e non cliccabili** (`book-card--unavailable`)
  nelle griglie — l'utente capisce subito che non può chiederli;
  il cuore "mi piace" resta attivo per gli avvisi di disponibilità.
- ✨ **Filtro volumi nella pagina libreria** (stesso set di Esplora):
  testo (titolo/autore), tag BISAC multi-tag con autocomplete,
  e "Solo disponibili".
- 🔧 **Versionamento del dataset di esempio** (`Storage.DATA_VERSION`):
  re-semina automaticamente i campioni quando la versione cambia,
  preservando libri/follow/like creati dall'utente. Risolve il caso in
  cui localStorage di versioni precedenti mostrava solo le librerie
  personali (i nuovi enti non comparivano).
- 📚 Rapporto tecnico: nuova sezione §4.15.

---

## [1.0.0] — Standard BISAC, ricerca interattiva, UI di prossimità

**In sintesi:** la classificazione dei libri si allinea allo standard
commerciale internazionale BISAC (un libro porta più tag); la ricerca su
mappa si fa con slider e autocomplete in tempo reale; la sezione "Librerie
vicine" guadagna un'identità visiva netta tra librerie personali ed enti;
piccoli ritocchi di UX (CTA di accesso più sobrio, posizione della home
più alta in pagina).

- ✨ **Tassonomia BISAC**: 11 macro-aree (Narrativa, Saggistica, Biografie,
  Poesia, Teatro, Arte e fotografia, Fumetti, Letteratura per ragazzi,
  Cucina e casa, Viaggi, Salute e benessere) con ~70 sotto-categorie. Un
  libro può portarne più d'una.
- ✨ **Multi-tag con autocomplete**: in *Esplora* e in *Pubblica un volume*
  la vecchia `<select>` è sostituita da una casella con autocomplete:
  digitando le prime lettere compaiono i suggerimenti raggruppati per
  macro-area, frecce ↑↓ e *invio* per aggiungere, *backspace* per rimuovere
  l'ultimo. Massimo 5 tag in pubblicazione, illimitati in ricerca.
- ✨ **Slider distanza in tempo reale**: 0–20 km, "Qualsiasi distanza" a
  zero. Trascinando si aggiornano subito i risultati (debounce 240 ms).
- 🔧 **"Librerie vicine" ridisegnate**: copertine più sobrie e
  personalizzabili (sfumature più tenui del tema scelto dal curatore),
  **distinzione immediata** persone/enti con nastro colorato + badge con
  icona 📖/🏛 + etichetta tipo, **luogo in evidenza** (pin bordeaux + città)
  e **numero di libri disponibili** in grande.
- ✨ **Due nuovi enti** in lista (Libreria Indipendente Spaccanapoli, Centro
  Culturale Mezzogiorno) con sei nuovi volumi multi-tag (es. *Napoli
  milionaria!* → Teatro contemporaneo + Classici + Narrativa storica).
- 🔧 **CTA «Registrati / Accedi»** più discreto: niente riempimento
  colorato, bordo sottile bordeaux su sfondo trasparente, hover/focus
  delicati.
- 🔧 **Posizione della home al caricamento**: ridotto il `padding-top`
  dell'hero (da `--sp-16` a `--sp-10`) così il bottone *Inizia a scambiare*
  è subito visibile sotto il titolo. Un commento ben evidenziato nel CSS
  segnala dove regolare ulteriormente.
- 🗄️ **Database**: nuova tabella `book_categories` (molti-a-molti
  libri-categorie, con indice unico parziale sul tag *primario*) e colonne
  `parent_id` + `bisac_code` aggiunte a `categories` per modellare la
  gerarchia BISAC. Seed esteso con: 10 sotto-categorie BISAC, due nuovi
  enti con relativi profili, sei nuovi volumi e le relative righe di
  multi-tag (esempio reale dell'uso del modello).
- 📚 Rapporto tecnico: nuova sezione §4.14.

---

## [0.9.0] — 28 maggio 2026

**In sintesi:** l'illustrazione dell'hero diventa un asset esterno animato con
un "respiro" continuo e discreto; l'accesso e la registrazione si unificano in
un unico ingresso; nasce questo changelog.

- ✨ **Illustrazione esterna animata.** L'illustrazione disegnata internamente è
  sostituita da un asset SVG professionale (`assets/library-animate.svg`,
  Freepik/Storyset) raffigurante due lettori in una biblioteca.
- 🔧 **Animazione continua e sottile.** Oltre all'animazione d'ingresso di ~1
  secondo, il file SVG è stato arricchito con un "respiro" perpetuo, lento e
  quasi impercettibile: i due personaggi galleggiano con fasi diverse, la
  libreria pulsa leggermente di opacità, l'insegna oscilla appena. L'intero
  contenitore compie inoltre un micro-movimento di galleggiamento. Tutto parte
  dopo l'intro e rispetta `prefers-reduced-motion`.
- 🔧 **Tocco gentile.** Al tocco/click l'illustrazione fa un piccolo rimbalzo
  elastico (animazione del contenitore, dato che gli elementi interni vivono in
  un file esterno).
- 🔧 **Ingresso unico "Registrati / Accedi".** Nella barra di navigazione i due
  link separati *Accedi* e *Registrati* sono sostituiti da un solo bottone che
  porta alla registrazione. Nella pagina di registrazione compare in fondo
  «Hai già un account? **Accedi**», con *Accedi* sottolineato e in bordeaux,
  che conduce alla pagina di accesso vera e propria.
- 📚 **Nuovo file `docs/changelog.md`** con lo storico completo delle versioni
  (questo documento), d'ora in poi aggiornato a ogni iterazione.

---

## [0.8.0] — Funzioni sociali

**In sintesi:** la piattaforma diventa "sociale" — si possono seguire le
librerie, mettere "mi piace" ai volumi e ricevere notifiche; la homepage da
loggato diventa un cruscotto personale.

- ✨ **Seguire librerie.** Pulsante *Segui* sulla pagina di ogni libreria
  (persone o enti), con conteggio dei follower. Seguire genera aggiornamenti
  sui nuovi volumi e sulle modifiche alle informazioni della libreria.
- ✨ **"Mi piace" ai volumi.** Cuore nella scheda di dettaglio (con contatore) e
  come chip sovrapposto sulle card. Per i volumi in prestito si è avvisati
  quando tornano disponibili.
- ✨ **Campanella di notifiche** nell'header (utenti autenticati), con badge dei
  non letti e pannello a tendina. Tre tipi di evento con icona: 📚 nuovo libro,
  ✅ tornato disponibile, ℹ️ informazioni aggiornate.
- 🔧 **Homepage personalizzata.** Da loggato la presentazione iniziale è
  nascosta e lasciano spazio, nell'ordine, a *Novità da chi segui → I tuoi
  preferiti → Librerie vicine*, con intestazione «Bentornata, [nome]».
- 🗄️ **Database:** nuove tabelle `user_follows`, `book_likes`, `notifications`
  (con vincolo anti-auto-follow e indice parziale sui non letti) e relativo
  seed di esempio.
- 📚 Rapporto tecnico: nuova sezione §4.12 (modello dati, simulazione
  single-browser, campanella, follow/like, home personalizzata).

---

## [0.7.0] — Illustrazione flat, ricerca per luogo, validazione

**In sintesi:** l'illustrazione viene resa accogliente, la ricerca capisce i
luoghi, e l'esperienza di ricerca diventa più pulita e guidata.

- 🔧 **Illustrazione flat.** Sostituite le figure "line-art" (giudicate
  sgradevoli) con due personaggi in stile flat a forme piene, sorridenti, che
  condividono un libro. Riposizionata **accanto** al testo introduttivo (sotto,
  mai sopra, su mobile).
- ✨ **Ricerca per luogo** (`explore.html`): oltre a titolo e autore, la ricerca
  trova i volumi per città/quartiere, **CAP** e indirizzo dell'ente.
- 🐛 **Niente risultati all'avvio.** La pagina Esplora non mostra più risultati
  al caricamento: compare un invito a cercare; i risultati (con scroll
  automatico ed entrata a cascata) appaiono solo dopo una ricerca esplicita.
- ✨ **Validazione del campo di ricerca.** Premendo *Cerca* a vuoto, il bordo
  diventa bordeaux con una micro-animazione di *shake* e la ricerca non parte.
- 📚 Rapporto tecnico: sezione §4.11.

---

## [0.6.0] — Illustrazione interattiva, ricerca a elenco, percorso lettore

**In sintesi:** prime animazioni dell'hero, risultati di ricerca più leggibili e
un percorso d'iscrizione dedicato a chi vuole solo prendere in prestito.

- ✨ **Illustrazione interattiva dell'hero** (prima versione, line-art) animata
  al tocco/click.
- 🔧 **Risultati di ricerca a elenco** a piena larghezza, con la **posizione del
  volume in forte risalto** (pin + città) e badge **«Disponibile»** verde salvia
  animato. Scroll automatico ai risultati dopo la ricerca.
- ✨ **Percorso "solo prestatore".** Terza opzione *Lettore* in registrazione:
  ci si iscrive senza pubblicare volumi (lo step dei primi volumi viene
  saltato) e si può aprire la libreria in seguito. Un ospite che richiede un
  prestito viene accompagnato alla registrazione e poi riportato al libro.
- 🗄️ Database: campo `library_role` (`curator` / `borrower`) nelle preferenze.
- 📚 Rapporto tecnico: sezione §4.10.

---

## [0.5.0] — Conversione mobile-first e infografica

**In sintesi:** la homepage è ottimizzata per la conversione su mobile e spiega
il funzionamento del servizio con un'infografica.

- 🔧 **CTA primaria above-the-fold** («Inizia a scambiare») e CTA flottante
  persistente su mobile.
- ✨ **Infografica "Come funziona"** in tre passi.
- ✨ **Wizard di registrazione** a fasi con barra di avanzamento.
- 🐛 Corretto l'attributo `[hidden]` reso inefficace da regole CSS sui bottoni
  (aggiunta la regola universale `[hidden]{display:none!important}`).
- 📚 Rapporto tecnico: sezione §4.9.

---

## [0.4.0] — Modello persona/ente e libreria come oggetto di prima classe

**In sintesi:** la piattaforma distingue persone ed enti e dà alla "libreria"
una pagina propria.

- ✨ **Account persona / ente.** Introdotto `account_type` e i profili estesi
  degli enti (ragione sociale, categoria, contatti, orari, indirizzo pubblico).
- ✨ **Pagina libreria** pubblica (`library.html`) con identità, statistiche e
  volumi; distinzione visiva fra librerie personali e librerie-ente.
- 🗄️ Database: tabella `organization_profiles` (1:1 con `users`) con trigger di
  coerenza fra tipo account e profilo ente.
- 📚 Rapporto tecnico: sezioni §3.3.5 e §4.8.

---

## [0.3.0] — Homepage di scoperta: prossimità e gamification

**In sintesi:** la homepage diventa uno strumento di scoperta orientato alla
prossimità geografica.

- ✨ **"Librerie vicino a te"** con calcolo della distanza da una posizione di
  riferimento.
- 🔧 Elementi di **gamification** e contatori "live" della piattaforma.
- 📚 Rapporto tecnico: sezione §4.7.

---

## [0.2.0] — Personalizzazione del profilo e vetrina della comunità

**In sintesi:** ogni membro può personalizzare la propria identità sulla
piattaforma; nasce la vetrina delle librerie.

- ✨ **Preferenze di profilo**: modalità di visualizzazione, tema cromatico,
  stile avatar, motto, ordinamento.
- ✨ **Vetrina delle librerie** della comunità.
- 🗄️ Database: tabella `user_preferences` (1:1 con `users`).
- 📚 Rapporto tecnico: sezioni §3.3.4, §4.5 e §4.6.

---

## [0.1.0] — Fondamenta

**In sintesi:** prima versione del prototipo — identità visiva, struttura delle
pagine e modello dati di base.

- ✨ **Identità visiva**: palette editoriale (carta, inchiostro, bordeaux, oro,
  salvia), tipografia (Cormorant Garamond, Fraunces, JetBrains Mono).
- ✨ **Pagine principali**: home, esplora con mappa, dettaglio libro,
  pubblicazione, profilo, statistiche, accesso/registrazione.
- ✨ **Ricerca geografica** sulla mappa (area metropolitana di Napoli) con
  PostGIS lato schema.
- 🗄️ Database: schema iniziale (`users`, `books`, `categories`, `loan_requests`,
  `view_events`, `book_images`, `reports`) e dati di esempio.
- 📚 Rapporto tecnico: sezioni §1–§4.4.

---

*Le date precise delle versioni 0.1–0.8 non sono tracciate singolarmente:
il progetto è un prototipo didattico sviluppato in iterazioni successive.*
