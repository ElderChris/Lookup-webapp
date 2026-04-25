# Rapporto tecnico — Libreria Diffusa

**Software di geolocalizzazione culturale per la condivisione del patrimonio librario privato**

Versione: 0.1.0 — Aprile 2026

---

## Sommario esecutivo

Il progetto *Libreria Diffusa* risponde all'esigenza di dare visibilità al piccolo patrimonio librario privato — collezioni personali, biblioteche domestiche, raccolte tematiche — che oggi resta in larga parte inaccessibile alla comunità dei lettori. La piattaforma consente agli utenti di pubblicare, geolocalizzare e condividere i propri libri secondo politiche di privacy granulari, facilitando l'incontro tra chi possiede e chi cerca un'opera all'interno di un territorio circoscritto.

Il presente documento descrive il contesto operativo, i requisiti funzionali e non-funzionali, l'architettura di riferimento, lo schema dati geospaziale e le scelte di design UX e accessibilità del prototipo sviluppato.

---

## 1. Analisi del contesto operativo

### 1.1 Problema di partenza

In Italia esiste un vasto patrimonio librario diffuso in forma privata. Secondo i dati ISTAT sulla lettura in Italia, circa il 40% delle famiglie italiane possiede oltre 100 libri; una parte non trascurabile di questo patrimonio comprende **prime edizioni, testi fuori catalogo, pubblicazioni locali, saggi storici, raccolte specializzate** che non si trovano facilmente nelle biblioteche pubbliche né sul mercato dell'usato.

Questo patrimonio è oggi invisibile e sottoutilizzato:

- **Dal lato del possessore**: mancano strumenti leggeri per catalogare la propria collezione, condividerla selettivamente e raggiungere chi potrebbe essere interessato a un prestito o a una consultazione.
- **Dal lato del lettore**: chi cerca un libro specifico ricorre a OPAC bibliotecari, mercati dell'usato online o gruppi informali, senza un canale dedicato che valorizzi la prossimità geografica.
- **Dal lato della comunità**: si perde un'occasione di animazione culturale territoriale basata su incontri, scambi, gruppi di lettura spontanei.

### 1.2 Ambito scelto

Il prototipo è calibrato sull'**area metropolitana di Napoli**, con particolare attenzione ai quartieri a forte vocazione culturale (Chiaia, Vomero, Posillipo, Centro Storico) e ai comuni dell'hinterland (Portici, Pozzuoli). Questa scelta è motivata da:

1. **Densità abitativa elevata** (~8.300 ab/km² nel comune di Napoli): raggi di ricerca piccoli (1–3 km) raggiungono comunque molti potenziali utenti.
2. **Mobilità sostenibile**: in un'area urbana la richiesta di prestito si risolve tipicamente con uno spostamento a piedi o in trasporto pubblico, rendendo la logistica dell'incontro plausibile.
3. **Ricchezza di tradizione editoriale e culturale**: l'ambito napoletano presenta biblioteche private di interesse storico (studi locali, tradizioni campane, edizioni ottocentesche).
4. **Comunità di lettura già attive**: presidi librari indipendenti, gruppi di lettura e festival letterari forniscono un tessuto sociale su cui innestare la piattaforma.

Il design è tuttavia **replicabile**: l'ambito territoriale è configurabile e la piattaforma può essere istanziata per altre città, quartieri o comunità tematiche (es. librerie scolastiche, associazioni culturali).

### 1.3 Utenti di riferimento (personas)

Sono state individuate quattro personas principali:

- **Il collezionista** (45–65 anni): possiede una libreria consistente con pezzi di valore, disposto a prestare solo dopo contatto diretto. Dà priorità alla privacy e al controllo sui dati di contatto.
- **Il lettore forte** (25–45 anni): collezione media (200–500 volumi), interessato sia a prestare sia a prendere in prestito. Usa la piattaforma anche come strumento di catalogazione personale.
- **Lo studente / ricercatore** (18–30 anni): cerca testi specifici (spesso saggistica o classici fuori catalogo) per studio o tesi. Consulta senza necessariamente possedere una libreria propria.
- **L'animatore culturale**: organizza gruppi di lettura, presentazioni, progetti di quartiere. Usa la piattaforma come directory per individuare interlocutori e opere.

### 1.4 Vincoli e stakeholder

| Stakeholder | Interesse | Vincolo |
|---|---|---|
| Utente finale | Facilità d'uso, riservatezza | Accessibilità da dispositivo mobile |
| Amministratore della piattaforma | Moderazione contenuti, conformità normativa | Strumenti per gestire segnalazioni e reportistica |
| Garante Privacy (Italia / EU) | Tutela dati personali e geolocalizzazione | Conformità GDPR (Reg. UE 2016/679), principio di minimizzazione |
| Comunità locale | Valorizzazione del patrimonio culturale diffuso | Apertura e replicabilità della piattaforma |

---

## 2. Requisiti

### 2.1 Requisiti funzionali

I requisiti sono raggruppati per area funzionale e identificati da un codice (RF-*).

#### 2.1.1 Gestione utenti (RF-U)

- **RF-U1** Il sistema deve consentire la registrazione con email, username, nome visualizzato, password e città di residenza.
- **RF-U2** Il sistema deve raccogliere consensi espliciti e separati per: accettazione termini di servizio, privacy policy, iscrizione newsletter (opt-in).
- **RF-U3** L'utente deve poter modificare in qualsiasi momento le proprie preferenze di visibilità del profilo (pubblico / solo registrati / privato).
- **RF-U4** L'utente deve poter scegliere la **precisione della propria geolocalizzazione** tra quattro livelli: nascosta, solo città, zona approssimata (±200 m), precisa.
- **RF-U5** Il sistema deve fornire funzionalità GDPR: **esportazione dei dati personali** in formato strutturato (JSON), **rettifica**, **cancellazione account**.

#### 2.1.2 Gestione del patrimonio librario (RF-L)

- **RF-L1** L'utente deve poter pubblicare un libro inserendo: titolo, autore, anno, categoria, ISBN, lingua, numero di pagine, condizione fisica, descrizione libera.
- **RF-L2** Il sistema deve supportare l'upload di un'immagine di copertina con generazione automatica di almeno una miniatura (160×240 px).
- **RF-L3** L'utente deve poter modificare o rimuovere i propri libri in qualsiasi momento.
- **RF-L4** L'utente deve poter impostare la **policy di fruizione** per ciascun libro: prestito, solo consultazione, solo esposizione.

#### 2.1.3 Ricerca e scoperta (RF-R)

- **RF-R1** Il sistema deve offrire ricerca testuale su titolo, autore, descrizione.
- **RF-R2** La ricerca testuale deve essere tollerante a errori minori (*fuzzy matching*).
- **RF-R3** Il sistema deve offrire ricerca **spaziale** per raggio configurabile (1, 3, 5, 10 km) centrato su un punto di interesse o sulla posizione dell'utente.
- **RF-R4** I risultati devono essere visualizzabili sia come griglia testuale sia su **mappa interattiva**.
- **RF-R5** Il sistema deve permettere il filtraggio per categoria e per disponibilità.

#### 2.1.4 Interazione tra utenti (RF-I)

- **RF-I1** Dalla pagina di dettaglio di un libro l'utente deve poter inviare una **richiesta di prestito** al proprietario.
- **RF-I2** La richiesta deve richiedere un consenso esplicito alla condivisione dei dati di contatto con il proprietario.
- **RF-I3** Il proprietario deve poter accettare, rifiutare o ignorare la richiesta.
- **RF-I4** Il sistema deve tracciare lo stato delle richieste (pending, accepted, rejected, completed, cancelled).

#### 2.1.5 Statistiche e amministrazione (RF-S)

- **RF-S1** Il sistema deve raccogliere metriche di base: visualizzazioni per libro, richieste di prestito ricevute, utenti attivi nel tempo.
- **RF-S2** Il sistema deve offrire una **dashboard pubblica** con grafici aggregati e ranking.
- **RF-S3** Il sistema deve offrire una **dashboard amministrativa** per moderazione di utenti e libri, gestione segnalazioni, export backup, azioni di sistema.

### 2.2 Requisiti non-funzionali

#### 2.2.1 Privacy (RNF-P)

- **RNF-P1** Conformità al **Regolamento UE 2016/679 (GDPR)** e al D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018.
- **RNF-P2** Principio di **minimizzazione dei dati**: raccolta solo delle informazioni necessarie alla finalità dichiarata.
- **RNF-P3** **Privacy by design** nelle scelte architetturali: la geolocalizzazione è fuzzificata di default a livello 2 (±200 m) e la visualizzazione precisa richiede opt-in esplicito.
- **RNF-P4** **Privacy by default**: il profilo nuovo è pubblico ai soli registrati (non agli utenti anonimi) finché l'utente non sceglie diversamente.
- **RNF-P5** I dati di contatto (email, eventuale telefono) non sono mai esposti prima dell'accettazione di una richiesta di prestito.
- **RNF-P6** I log di visualizzazione sono **anonimizzati** (session ID hashed) e ruotati secondo una retention policy di 12 mesi.

#### 2.2.2 Sicurezza (RNF-S)

- **RNF-S1** Password memorizzate con hash **bcrypt** (cost ≥ 12) o **Argon2id**.
- **RNF-S2** Autenticazione via **JWT** con access token short-lived (15 min) e refresh token httpOnly.
- **RNF-S3** Tutto il traffico in **HTTPS** (TLS 1.3 preferito).
- **RNF-S4** Validazione lato server di tutti gli input (mai fiducia nei soli controlli client-side).
- **RNF-S5** Rate limiting su endpoint sensibili (login, registrazione, richiesta prestito) per mitigare attacchi di enumerazione e brute-force.
- **RNF-S6** Upload delle immagini: validazione MIME, limite dimensionale (5 MB), scansione antivirus opzionale in produzione.

#### 2.2.3 Performance (RNF-PF)

- **RNF-PF1** Time-to-interactive della homepage ≤ 2 s su connessione 4G media (1.5 Mbps, RTT 300 ms).
- **RNF-PF2** Ricerca spaziale entro un raggio di 10 km deve restituire risultati in ≤ 500 ms con dataset fino a 100.000 libri, grazie all'indice GIST su `users.location`.
- **RNF-PF3** Le miniature delle copertine devono pesare ≤ 30 KB ciascuna (WebP, q=80).
- **RNF-PF4** La mappa interattiva deve supportare la visualizzazione simultanea di almeno 500 marker senza degrado percettibile (clustering attivato oltre tale soglia).

#### 2.2.4 Accessibilità (RNF-A)

- **RNF-A1** Conformità **WCAG 2.1 livello AA** in tutte le pagine pubbliche.
- **RNF-A2** Navigazione completa da tastiera (tutte le funzionalità principali).
- **RNF-A3** Compatibilità con screen reader (testato con NVDA, VoiceOver, Orca).
- **RNF-A4** Contrasto testo/sfondo ≥ 4.5:1 per testi normali, ≥ 3:1 per testi grandi.
- **RNF-A5** Rispetto di `prefers-reduced-motion` per utenti con sensibilità al movimento.
- **RNF-A6** Fallback testuali/tabulari per tutti i grafici.

#### 2.2.5 Usabilità (RNF-U)

- **RNF-U1** Interfaccia responsive funzionante su viewport da 360 px in su.
- **RNF-U2** Profondità di navigazione massima di 3 click per raggiungere le funzioni principali dalla homepage.
- **RNF-U3** Messaggi di errore espliciti, localizzati, orientati all'azione correttiva.

#### 2.2.6 Manutenibilità (RNF-M)

- **RNF-M1** Codice commentato secondo standard JSDoc per il backend e commenti esplicativi per HTML/CSS/JS del frontend.
- **RNF-M2** Separazione dei livelli (presentazione / logica / dati) e dei token di design (CSS custom properties).
- **RNF-M3** Schema DB versionato tramite migrazioni (es. Flyway, Knex migrations).

---

## 3. Architettura e tecnologie

### 3.1 Visione d'insieme

L'architettura è a tre livelli, con frontend disaccoppiato dal backend via API REST e storage separato per gli asset binari:

```
┌───────────────────────────────────────────────────────────────┐
│                         BROWSER UTENTE                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │   HTML5 + CSS3 + JS vanilla / progressive enhancement    │ │
│  │   Leaflet (mappe)   Chart.js (grafici)                   │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────┬───────────────────────────────────┘
                            │  HTTPS / REST / JSON
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                  APPLICATION SERVER (Node.js)                 │
│                                                               │
│   Express 4 · JWT auth · Sharp · Zod validation · Pino logs   │
│                                                               │
└────────┬──────────────────────────────────┬───────────────────┘
         │                                  │
         ▼                                  ▼
┌──────────────────────┐         ┌──────────────────────────────┐
│   PostgreSQL 15 +    │         │   Object storage (S3)        │
│   PostGIS 3.3        │         │   copertine + miniature      │
└──────────────────────┘         └──────────────────────────────┘
```

### 3.2 Scelte tecnologiche motivate

#### 3.2.1 Frontend

La scelta di un **frontend senza framework** (HTML semantico + CSS + JS vanilla) è stata deliberata:

- *Carico cognitivo ridotto per chi legge e mantiene il codice*: non occorre conoscere React, Vue, Angular.
- *Zero build toolchain*: nessun webpack, vite, bundler. Il codice che si scrive è quello che viene servito.
- *Accessibilità di default*: lavorando con HTML semantico si evita il rischio tipico di SPA (landmark ARIA mancanti, heading non gerarchici, focus management rotto dai router client-side).
- *Performance*: il payload JS totale del prototipo è sotto i 50 KB (escluse le librerie Leaflet e Chart.js, caricate solo dove servono).

Laddove si volesse in futuro introdurre interattività più complessa (es. chat real-time tra utenti), una scelta coerente sarebbe **HTMX** o piccole isole di reattività (Alpine.js, Preact tramite `htm`), mantenendo il principio di *progressive enhancement*.

#### 3.2.2 Backend (architettura di riferimento)

- **Node.js 20 LTS + Express**: runtime maturo, ottimo per API I/O-bound, ecosistema ampio (in particolare per gestione immagini e PostgreSQL).
- **Zod** per la validazione degli schemi di input e tipizzazione runtime.
- **Pino** per il logging strutturato JSON, adatto all'aggregazione centralizzata.
- **Sharp** per la generazione delle varianti di immagine (original → large 800px → medium 400px → thumb 160px) al momento dell'upload, con output WebP.

#### 3.2.3 Database: PostgreSQL + PostGIS

PostgreSQL è la scelta naturale quando l'applicazione richiede:

- **Dati geospaziali di qualità produttiva**: PostGIS è maturo, offre indici GIST, supporto nativo al tipo `geography` su ellissoide terrestre, funzioni come `ST_DWithin` ottimizzate.
- **Ricerca testuale**: l'estensione `pg_trgm` fornisce indici GIN trigram per *fuzzy matching* senza dover introdurre un motore esterno (ElasticSearch/Meilisearch) finché i volumi lo permettono.
- **Integrità forte**: vincoli `CHECK`, enum, `FOREIGN KEY`, transazioni ACID.
- **Estensibilità**: `pgcrypto` per UUID, `uuid-ossp`, eventualmente `citext` per email case-insensitive.

Un confronto sintetico con le alternative considerate:

| Opzione | Pro | Contro |
|---|---|---|
| **PostgreSQL + PostGIS** ✓ | Geospatial nativo, full-text, ACID, open source | Più complesso di SQLite per setup iniziale |
| MySQL + spatial | Diffusione | Supporto GIS meno ricco, pg_trgm assente |
| MongoDB + geo queries | Flessibilità schema | ACID debole sui dataset, maturità GIS limitata |
| SQLite + spatialite | Zero-config | Non adatto a deploy multi-utente |

#### 3.2.4 Storage immagini

Le immagini **non vanno nel database** (il che gonfia i backup e degrada le query). L'approccio scelto:

1. Upload multipart → server validazione → **Sharp** genera 4 varianti → push su **object storage S3-compatibile**.
2. Nel DB si memorizzano solo i riferimenti (`book_images.url`, metadati: `width`, `height`, `mime_type`, `size_bytes`).
3. Servizio tramite CDN in produzione (Cloudflare, AWS CloudFront) con cache aggressiva basata su URL immutabili.

In ambiente di sviluppo si usa **MinIO** (S3-compatibile, self-hosted via Docker). In produzione AWS S3, Backblaze B2 o Scaleway Object Storage a seconda del vincolo geografico sui dati (per i clienti UE si privilegiano provider con data center in UE).

### 3.3 Gestione geospaziale

#### 3.3.1 Modello

La posizione degli utenti è rappresentata come `GEOGRAPHY(POINT, 4326)` (WGS84), il sistema di riferimento standard per coordinate web. Questo consente di usare funzioni come `ST_DWithin(geography_1, geography_2, radius_metri)` ottenendo risultati corretti sulla superficie terrestre, senza dover passare per proiezioni locali.

Un indice **GIST** su `users.location` rende la ricerca spaziale efficiente anche con milioni di record.

#### 3.3.2 Query di ricerca spaziale

La funzione `find_books_within(lat, lng, radius_m)` incapsula la logica:

```sql
SELECT b.id, b.title, b.author,
       ST_Distance(u.location, ST_MakePoint(lng, lat)::geography) AS distance_m
FROM books b
JOIN users u ON u.id = b.owner_id
WHERE b.status = 'active'
  AND b.available = TRUE
  AND u.status = 'active'
  AND ST_DWithin(u.location, ST_MakePoint(lng, lat)::geography, radius_m)
ORDER BY distance_m;
```

Dal lato prototipo (client-side) la stessa logica è simulata in JavaScript con la formula di Haversine (cfr. `js/app.js`, funzione `haversineDistance`).

#### 3.3.3 Fuzzificazione della posizione

La posizione precisa dell'utente **non deve mai** essere esposta pubblicamente a meno di consenso esplicito (livello 3). La view `v_public_books` applica automaticamente la fuzzificazione:

- Livello 0 (nascosta): la posizione non viene restituita.
- Livello 1 (solo città): si restituisce il centroide della città dichiarata.
- Livello 2 (zona ±200 m): `ST_SnapToGrid` con cella di ~200 m sposta il punto sul nodo di griglia più vicino.
- Livello 3 (precisa): la posizione è restituita così com'è.

Questo approccio è *difensivo*: anche se un bug nell'applicazione esponesse inavvertitamente la colonna, la view applicherebbe comunque la trasformazione.

### 3.4 Deploy e operatività

| Ambiente | Componenti | Note |
|---|---|---|
| **Sviluppo** | Docker Compose con servizi: app, postgres, minio, mailhog | Reset rapido, dati di seed, hot reload |
| **Staging** | Kubernetes o PaaS (Render, Fly.io) | Dati anonimizzati, integrazione con CI/CD |
| **Produzione** | Kubernetes + PostgreSQL managed + object storage + CDN | Backup incrementali giornalieri, logging aggregato |

Pipeline CI/CD di riferimento (GitHub Actions):
1. Lint (ESLint + Stylelint + htmlhint).
2. Test unitari e di integrazione (Jest + Supertest).
3. Test end-to-end smoke (Playwright) sulle funzionalità critiche.
4. Build immagine Docker.
5. Deploy automatico in staging, manuale in produzione.

---

## 4. Scelte di design UX e accessibilità

### 4.1 Identità visiva

Il design si allontana deliberatamente dall'estetica generica comune alle piattaforme "tech": l'oggetto del progetto (libri, patrimonio culturale, tradizione letteraria) chiede un linguaggio visivo **editoriale**, ispirato alla tradizione tipografica della stampa.

**Palette cromatica**:

- `--color-paper` `#f4efe6` — carta panna (sfondo principale)
- `--color-ink` `#1a1512` — inchiostro profondo (testo primario)
- `--color-burgundy` `#7a1e2b` — bordeaux (accento, link, azioni primarie)
- `--color-gold` `#b08840` — oro antico (accenti decorativi, metriche)
- `--color-sage` `#6e7a5a` — salvia (successo, conferme)

I colori sono stati scelti per:
1. Contrasto conforme **WCAG AA** (ogni coppia testo/sfondo è stata verificata).
2. Associazioni culturali coerenti con il dominio (il bordeaux dei fondi antichi, l'oro della tipografia d'epoca).
3. Leggibilità confortevole in sessioni prolungate (niente bianco puro che stanca la vista).

**Tipografia a tre famiglie**:

- **Cormorant Garamond** (serif display) per titoli e heading — richiamo alla tradizione del Garamond francese, ampiamente usato nell'editoria letteraria.
- **Fraunces** (serif testo, variable font) per corpo del testo — buona leggibilità su schermo, pensato per l'era digitale.
- **JetBrains Mono** (monospace) per ISBN, codici, metadati tecnici.

### 4.2 Architettura dell'informazione

La gerarchia di navigazione è deliberatamente piatta: dall'homepage si raggiunge qualsiasi funzione in **1–2 click**. Le pagine principali sono:

1. **Home** — panoramica + libri in evidenza + categorie.
2. **Esplora** — ricerca + mappa.
3. **Aggiungi libro** — pubblicazione.
4. **Profilo** — area personale.
5. **Statistiche** — metriche pubbliche.
6. **Admin** — dashboard moderazione (solo ruoli `admin`/`moderator`).

Le pagine contestuali (dettaglio libro, login, registrazione) non appaiono nella navigazione primaria per non saturarla.

### 4.3 Accessibilità

L'accessibilità è stata un vincolo di progettazione, non un *afterthought*.

#### 4.3.1 Semantica e struttura

Ogni pagina rispetta la struttura:

```html
<body>
  <a class="skip-link" href="#main">Salta al contenuto principale</a>
  <header><nav><!-- landmark nav --></nav></header>
  <main id="main"><!-- contenuto principale --></main>
  <footer><!-- landmark contentinfo --></footer>
</body>
```

Le heading seguono una gerarchia corretta (`h1` unico per pagina, poi `h2`/`h3` annidati logicamente). Le liste (`<ul>`, `<ol>`) sono usate per tutti gli insiemi di elementi; i form usano `<label>` collegati a `<input>` via `for`/`id`.

#### 4.3.2 Componenti interattivi

- **Tablist del profilo**: implementata con `role="tablist"`/`role="tab"`/`role="tabpanel"`, `aria-selected`, `aria-controls`, gestione delle frecce direzionali da tastiera.
- **Dialog di richiesta prestito**: usa l'elemento nativo `<dialog>`, che gestisce correttamente il focus trap, la chiusura con `Esc` e l'annuncio dello screen reader senza bisogno di ARIA manuale.
- **Messaggi toast**: usano `role="status"` / `aria-live="polite"` per essere annunciati dai lettori di schermo senza interrompere l'utente.
- **Icone decorative** (SVG senza significato semantico) hanno `aria-hidden="true"`.
- **Icone informative** hanno `aria-label` descrittiva.

#### 4.3.3 Focus e tastiera

- **Skip link** in ogni pagina, visibile al focus.
- `:focus-visible` applica un outline contrastato (2 px solido bordeaux) solo quando l'utente naviga da tastiera, senza disturbare l'utente mouse.
- Tab-order è quello naturale del DOM (si evita `tabindex` > 0).
- Tutti gli elementi interattivi sono raggiungibili e attivabili da tastiera (`Enter`, `Space` sui bottoni; `Enter` sui link).

#### 4.3.4 Movimento ridotto

Le animazioni (transizioni di hover, fade-in della mappa) sono disattivate via CSS media query per utenti con `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### 4.3.5 Fallback per i grafici

Chart.js produce `<canvas>` che non è accessibile di default ai lettori di schermo. La soluzione adottata è un **fallback tabellare** racchiuso in `<details>`:

```html
<section aria-labelledby="stats-views">
  <h2 id="stats-views">Visualizzazioni nel tempo</h2>
  <canvas id="views-chart" aria-label="Grafico ..."></canvas>
  <details>
    <summary>Visualizza dati in formato tabellare</summary>
    <table>...</table>
  </details>
</section>
```

Gli utenti di screen reader ottengono i dati in forma tabulare strutturata, mentre gli utenti visivi vedono il grafico; la modalità non è nascosta a nessuno (pattern *inclusive by default*).

#### 4.3.6 Contenuti non testuali

- Ogni immagine ha `alt` significativa o `alt=""` se puramente decorativa.
- Le copertine dei libri nel prototipo sono rese con gradient CSS (non immagini raster) per evitare miniature mancanti; in produzione l'`alt` sarà *"Copertina di [titolo] di [autore]"*.
- Le mappe Leaflet sono accompagnate da una lista testuale dei luoghi come alternativa equivalente.

### 4.4 Pattern UX specifici

#### 4.4.1 Controllo della privacy come cittadino di prima classe

Le impostazioni di privacy non sono sepolte in un sotto-menu: la tab "Impostazioni" del profilo espone esplicitamente:

- Visibilità del profilo (pubblico / solo registrati / privato).
- **Slider visuale** per la precisione della geolocalizzazione (con spiegazione testuale di cosa significa ogni livello).
- Tre azioni GDPR in evidenza: *Esporta i miei dati*, *Rettifica informazioni*, *Cancella account*.

Questa scelta riflette il principio **"privacy as a feature"**: l'utente deve percepire il controllo sui propri dati come una caratteristica di valore, non come un vincolo legale nascosto.

#### 4.4.2 Richiesta di prestito con consenso esplicito

Il form di richiesta prestito include una checkbox **obbligatoria, non pre-compilata** che richiede il consenso alla condivisione dei dati di contatto con il proprietario del libro. Senza quella spunta, il pulsante d'invio resta disabilitato. Il testo è chiaro e orientato all'azione: *"Acconsento a condividere il mio indirizzo email con il proprietario del libro ai soli fini della richiesta di prestito."*

#### 4.4.3 Feedback immediato

Ogni azione ha un feedback visuale e, dove appropriato, un annuncio accessibile:

- Upload copertina → anteprima immediata + conferma testuale.
- Richiesta prestito inviata → toast "Richiesta inviata a [nome]".
- Errore di validazione → messaggio inline sotto il campo, con `aria-describedby` sul campo stesso.

#### 4.4.4 Responsive design

Il layout è responsive con breakpoint a **1024 px** (tablet) e **768 px** (mobile). Le scelte chiave:

- Navigazione: su mobile si collassa in un menu a tendina.
- Griglie di libri: 4 → 3 → 2 → 1 colonna a seconda della larghezza.
- Mappa: su mobile occupa l'intera larghezza e ha altezza fissa di 50vh.
- Tabelle: scrollabili orizzontalmente con indicazione visiva del bordo.

---

## 5. Limiti attuali e sviluppi futuri

### 5.1 Limiti del prototipo

- **Persistenza locale**: il prototipo usa `localStorage`, quindi i dati non sono condivisi tra utenti né tra dispositivi. L'implementazione del backend è descritta ma non eseguita in questa iterazione.
- **Geocodifica assente**: l'indirizzo dell'utente non è geocodificato automaticamente; le coordinate sono precompilate nei dati di seed.
- **Nessuna messaggistica diretta**: la comunicazione tra utenti avviene via email una volta accettata la richiesta, non in-app.
- **Internazionalizzazione**: il prototipo è monolingua (italiano); in produzione è prevista l'estrazione delle stringhe e l'uso di un sistema i18n (es. `i18next`).

### 5.2 Estensioni previste

1. **Integrazione con API bibliografiche** (Google Books, OpenLibrary, SBN) per precompilare i metadati a partire dall'ISBN.
2. **Clustering intelligente dei marker** sulla mappa per gestire densità elevate.
3. **Sistema di recensioni e valutazioni** tra utenti (dopo un prestito completato).
4. **Gruppi tematici** (circoli di lettura virtuali) con librerie condivise.
5. **App mobile** progressiva (PWA) con cache offline delle ricerche più frequenti.
6. **Moderazione automatica** con filtri per segnalazioni ripetute e classificatore di contenuti inappropriati.

### 5.3 Considerazioni etiche e di sostenibilità

Una piattaforma che mappa il patrimonio culturale privato va progettata con consapevolezza:

- **Rischio di commercializzazione**: se la piattaforma diventa un canale di vendita dell'usato si perde la dimensione di scambio culturale. Il termine "prestito" e il divieto esplicito di transazioni commerciali nei termini di servizio sono scelte deliberate.
- **Rischio di esclusione digitale**: chi non ha accesso a smartphone o connessione resta fuori. Possibili mitigazioni: partnership con biblioteche pubbliche come punti di inserimento assistito.
- **Rischio di sorveglianza comunitaria**: aggregare dati su "chi possiede cosa" crea informazioni sensibili. La fuzzificazione della posizione di default e la policy di visibilità sono le contromisure principali.

---

## 6. Conclusioni

*Libreria Diffusa* dimostra che è possibile costruire uno strumento di condivisione culturale di prossimità con tecnologie web consolidate e con un approccio rigoroso ad accessibilità e privacy. Il prototipo implementato copre il percorso utente completo — dalla registrazione alla richiesta di prestito — e pone le basi per un'evoluzione verso un sistema in produzione.

Il progetto è pensato come riferimento replicabile: il codice sorgente, lo schema dati e la documentazione sono distribuiti con licenza libera per consentirne l'adattamento ad altre città, quartieri, comunità tematiche o istituzioni culturali.

---

## Riferimenti

- Regolamento (UE) 2016/679 — GDPR.
- W3C, *Web Content Accessibility Guidelines (WCAG) 2.1* — W3C Recommendation.
- Nielsen Norman Group, *10 Usability Heuristics for User Interface Design*.
- PostGIS Development Team, *PostGIS Reference Manual* (versione 3.3).
- ISTAT, *La lettura in Italia* — rapporto annuale.
- Shneiderman B., Plaisant C., *Designing the User Interface*, Pearson.

---

*Documento redatto nell'ambito del progetto didattico Libreria Diffusa — v0.1.0*
