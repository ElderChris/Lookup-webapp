# Rapporto tecnico — Lookup

**Software di geolocalizzazione culturale per la condivisione del patrimonio librario privato**

Versione: 1.0.0 — Maggio 2026

---

## Sommario esecutivo

Il progetto *Lookup* risponde all'esigenza di dare visibilità al piccolo patrimonio librario privato — collezioni personali, biblioteche domestiche, raccolte tematiche — che oggi resta in larga parte inaccessibile alla comunità dei lettori. La piattaforma consente agli utenti di pubblicare, geolocalizzare e condividere i propri libri secondo politiche di privacy granulari, facilitando l'incontro tra chi possiede e chi cerca un'opera all'interno di un territorio circoscritto.

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

#### 2.1.6 Personalizzazione del profilo (RF-P) — *introdotti in v0.2*

- **RF-P1** Il sistema deve offrire una **pagina dedicata** alla creazione e personalizzazione del profilo, separata dalla gestione della libreria, accessibile da un link in evidenza nella navigazione principale.
- **RF-P2** L'utente deve poter scegliere fra almeno **quattro modalità di visualizzazione** della propria libreria: griglia di copertine, elenco, scaffale (dorsi verticali), cronologia per anno di pubblicazione.
- **RF-P3** L'utente deve poter scegliere fra almeno **quattro temi cromatici** che colorano gli accenti del proprio profilo (avatar, intestazioni, link).
- **RF-P4** L'utente deve poter scegliere lo **stile dell'avatar**: iniziale del nome o glifo tipografico (§, ¶, ❦, ✦, ❧, ∴).
- **RF-P5** L'utente deve poter inserire un **motto** (citazione personale, max 120 caratteri) visibile sul profilo pubblico.
- **RF-P6** L'utente deve poter selezionare l'**ordinamento predefinito** della propria libreria (più recente, titolo, autore, anno).
- **RF-P7** La pagina deve includere un'**anteprima dal vivo** delle scelte: ogni cambio di tema, modalità o avatar deve riflettersi immediatamente in un pannello di anteprima senza richiedere il salvataggio.
- **RF-P8** Tutte le scelte di personalizzazione devono essere modificabili in ogni momento e persistite per utente.

#### 2.1.7 Esperienza guest vs. autenticata (RF-G) — *introdotti in v0.2*

- **RF-G1** La homepage deve adattarsi allo stato di autenticazione: utenti autenticati vedono saluto personalizzato, link a "Pubblica" e "Personalizza"; utenti guest vedono CTA di registrazione e accesso.
- **RF-G2** Il prototipo include un **toggle didattico** in cima alla home che simula entrambi gli stati per permettere la verifica del comportamento senza dover effettuare login/logout. In produzione lo stato è derivato dal token di sessione e questo controllo non è esposto.
- **RF-G3** La validazione della pubblicazione di un libro deve essere **in tempo reale**: ogni campo del modulo deve segnalare visivamente (bordo verde / rosso) e testualmente la validità del valore inserito, senza attendere il submit.

#### 2.1.8 Homepage di scoperta e ingaggio (RF-H) — *introdotti in v0.3*

- **RF-H1** La homepage deve esporre, in posizione di apertura accanto al titolo, le metriche aggregate della piattaforma (volumi pubblicati, lettori iscritti, categorie, consultazioni totali) in forma compatta.
- **RF-H2** Le metriche devono essere **animate**: i contatori si incrementano periodicamente con piccoli scatti, simulando la crescita della piattaforma in tempo reale. È un meccanismo di *gamification* (riprova sociale, senso di slancio). In produzione gli incrementi sono alimentati da un canale realtime; nel prototipo sono simulati lato client.
- **RF-H3** La homepage deve presentare una sezione **"Librerie vicino a te"** che elenca le collezioni della comunità ordinate per un punteggio composito di **prossimità** (distanza dalla posizione di riferimento) e **attività** (numero di volumi disponibili al prestito e recenza delle pubblicazioni).
- **RF-H4** Ogni libreria nella sezione deve mostrare in modo immediatamente visibile: nome personalizzato, breve descrizione, luogo, distanza dichiarata in linguaggio naturale ("a X km da te"), numero di volumi disponibili al prestito.
- **RF-H5** Ogni libreria deve avere una **copertina generata automaticamente** dal sistema a partire dalle scelte di personalizzazione del curatore (tema cromatico e glifo/iniziale dell'avatar). La copertina non è un'immagine caricata ma un artefatto procedurale.
- **RF-H6** La posizione di riferimento per il calcolo delle distanze è quella dell'utente autenticato; per i visitatori anonimi è una posizione simulata, dichiarata esplicitamente all'utente.

#### 2.1.9 Libreria come oggetto di prima classe (RF-B) — *introdotti in v0.4*

- **RF-B1** Una **libreria** è l'astrazione della raccolta di volumi di un membro della comunità. Può essere una collezione personale di un lettore oppure il fondo di un ente che mette i propri libri a disposizione per il prestito.
- **RF-B2** Il sistema deve esporre per ogni libreria una **pagina pubblica dedicata** (`library.html?id=X`) accessibile a chiunque, che presenta: copertina generata, informazioni di base, statistiche (totale volumi, disponibili, consultazioni), pannello informativo dell'ente (se applicabile) ed elenco dei volumi nella modalità di visualizzazione scelta dal curatore.
- **RF-B3** Il visitatore della pagina pubblica deve poter cambiare la modalità di visualizzazione (griglia, elenco, scaffale, cronologia) tramite un selettore, restando comunque informato della preferenza di default del curatore.

#### 2.1.10 Account-organizzazione (RF-O) — *introdotti in v0.4*

- **RF-O1** Il sistema deve supportare due tipi di account: **persona** (default) e **ente** (organizzazione). Il tipo è scelto in fase di registrazione e non è modificabile in seguito senza intervento amministrativo.
- **RF-O2** Per le librerie-ente il sistema raccoglie un set esteso di informazioni: **denominazione ufficiale**, **categoria di ente** (biblioteca, associazione, libreria indipendente, centro culturale, scuola, altro), **referente**, **sito web**, **email pubblica**, **telefono pubblico**, **indirizzo pubblico**, **orari di apertura**.
- **RF-O3** Per gli enti l'indirizzo è **pubblico per definizione** (livello di precisione 3): un ente ha senso di esistere sulla piattaforma solo se è raggiungibile fisicamente.
- **RF-O4** Le card di libreria nella home e nelle ricerche distinguono visivamente le librerie-ente dalle personali (badge "Libreria personale" oppure categoria specifica dell'ente).

#### 2.1.11 Creazione di nuovi utenti e onboarding (RF-N) — *introdotti in v0.4*

- **RF-N1** La pagina `register.html` deve permettere la **creazione effettiva** di un nuovo utente/libreria, persistendone i dati in modo da renderlo visibile in tutto il resto dell'applicazione (sezione "vicino a te", ricerche, pagina libreria).
- **RF-N2** La registrazione è strutturata come **wizard in tre passi**:
  1. **Tipo e accesso**: scelta persona/ente, credenziali, e — se ente — il set di dati specifici (denominazione, categoria, referente, contatti, indirizzo, orari).
  2. **La tua libreria**: descrizione, città, motto, tema cromatico, consensi GDPR.
  3. **Primi volumi**: aggiunta inline di almeno un volume per dare vita alla libreria.
- **RF-N3** Al completamento del wizard, l'utente è automaticamente loggato come la nuova libreria e reindirizzato alla propria pagina pubblica.

#### 2.1.12 Protezione della proprietà (RF-W) — *introdotti in v0.4*

- **RF-W1** Un utente può modificare **esclusivamente la propria libreria**: il proprio profilo, le proprie preferenze di personalizzazione, i propri volumi. Non può in nessun caso modificare quelli di un altro utente.
- **RF-W2** Tutte le pagine di gestione (`profile.html`, `profile-setup.html`, `add-book.html`) richiedono autenticazione e si applicano sempre e solo all'utente corrente. Un tentativo di accedere alla gestione di una libreria altrui (es. `profile.html?user=X` con X diverso da sé) deve essere reindirizzato alla vista pubblica (`library.html?id=X`).
- **RF-W3** L'API espone un helper `canEdit(userId)` e una funzione `updateUser` che solleva eccezione in caso di tentativo non autorizzato. In produzione lo stesso controllo deve essere ridondato lato server, mai delegato al solo frontend.
- **RF-W4** La pagina pubblica della libreria deve indicare visibilmente la condizione di proprietà: per il proprietario un banner con i link alle pagine di gestione; per i visitatori un banner di sola lettura che dichiari espressamente che la vista non è modificabile.

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

#### 3.3.4 Tabella `user_preferences` (v0.2)

Per supportare la pagina di personalizzazione del profilo è stata introdotta una tabella separata `user_preferences` in relazione 1:1 con `users`. La separazione è motivata da:

1. **Cadenza di modifica diversa**: le preferenze estetiche cambiano molto più spesso dei dati identificativi. Tenerle in una tabella distinta riduce il churn della tabella `users` e mantiene leggeri i log di audit.
2. **Dati non critici**: nessun valore di sicurezza o privacy strutturale risiede qui (la `location_precision` resta in `users`). Le preferenze possono essere reimpostate senza intaccare l'integrità del profilo.
3. **Separation of concerns**: l'identità dell'utente è una cosa, la sua "scrivania" un'altra.

La tabella usa vincoli `CHECK` con enum esplicite per `view_mode` (`grid|list|shelf|timeline`), `theme` (`classic|bordeaux|sage|midnight`), `avatar_style` (`initials|symbol`), `sort_by`, garantendo integrità a livello schema senza dover ricorrere a tabelle di lookup. Il trigger `trg_update_timestamp()` è riutilizzato per mantenere `updated_at` aggiornato.

In produzione, un'alternativa tecnicamente equivalente sarebbe l'uso di una colonna `JSONB preferences` direttamente in `users`. La scelta della tabella separata è preferita per la possibilità di indicizzare in modo selettivo singoli campi (es. `theme` per statistiche aggregate) e per la chiarezza dello schema in fase di evoluzione.

#### 3.3.5 Modello persona/ente: la tabella `organization_profiles` (v0.4)

Una libreria su Lookup può essere curata da una persona (un lettore con una collezione privata) o da un ente (una biblioteca di quartiere, un'associazione culturale, una libreria indipendente, un centro culturale, una scuola). I due tipi condividono la maggior parte delle informazioni — credenziali, posizione, biografia/descrizione, preferenze di personalizzazione — ma gli enti hanno bisogno di un set aggiuntivo di campi che per le persone non avrebbero senso (denominazione ufficiale, categoria di ente, referente, sito web, contatti pubblici, indirizzo pubblico, orari di apertura).

Lo schema risolve questa eterogeneità con due elementi:

1. **Una colonna discriminante in `users`**: `account_type VARCHAR(20) NOT NULL DEFAULT 'person' CHECK (account_type IN ('person','organization'))`. Il valore di default è `'person'` perché statisticamente sarà la grande maggioranza degli account; il `CHECK` impedisce valori arbitrari.
2. **Una tabella satellite `organization_profiles`** in relazione 1:1 con `users` (chiave primaria = chiave esterna verso `users.id`, `ON DELETE CASCADE`), popolata **solo** per gli account `'organization'`. Contiene `legal_name`, `org_category` (enum controllata via `CHECK`), `contact_person`, `website`, `public_email`, `public_phone`, `public_address`, `opening_hours`.

Il pattern è lo stesso applicato a `user_preferences`: separazione *one-to-zero-or-one* per evitare di gonfiare la tabella principale con colonne quasi sempre NULL e per mantenere la chiarezza dello schema. È stato preferito a un'alternativa basata su JSONB perché i campi degli enti sono in numero limitato e ben noti — i vantaggi del JSONB (schema-less) sarebbero qui solo svantaggi (perdita di vincoli di tipo, indici meno efficaci, query più ostiche).

**Vincolo di coerenza**: PostgreSQL non consente di scrivere un `CHECK` che interroghi un'altra tabella. Per garantire che una riga in `organization_profiles` esista solo se l'utente collegato ha effettivamente `account_type = 'organization'`, lo schema definisce un trigger `BEFORE INSERT OR UPDATE` (`trg_check_account_is_org`) che solleva eccezione altrimenti. È un esempio di vincolo di integrità referenziale "esteso" — più complesso di una semplice FK ma necessario per esprimere una regola di dominio non riducibile a valori della singola riga.

**Distinzione del livello di privacy**: per le persone la posizione è di default fuzzificata a livello 2 (±200 m); per gli enti viene impostata a livello 3 (precisa), e `email_visible` è di default `TRUE`. La motivazione è semantica, non tecnica: una persona ha diritto alla riservatezza della propria abitazione, un ente ha la *necessità* di essere localizzato per assolvere alla propria funzione.

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

### 3.5 Gestione della cache degli asset statici

Durante lo sviluppo del prototipo è emerso un comportamento istruttivo: servendo il sito con `python -m http.server`, alcune modifiche a CSS e JavaScript non si riflettevano nel browser, mentre aprendo i file direttamente via `file://` erano subito visibili. La causa è la **cache euristica** del browser.

Il server di sviluppo `http.server` invia l'intestazione `Last-Modified` ma non `Cache-Control` né `Expires`. In assenza di direttive esplicite, i browser applicano una cache euristica: conservano la risorsa e, per una finestra temporale stimata, la servono *senza nemmeno ricontattare il server*. Il risultato è che una versione obsoleta di `styles.css` o `app.js` può continuare a essere usata anche dopo che il file su disco è cambiato. Con il protocollo `file://` l'origine è diversa (cache partizionata per origine) e i browser tendono a rileggere i file dal disco, motivo per cui lì il problema non si manifesta.

Il prototipo adotta due contromisure, entrambe pratiche standard in produzione:

1. **Cache-busting tramite versione nell'URL** — i riferimenti agli asset includono un parametro di query con la versione, es. `css/styles.css?v=0.3.0`. Quando la versione cambia, cambia l'URL e il browser è obbligato a scaricare la risorsa aggiornata. In produzione questo si automatizza con un hash del contenuto nel nome del file (`styles.4f3a9c.css`), generato dal bundler.
2. **Server di sviluppo con cache disabilitata** — il repository include `no-cache-server.py`, un server statico che estende `SimpleHTTPRequestHandler` aggiungendo `Cache-Control: no-store` a ogni risposta, eliminando il problema alla radice durante lo sviluppo.

La lezione generale: la cache è indispensabile per le prestazioni in produzione, ma va governata esplicitamente. La strategia corretta è *cache aggressiva con invalidazione per versione* — file con nomi versionati e header `Cache-Control: immutable`, così il browser può cacheare a tempo indeterminato sapendo che un cambiamento di contenuto produrrà sempre un URL nuovo.

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

**Larghezza di riga e respiro del layout** — dalla v0.3 la larghezza massima del contenitore principale è stata ridotta a 1140 px e il margine orizzontale interno ampliato. La scelta nasce da un principio tipografico: su monitor larghi un contenitore troppo esteso porta righe di testo lunghe (oltre le ~75 battute consigliate) e fa "toccare" il contenuto ai bordi della finestra, riducendo la leggibilità e l'eleganza editoriale. Un contenitore più raccolto e otticamente centrato mantiene la misura di riga in un intervallo confortevole su tutte le dimensioni di schermo. I margini si riducono progressivamente sui breakpoint tablet e mobile per non sprecare spazio dove è prezioso.

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

### 4.5 Personalizzazione del profilo (v0.2)

Una piattaforma di condivisione culturale non è solo una directory di oggetti: è anche uno spazio in cui le persone si rappresentano. Per questo nella seconda iterazione del prototipo è stata introdotta una pagina dedicata alla creazione e personalizzazione del profilo (`profile-setup.html`), distinta dalla gestione operativa della libreria (`profile.html`).

#### 4.5.1 Modello a due colonne con anteprima persistente

La pagina è strutturata su una griglia a due colonne:

- **Colonna sinistra (sticky)**: anteprima del profilo come apparirebbe agli altri utenti, con avatar, nome, motto, conteggio volumi e visualizzazioni.
- **Colonna destra**: sezioni accordion per Identità, Avatar, Tema, Visualizzazione libreria, Privacy.

Ogni modifica nella colonna destra aggiorna immediatamente l'anteprima a sinistra senza richiedere il salvataggio. Questa scelta riduce l'attrito dell'editing — l'utente vede in tempo reale l'effetto delle proprie scelte — e segue il principio di *visibility of system status* (Nielsen).

Su mobile la griglia diventa a una colonna e l'anteprima perde la sticky position per non rubare spazio verticale.

#### 4.5.2 Quattro modalità di visualizzazione della libreria

Le quattro modalità sono pensate come *codici di lettura* diversi, non come opzioni intercambiabili:

| Modalità | Quando ha senso | Caratterizzazione visiva |
|---|---|---|
| **Griglia** | Default. Collezioni con copertine importanti (arte, fotografia). | Card 2:3 con copertina dominante. |
| **Elenco** | Cataloghi voluminosi dove serve scorrere rapidamente metadati. | Riga compatta con miniatura, autore, anno, condizione. |
| **Scaffale** | Collezioni curate dove i dorsi sono parte dell'identità (libri d'epoca, edizioni numerate). | Dorsi verticali colorati con titolo ruotato, scroll orizzontale. |
| **Cronologia** | Collezioni storiche dove l'asse temporale racconta una narrazione. | Timeline verticale con anno in evidenza, raggruppamento implicito per epoca. |

Ogni modalità è realizzata in CSS con tecniche di layout differenti (grid per la griglia, grid a colonne fisse per l'elenco, flex con `writing-mode: vertical-rl` per lo scaffale, pseudo-elementi e bordi per la timeline) e mantiene gli stessi token di design del resto della piattaforma per garantire coerenza estetica.

#### 4.5.3 Quattro temi cromatici

I temi non sono mere colorazioni: ognuno proietta un'identità editoriale specifica.

- **Classico** — bordeaux + oro: lo stile di base, evoca cataloghi antichi.
- **Bordeaux** — rosso scuro + bruno: tono più severo, adatto a biblioteche serie.
- **Salvia** — verde + oro: tono pastorale, adatto a poesia, narrativa naturalistica.
- **Notturno** — nero + verde scuro: tono cyberpunk/distopico, adatto a fantascienza, noir.

Lo swatch è un cerchio che mostra il gradient di anteprima e usa il pattern `:has(input:checked)` (CSS moderno, supportato da Chromium 105+, Safari 15.4+, Firefox 121+) per evidenziare la selezione senza JavaScript.

#### 4.5.4 Validazione live nel modulo di pubblicazione

Il modulo di pubblicazione di un libro è stato esteso con validazione **in tempo reale**. Le scelte chiave:

- **Nessun feedback prima del primo blur** — la classe `.touched` viene aggiunta al primo blur del campo, evitando di colorare di rosso campi che l'utente non ha ancora compilato (anti-pattern noto di molte UI).
- **Feedback visivo + testuale** — bordo colorato (verde/rosso), icona di check/error in basso a destra, messaggio inline sotto il campo. Il messaggio è in italiano e specifico (es. "Ancora 5 caratteri al minimo richiesto" invece del generico "Campo non valido").
- **Riepilogo accessibile al submit** — se l'utente tenta di inviare il modulo con errori, viene mostrato un blocco di alert con la lista degli errori (annunciato dagli screen reader via `role="alert"`) e si scorre alla sezione.
- **Regole personalizzate** — la funzione `UI.attachLiveValidation(form, customRules)` accetta un dizionario di regole aggiuntive per nome di campo, restituendo `true` o un messaggio d'errore personalizzato.

#### 4.5.5 Toggle didattico dello stato di autenticazione

Per facilitare la verifica del comportamento del sito da parte di un nuovo visitatore senza dover effettuare logout, la home espone un piccolo controllo *toggle* in cima alla pagina che alterna tra "visita autenticata" e "visita anonima". Lo stato è memorizzato in `localStorage` e viene riflesso da un attributo `data-auth-state` sul `<body>`. Le sezioni con classe `.auth-only` o `.guest-only` sono mostrate o nascoste via CSS in base a questo attributo.

In produzione questo controllo non è esposto: lo stato di autenticazione è dedotto esclusivamente dal token JWT verificato dal backend. Si tratta dunque di un dispositivo *didattico*, dichiarato come tale nelle interazioni con l'utente (label esplicita, voce nel rapporto tecnico).

### 4.6 Vetrina delle librerie della comunità (v0.2)

In questa iterazione la sezione "Esplora per categoria" della homepage è stata sostituita dalla **vetrina delle librerie**: ogni utente è rappresentato da una card che mostra avatar, città, biografia, conteggio volumi e link al profilo. La motivazione è duplice:

1. **Centralità del soggetto-persona** — la categoria è un classificatore di oggetti; la libreria è curata da una persona. Mettere in primo piano i curatori è coerente con la natura comunitaria della piattaforma e con l'idea che ciò che si scambia non è solo un libro ma una relazione.
2. **Riduzione del rischio di omologazione** — se la home espone solo categorie, gli utenti tendono a cercare per genere e a perdere la dimensione locale. Esponendo le persone, si stimola la curiosità verso il singolo curatore e i suoi gusti.

Le categorie restano comunque accessibili dalla pagina di esplorazione (`explore.html`) come filtro di ricerca.

### 4.7 Homepage di scoperta: gamification e prossimità (v0.3)

La terza iterazione ha ridisegnato la homepage attorno a due principi: rendere percepibile la *vitalità* della piattaforma e mettere la *prossimità* al centro della scoperta. La vetrina generica delle librerie introdotta in v0.2 è stata sostituita da una sezione "Librerie vicino a te" più ricca e ordinata per rilevanza.

#### 4.7.1 Contatori "live" come riprova sociale

Le quattro metriche aggregate della piattaforma sono state spostate dentro l'hero, in forma compatta e tipograficamente minimale, accompagnate da un indicatore pulsante "in tempo reale". I valori si incrementano periodicamente (ogni quattro secondi) con scatti di entità casuale e una micro-animazione di transizione.

La scelta applica un pattern di *gamification* consolidato: la **riprova sociale** (l'utente vede che altri stanno partecipando) e il **senso di slancio** (la piattaforma "cresce sotto i suoi occhi") aumentano la fiducia e l'inclinazione a contribuire. L'animazione è discreta — non distrae dalla lettura del titolo — e rispetta `prefers-reduced-motion`, disattivandosi per chi ha dichiarato sensibilità al movimento. Nel prototipo gli incrementi sono simulati lato client; in produzione deriverebbero da un canale realtime (WebSocket o Server-Sent Events) alimentato dagli eventi effettivi del backend.

#### 4.7.2 Scoperta per prossimità e attività

La sezione "Librerie vicino a te" ordina le collezioni della comunità secondo un **punteggio composito** che combina due segnali:

- **Prossimità**: la distanza geografica fra la posizione di riferimento e la libreria, calcolata con la formula di Haversine. La posizione di riferimento è quella dell'utente autenticato; per i visitatori anonimi è una posizione simulata sul centro di Napoli, dichiarata esplicitamente con una nota testuale per non indurre in errore.
- **Attività**: un indice che pesa il numero di volumi attualmente disponibili al prestito e premia le pubblicazioni recenti con un bonus che decade nell'arco di circa due mesi.

Il punteggio finale (`distanza − attività × peso`) viene ordinato in modo ascendente: in cima compaiono le librerie che sono insieme vicine e vivaci. Questo evita due fallimenti tipici: una lista ordinata solo per distanza mostrerebbe in alto librerie inattive ma vicine; una ordinata solo per attività perderebbe la dimensione territoriale che è il cuore del progetto.

#### 4.7.3 Informazione azionabile nelle card

Ogni card di libreria è progettata per rispondere immediatamente alle domande che un lettore si pone prima di decidere se visitare una collezione:

- *Chi è?* — nome personalizzato e breve descrizione (il motto del curatore, se presente).
- *Dov'è?* — il luogo e la distanza dichiarata in linguaggio naturale ("a 1,5 km da te"), non un dato grezzo.
- *Cosa posso ottenere?* — il numero di volumi disponibili al prestito, reso graficamente prominente perché è l'informazione *azionabile*, quella che motiva il click.
- *È viva?* — un badge "attiva di recente" segnala le librerie con pubblicazioni negli ultimi 45 giorni.

La gerarchia visiva è deliberata: la disponibilità al prestito è in alto a destra del corpo card, in grande, con colore di accento; la distanza usa il font monospace per leggersi come un dato preciso; la descrizione è troncata a due righe per mantenere le card di altezza confrontabile.

#### 4.7.4 Copertine generate proceduralmente

Ogni libreria ha una **copertina generata automaticamente** dal sistema, non un'immagine caricata. La copertina è costruita a runtime combinando le scelte che l'utente ha fatto nella propria area di personalizzazione: il **tema cromatico** determina il gradiente di fondo, lo **stile dell'avatar** (iniziale o glifo tipografico) determina il simbolo stampato al centro. Una trama diagonale semitrasparente e una cornice interna completano l'effetto "facciata" della libreria.

Questa scelta ha tre vantaggi:

1. **Coerenza identitaria** — la copertina della libreria sulla home è visivamente coerente con l'avatar e il tema che l'utente vede ovunque nel proprio profilo: un unico sistema segnico.
2. **Zero costo di moderazione e archiviazione** — non essendoci upload, non c'è bisogno di moderare immagini inappropriate né di archiviare e servire file binari.
3. **Nessuno stato vuoto** — ogni libreria ha sempre una copertina dignitosa fin dal primo istante, senza il classico placeholder grigio "immagine mancante".

È lo stesso principio già applicato alle copertine-placeholder dei libri (gradiente procedurale), qui esteso al soggetto-libreria e arricchito dei parametri di personalizzazione.

### 4.8 La libreria come oggetto di prima classe (v0.4)

La quarta iterazione ha trasformato la "libreria" da semplice etichetta concettuale a oggetto di prima classe della piattaforma: ogni utente ha una propria pagina pubblica dedicata, i nuovi utenti possono essere creati e persistiti attraverso un wizard guidato, e la distinzione fra librerie personali e librerie-ente diventa esplicita a livello di dati, di interfaccia e di controllo di accesso.

#### 4.8.1 Pagina pubblica `library.html`

Ogni libreria ha una propria pagina pubblica accessibile via `library.html?id=X`. La struttura ricalca il principio editoriale del resto del sito: a sinistra una copertina grande (la stessa generata proceduralmente per le card della home, qui in formato più imponente), a destra le informazioni testuali — tipo libreria, nome, denominazione ufficiale per gli enti, motto, biografia/descrizione, luogo, distanza, data di iscrizione, azioni.

Sotto l'intestazione, una riga di **statistiche essenziali** (totale volumi, disponibili al prestito, consultazioni totali) e — solo per gli enti — un **pannello informativo** che presenta in modo strutturato categoria, referente, indirizzo, orari, telefono, email, sito web. La presenza del pannello è il segnale visivo più forte della distinzione persona/ente: non un badge sottile, ma un blocco esplicito di informazioni che riconosce all'ente la sua natura di soggetto pubblico raggiungibile.

I volumi vengono mostrati nella **modalità di visualizzazione scelta dal curatore** (griglia, elenco, scaffale o cronologia) attraverso lo stesso componente `renderBooksInMode` usato dall'anteprima di `profile-setup.html`. Una toolbar consente al visitatore di cambiare temporaneamente la modalità senza alterare la preferenza del proprietario: la coerenza del curatore resta, ma il visitatore non è obbligato a piegarsi al suo gusto.

#### 4.8.2 Persona vs ente nell'interfaccia

La distinzione persona/ente è esplicita ma non invadente:

- Nelle card della home (`Librerie vicino a te`) un tag sulla copertina riporta o "Libreria personale" o la categoria specifica dell'ente ("Biblioteca", "Associazione culturale", "Libreria indipendente"…).
- Nella pagina libreria il badge sopra il nome ripete l'informazione in posizione più prominente; gli enti hanno una variante cromatica accentuata.
- Per gli enti viene aggiunta una riga con la denominazione ufficiale (in italico, sotto il nome), e il pannello informativo strutturato già citato.

Le impostazioni di default differiscono in modo significativo: per le persone la posizione è fuzzificata a ~200 m ed l'email è privata; per gli enti la posizione è precisa e l'email è pubblica. È una scelta semantica, non tecnica: il diritto alla riservatezza dell'abitazione di una persona è un valore difensivo, la necessità di essere trovati di un ente è un valore costitutivo. L'interfaccia di registrazione segnala la differenza con un *info box* contestuale che cambia testo in base al tipo di account scelto.

#### 4.8.3 Wizard di registrazione

La creazione di un nuovo utente è guidata da un **wizard in tre passi** che riprende lo *state-of-the-art* dell'onboarding consumer:

1. **Tipo e accesso** — l'utente sceglie persona o ente con due grandi card radio illustrate; in caso di ente compaiono inline i campi specifici (denominazione, categoria, referente, sito, contatti, indirizzo, orari). Le credenziali (nome visualizzato, username, email, password) sono comuni.
2. **La tua libreria** — descrizione, città, motto facoltativo, tema cromatico (le stesse quattro palette della pagina di personalizzazione), consensi GDPR espliciti.
3. **Primi volumi** — modulo inline per aggiungere uno o più libri alla libreria nascente; la conclusione del wizard richiede almeno un volume aggiunto, per evitare librerie vuote che danneggerebbero la qualità della home.

La barra di avanzamento in cima dichiara il progresso e segna come "fatti" i passi superati. La validazione live applicata a ogni campo (bordo verde/rosso, messaggio inline) impedisce di arrivare allo step successivo con dati incoerenti; un riepilogo accessibile via `role="alert"` raccoglie eventuali errori e fa scorrere alla sezione corretta. Al completamento la funzione `API.createUser` crea la riga utente, ne salva le preferenze, popola `organization_profiles` se è un ente, aggiunge i volumi, e infine imposta il nuovo utente come utente corrente (login automatico). Il redirect finale porta alla pagina libreria appena creata, dove il banner di proprietà fa da conferma percettiva del successo dell'operazione.

#### 4.8.4 Protezione della proprietà delle librerie

Il sistema garantisce che **un utente possa modificare esclusivamente la propria libreria**. La regola è espressa con tre meccanismi sovrapposti:

1. **Helper `canEdit(userId)`** centralizzato in `API`: ogni componente che vuole offrire un'azione di modifica passa da questa funzione, che restituisce `true` solo se `userId` coincide con l'utente attualmente loggato.
2. **`API.requireAuth(redirect)`** all'inizio di ogni script di pagina di gestione: in assenza di un utente loggato la pagina viene immediatamente reindirizzata al login. Le pagine `add-book.html`, `profile.html`, `profile-setup.html` non eseguono nessuna logica successiva se l'autenticazione fallisce.
3. **`API.updateUser(userId, patch)`** solleva un'eccezione se invocata su un `userId` diverso dal proprio. Anche se un attaccante riuscisse a iniettare codice nel browser per chiamare la funzione direttamente, l'eccezione protegge l'integrità dei dati.

La pagina pubblica `library.html` rispetta la stessa regola in modo "polite": quando il visitatore è il proprietario mostra azioni di gestione e un banner di benvenuto con i link a `profile.html` e `profile-setup.html`; quando è un terzo mostra un banner che dichiara esplicitamente che la vista è in sola lettura — non si nasconde la natura della pagina, la si esplicita per chiarezza. Inoltre `profile.html` intercetta un tentativo di accesso con `?user=X` di un altro utente e redirige a `library.html?id=X`, perché in quella sede la cosa giusta è offrire la vista pubblica, non un errore.

In produzione lo stesso controllo deve essere replicato lato server: tutti i metodi di modifica del backend devono verificare il proprietario dell'oggetto contro il subject del token JWT, indipendentemente da quanto il frontend faccia. Il frontend protegge l'esperienza, il backend protegge i dati.

### 4.9 Conversion path mobile-first e infografica (v0.5)

La quinta iterazione ha riorganizzato la homepage attorno al *conversion path* del visitatore mobile, che è il pubblico di riferimento dichiarato (giovani adulti, dispositivi piccoli, sessioni brevi). L'obiettivo: che il primo gesto possibile dopo aver letto il titolo sia premere un pulsante che porta alla registrazione.

#### 4.9.1 CTA primaria sopra la piega

La CTA primaria — etichettata «Inizia a scambiare» per i visitatori e «Pubblica un volume» per gli utenti autenticati — è stata risalita di posizione: ora compare immediatamente sotto il paragrafo di apertura, prima dei contatori live. Su un dispositivo mobile da 375×800 px questo significa che il pulsante è raggiungibile *senza scrollare* (la sua base si trova a circa 657 px dall'alto, ben dentro la finestra visibile). La CTA secondaria «Esplora la mappa» è affiancata, in stile *ghost* (bordo, non riempimento), per offrire un'alternativa esplorativa senza competere visivamente con quella principale.

Le scelte tipografiche del pulsante riflettono lo *state of the art* delle interfacce mobile contemporanee: forma a pillola, padding generoso (≥48 px di altezza, soglia minima raccomandata per i bersagli touch), icona circolare a sinistra, micro-animazione *pulse* che diffonde un alone verso l'esterno ogni 2,6 secondi. Il *pulse* è discreto — non distrae dalla lettura del titolo — e rispetta `prefers-reduced-motion`, disattivandosi per chi ha dichiarato sensibilità al movimento.

Sul nome del pulsante: «Inizia a scambiare» è stato preferito a «Crea un account» perché orientato al *beneficio* (cosa otterrò) invece che all'*operazione* (cosa farò). È un principio classico della *copy* di conversione: l'utente è motivato dal risultato, non dal mezzo.

#### 4.9.2 CTA flottante persistente su mobile

Su viewport ≤ 768 px e per i soli visitatori anonimi, una **CTA flottante** in fondo allo schermo replica il pulsante «Inizia a scambiare» con `position: fixed`. Rimane a portata di pollice durante tutto lo scroll della homepage. Ai dispositivi desktop la CTA flottante non compare — sarebbe rumore in un contesto dove le azioni dell'header sono sempre visibili.

Per gli utenti autenticati la CTA flottante è automaticamente nascosta (la classe `.guest-only` viene esclusa dalla regola CSS `[data-auth-state="user"] .guest-only { display: none }`): non ha senso ricordare la registrazione a chi è già registrato.

#### 4.9.3 Infografica «Come funziona»

La sezione era prima una griglia di tre articoli di solo testo. È stata riprogettata come **infografica a tre tappe**: ogni tappa ha un numero in cerchio (1, 2, 3), un'icona SVG line-art coerente con l'estetica editoriale del sito (cerchio + busto stilizzato con check per la registrazione, libro aperto con freccia di upload per la pubblicazione, libro fra due figure connesse da linee tratteggiate per lo scambio), un titolo e una descrizione concisa.

Le tre card sono unite su desktop da una **linea tratteggiata orizzontale** che attraversa i centri delle icone, suggerendo visivamente una sequenza temporale. Su mobile la linea scompare (le card si impilano verticalmente, la sequenza è già implicita nell'ordine di lettura). Al hover una micro-animazione (`scale(1.08) rotate(-2deg)`) anima l'icona, e l'intera card si solleva di 4 px: gli effetti sono rapidi (250 ms), coerenti tra loro e disattivati con `prefers-reduced-motion`.

Sotto l'infografica una **CTA ripresa** invita di nuovo all'azione: chi è arrivato fin qui ha letto i passi, è pronto. È un pattern classico di pagina di conversione — la CTA si ripete nei punti di transizione narrativa, mai accumulata, mai assente.

#### 4.9.4 Wizard di registrazione: nav-bar a fasi

Il wizard di registrazione era stato introdotto in v0.4; in v0.5 sono stati raffinati due aspetti.

**Header animato di ogni step**: ogni pannello del wizard si apre con un piccolo blocco di intestazione che include un'icona SVG distintiva (due cerchi affiancati per la scelta persona/ente, penna che scrive su una linea ondulata per la "narrazione" della libreria, pila di libri con + per i primi volumi), un titolo e una descrizione breve. All'apparire del pannello l'icona esegue una micro-animazione di ingresso (`scale(0.4) rotate(-15deg) → scale(1) rotate(0)` con curva *back*); è un piccolo segnale di benvenuto che rende ogni passaggio percepibile come "nuova stanza", non come "altro form da compilare".

**Nav-bar pulita per fase**: la logica dei bottoni di navigazione è stata semplificata per non mostrare mai opzioni non rilevanti. Al primo step compare solo «Continua →». Allo step intermedio compaiono «← Indietro» e «Continua →». All'ultimo step compare **solo** «Crea la libreria»: la regola «Indietro» non viene proposta perché sarebbe contraddittoria con il momento decisivo della creazione (chi è pronto a creare non sta ancora valutando di tornare indietro). Su mobile la nav-bar collassa in colonna con il pulsante primario sopra e l'eventuale secondario sotto, per occupare meno larghezza e restare touch-friendly.

Tutti i pulsanti larghi della home e della wizard implementano un **effetto ripple** al click — un'onda concentrica che si espande dal punto premuto. È un pattern Material che funziona bene a basso costo cognitivo: conferma percettivamente che il click è stato registrato, anche prima che la pagina cambi. Su tablet e smartphone questa conferma è particolarmente apprezzata perché manca il cursore che cambierebbe stato.

#### 4.9.5 L'attributo `[hidden]` come fonte di verità

Una nota tecnica sul rendering: durante lo sviluppo è emerso che la regola CSS `.btn { display: inline-flex }` aveva la stessa specificità di `[hidden] { display: none }` (UA stylesheet) ma vinceva per ordine sorgente, neutralizzando l'attributo `hidden` sui pulsanti. La regola universale `[hidden] { display: none !important }` aggiunta in fondo al foglio di stile ripristina la semantica nativa dell'attributo: un elemento marcato `hidden` viene nascosto, sempre. È un esempio di come anche le piccole regole di base meritano di essere protette esplicitamente quando il sistema cresce.

### 4.10 Illustrazione interattiva, ricerca a elenco e percorso del lettore (v0.6)

La sesta iterazione lavora su tre fronti: la comunicazione immediata del valore del sito (illustrazione hero), la leggibilità dei risultati di ricerca, e l'apertura della piattaforma a un nuovo segmento di utenti — chi vuole solo prendere in prestito.

#### 4.10.1 Illustrazione interattiva dell'hero

Lo spazio a destra dell'hero, prima occupato da un grande glifo decorativo «§» sfocato, ospita ora un'illustrazione SVG che mostra **due lettori nell'atto di scambiarsi un libro**. È un'immagine *line-art* coerente con il resto del sistema (tratti sottili in `currentColor`, riempimenti tenui), pensata per comunicare in meno di un secondo cosa fa la piattaforma — un principio di *above-the-fold storytelling* particolarmente efficace per un pubblico giovane abituato a decifrare interfacce visivamente.

Le due figure sono volutamente differenziate (una con coda di cavallo, una con capelli corti) per rappresentare due persone diverse senza ricorrere a marcatori stereotipati: la distinzione è puramente grafica. Al centro, due piccoli volumi che passano di mano. A riposo, i libri «respirano» con una micro-oscillazione continua (4 s) che invita all'interazione senza distrarre.

L'interattività è il punto chiave richiesto: **al click su desktop o al tocco su mobile** l'illustrazione si anima — le braccia salutano (rotazione alternata attorno alla spalla, con `transform-origin` ai punti di attacco), i libri rimbalzano, e cinque brillii dorati appaiono in sequenza sfalsata. Su desktop l'effetto si attiva anche al semplice `:hover`. La gestione del tocco è in JavaScript: una classe `.is-animated` viene aggiunta e poi rimossa dopo il ciclo, con il classico *reflow trick* (`void el.offsetWidth`) per consentire il riavvio dell'animazione a ogni tocco successivo. Un'etichetta «tocca per animare», con un puntino pulsante, dichiara l'affordance e svanisce durante l'animazione. Tutto rispetta `prefers-reduced-motion`. L'illustrazione è un `<button>` con `aria-label` descrittivo, dunque pienamente raggiungibile da tastiera e screen reader.

Sul piano del layout, l'hero passa da blocco a colonna singola a **griglia a due colonne** (`minmax(0,1fr)` per il testo, `minmax(280px,380px)` per l'illustrazione). Le colonne sono assegnate esplicitamente con `grid-column` per garantire testo a sinistra e illustrazione a destra indipendentemente dall'ordine nel DOM; su mobile (≤880 px) la griglia collassa e l'illustrazione, con `order: -1`, scala sopra il testo, così resta il primo elemento visivo della pagina.

#### 4.10.2 Risultati di ricerca a elenco

I risultati di `explore.html` erano renderizzati con lo stesso componente a griglia della home (`books-grid`), poco leggibile quando l'informazione importante è *dove* si trova il libro. La nuova funzione `UI.renderSearchResults` produce un **elenco a piena larghezza**: ogni riga è una griglia interna a tre zone (copertina · dati · stato).

L'enfasi è deliberatamente posta sulla **posizione**: un'icona-pin disegnata in SVG, in colore bordeaux, precede la città in grassetto e il nome della libreria che possiede il volume. È il dato che conta di più per chi cerca un prestito di prossimità, ed è il primo elemento che l'occhio incontra dopo il titolo.

Lo stato di disponibilità è reso con un *badge* dedicato. «Disponibile» usa il **verde salvia** della palette (colore d'accento positivo), accompagnato da un puntino con animazione di pulsazione (un'onda che si espande e svanisce) e da un leggero *glow* di sfondo che oscilla: cattura l'attenzione restando coerente con l'identità cromatica. «In prestito» resta neutro, per contrasto.

Due raffinamenti di UX accompagnano il render. Primo, **lo scroll automatico**: dopo una ricerca esplicita la pagina scorre dolcemente fino all'intestazione dei risultati (con un offset per non incollarli al bordo superiore), così l'utente vede subito l'esito senza doverlo cercare. Lo scroll si attiva *solo* dopo un invio del form, non al primo caricamento — distinzione gestita con un flag `scrollOnSearch`. Secondo, **l'animazione di entrata a cascata**: ogni riga entra con un breve *fade-up* ritardato in base all'indice (`--i` come *custom property*), riavviato a ogni ricerca tramite reflow.

Una nota di robustezza: la mappa Leaflet dipende da un CDN esterno. Se non è raggiungibile, l'inizializzazione è incapsulata in `try/catch` e i risultati di ricerca vengono comunque mostrati, con un messaggio che segnala l'indisponibilità della sola mappa. La funzione primaria della pagina — trovare libri — non dipende più dalla disponibilità della mappa.

#### 4.10.3 Il percorso del lettore (borrower)

Fino alla v0.5 ogni iscritto era implicitamente un curatore: la registrazione richiedeva di pubblicare almeno un volume. Ma una parte rilevante del pubblico potenziale vuole, almeno inizialmente, **solo prendere in prestito**. La v0.6 apre esplicitamente questo percorso.

In registrazione compare una **terza opzione** accanto a Persona ed Ente: **Lettore** («voglio solo prendere in prestito»). Sul piano dei dati non si introduce un terzo `account_type` — sarebbe una complicazione semantica ingiustificata: un lettore *è* una persona. Si introduce invece, nelle preferenze di profilo, un campo `library_role` con valori `curator` | `borrower`. La funzione `API.getLibraryRole` aggiunge una regola di promozione automatica: chiunque abbia pubblicato almeno un volume è considerato curatore *a prescindere* dal valore memorizzato. La distinzione «lettore» è dunque uno stato transitorio che si dissolve nel momento in cui l'utente condivide il primo libro.

Il wizard si adatta al tipo scelto: per il lettore lo **step «Primi volumi» viene saltato** (l'indicatore di avanzamento lo mostra barrato e attenuato), lo step 2 diventa l'ultimo, e il pulsante finale cambia etichetta in «Completa l'iscrizione». La biografia, obbligatoria per i curatori, diventa facoltativa per i lettori, riducendo l'attrito di un'iscrizione che deve essere il più rapida possibile.

Il cuore funzionale è il **dirottamento della richiesta di prestito**. Quando un ospite, dalla scheda di un libro, apre il dialog di richiesta e preme «Invia richiesta», il sistema rileva l'assenza di un utente autenticato, salva l'identificativo del libro in `sessionStorage` (`pending_loan_book`) e reindirizza a `register.html?intent=borrow&book=ID`. La pagina di registrazione legge il parametro `intent`, pre-seleziona la card «Lettore» e mostra un banner contestuale che spiega *perché* l'utente si trova lì («Un ultimo passo prima del prestito»). Completata l'iscrizione, se esiste un libro in sospeso l'utente viene riportato proprio a quella scheda (`book-detail.html?id=ID&loan=1`); il parametro `loan=1` riapre automaticamente il dialog di richiesta, ora con l'utente autenticato, chiudendo il cerchio senza fargli ripercorrere i passi.

L'intero percorso è costellato di **suggerimenti**, come richiesto: un *hint* nel dialog di prestito per gli ospiti, il banner d'intento in registrazione, l'*hint* sotto la scelta del tipo account, e — sulla pagina pubblica della propria libreria — un riquadro «Sei iscritto come lettore» che invita ad aprire la libreria aggiungendo il primo volume. Sono tutti informativi e non bloccanti: orientano senza imporre, nel solco della filosofia di UX del progetto.

### 4.11 Illustrazione flat, ricerca per luogo e validazione (v0.7)

#### 4.11.1 Riprogettazione dell'illustrazione dell'hero

La prima illustrazione interattiva (v0.6) era realizzata in *line-art* con figure a tratto sottile e teste circolari. Sebbene tecnicamente animata, l'effetto risultava sgradevole — figure-stecchino che agitano le braccia scivolano facilmente nella *uncanny valley*. La v0.7 la sostituisce con un'illustrazione in stile **flat** a forme piene: due personaggi dai corpi arrotondati (maglione bordeaux e salvia), volti minimali ma sorridenti (due occhi a punto e un sorriso), che condividono un libro dorato sopra una piccola pila di volumi. Le forme piene e i colori caldi della palette comunicano accoglienza invece di inquietudine — lo stesso registro visivo di librerie di illustrazioni come Storyset o unDraw.

L'animazione al tocco è stata ripensata di conseguenza: niente più braccia che si agitano, ma un movimento d'insieme garbato — i due personaggi si inclinano leggermente l'uno verso l'altro, il libro condiviso pulsa, e tre cuoricini salgono in sequenza sfalsata. A riposo il solo libro «respira» con una lentissima oscillazione, come invito al tocco. Tutto resta disattivabile via `prefers-reduced-motion`. Il contenitore è ancora un `<button>` accessibile; un commento nel markup documenta come sostituire l'intero blocco SVG con un asset gratuito esterno (immagine statica unDraw, SVG animato Storyset o `lottie-player` per un file Lottie JSON), conservando l'interazione.

Sul piano del layout, l'hero è stato ristrutturato in tre fasce verticali: una fascia superiore (`hero__top`) a due colonne con il **testo introduttivo a sinistra e l'illustrazione a destra**, e sotto, a tutta larghezza, le CTA e i contatori. L'illustrazione è così *accanto* al titolo e al paragrafo introduttivo, non più genericamente centrata sull'intera colonna. Su mobile la fascia collassa e l'illustrazione scende **sotto** il testo introduttivo (mai sopra), restandone adiacente.

#### 4.11.2 Ricerca per informazioni spaziali

La ricerca di `explore.html` è stata estesa per interrogare anche i dati di luogo. La funzione `API.searchBooks` ora, oltre a titolo/autore/descrizione, confronta il termine cercato con la **città** del proprietario e — per gli enti — con l'**indirizzo pubblico**, che contiene via e **CAP**. Diventa così possibile cercare «Vomero» (quartiere), «80136» (CAP della Biblioteca della Sanità) o un indirizzo, oltre ai consueti titolo e autore. Il segnaposto del campo e un testo di aiuto sotto la barra comunicano esplicitamente questa possibilità.

#### 4.11.3 Risultati nascosti all'avvio

In precedenza la pagina eseguiva una ricerca «vuota» al caricamento, mostrando da subito tutti i volumi — un comportamento che dava l'impressione errata di risultati già filtrati e rendeva la pagina inutilmente lunga. Ora all'avvio la sezione dei risultati è **nascosta** (`hidden`) e al suo posto compare un invito esplicito a cercare (icona, titolo, breve istruzione). La mappa, invece, mostra fin da subito tutte le librerie, perché è uno strumento di esplorazione, non un elenco di risultati. La sezione dei risultati — e con essa lo scroll automatico verso il basso e l'animazione d'entrata a cascata — si attiva soltanto dopo una ricerca esplicita.

#### 4.11.4 Validazione del campo di ricerca

Premere «Cerca» con il campo vuoto non produce più una ricerca a vuoto: il bordo della casella diventa **bordeaux** con un alone e una breve animazione di *shake* (translazione orizzontale smorzata), il campo riceve `aria-invalid="true"` e il focus, e la ricerca non parte. Lo stato d'errore si azzera non appena l'utente ricomincia a digitare. È un *feedback* immediato e proporzionato: segnala l'azione mancante senza un messaggio d'errore invadente, coerente con la validazione *live* già adottata nei form di pubblicazione e registrazione. Anche questa animazione rispetta `prefers-reduced-motion`.

### 4.12 Funzioni sociali: segui, preferiti, notifiche (v0.8)

L'ottava iterazione introduce un livello *sociale* ispirato a piattaforme come Vinted: seguire le librerie, salvare volumi preferiti, ricevere notifiche. Tre funzioni distinte che condividono un'unica infrastruttura di eventi.

#### 4.12.1 Modello dati

Si aggiungono tre tabelle. `user_follows` è una relazione molti-a-molti autoreferenziale su `users` (chiave primaria composta `follower_id` + `followed_id`, con un vincolo `CHECK` che impedisce di seguirsi da soli e indici su entrambe le colonne per contare i follower e costruire il feed di chi si segue). `book_likes` lega utenti e volumi (chiave `user_id` + `book_id`, indice su `book_id` per il conteggio). `notifications` registra gli eventi destinati a un utente, con un campo `type` vincolato a tre valori — `new_book`, `profile_update`, `book_available` — un `actor_id` (la libreria che ha generato l'evento), un eventuale `book_id`, il messaggio e un `read_at` nullo finché la notifica non è letta. Un indice parziale `WHERE read_at IS NULL` rende immediato il recupero dei soli non letti, lo schema d'accesso più frequente per una campanella.

Nel prototipo le tre tabelle sono rispecchiate in `localStorage` (`follows_{id}`, `likes_{id}`, `notifications_{id}`), con un set di dati di esempio per l'utente dimostrativo.

#### 4.12.2 La sfida del prototipo a singolo browser

Una funzione sociale presuppone più utenti che interagiscono in tempo reale: «ricevi una notifica quando qualcun altro pubblica». In un prototipo a singolo browser questo non può avvenire davvero. La soluzione adottata è duplice. Da un lato i **conteggi** (follower di una libreria, like di un volume) sono mostrati come *base di esempio + l'azione dell'utente corrente*: non potendo conoscere i follow altrui, si parte da un numero plausibile predefinito e vi si somma l'eventuale follow/like dell'utente. Dall'altro le **notifiche** sono generate in modo credibile a partire dai dati reali: seguendo una libreria, la funzione `generateFollowNotifications` crea notifiche per i suoi volumi più recenti (con la data effettiva di pubblicazione come timestamp) e, per gli enti, un avviso di «informazioni aggiornate». Smettere di seguire rimuove le notifiche provenienti da quella libreria, così il *toggle* resta pulito e reversibile. Al primo avvio, `seedSocialDemo` popola una volta sola un insieme realistico di notifiche (i tre tipi, alcune già lette in base all'età) per l'utente di esempio. È un compromesso onesto: la logica applicativa è quella reale, solo la *sorgente* degli eventi è simulata anziché spinta dal backend.

#### 4.12.3 La campanella di notifiche

La campanella vive nell'header di **ogni** pagina. Per non duplicare il markup in tutti i file HTML, viene iniettata via JavaScript (`UI.initNotifications`) nella barra di navigazione, subito prima del selettore di stato. È visibile solo agli utenti autenticati. Mostra un badge con il numero di non letti (con una breve animazione di oscillazione quando ce ne sono) e apre un pannello a tendina con la lista degli eventi: ciascuno ha un'icona per tipo (📚 nuovo libro, ✅ tornato disponibile, ℹ️ info aggiornate), il messaggio, il tempo trascorso in forma relativa («4 h fa», «2 g fa») e un pallino per i non letti. Il pannello si chiude cliccando fuori o con *Escape*, e all'apertura-chiusura marca gli eventi come letti. Un pulsante «Segna tutte come lette» azzera il badge. Ogni voce è un link al libro o alla libreria pertinente.

#### 4.12.4 Seguire e mettere «mi piace»

Sulla pagina pubblica di una libreria, un visitatore autenticato (non il proprietario) trova un pulsante **«Segui»** accanto al conteggio dei follower; premendolo, il pulsante diventa «✓ Segui già» (che al passaggio del mouse mostra «Smetti di seguire»), il conteggio si aggiorna e la campanella si ripopola. I volumi mostrano un **cuore** «mi piace»: prominente nella pagina di dettaglio (con etichetta e conteggio) e come piccolo *chip* sovrapposto sulle schede nelle griglie. Sulle schede il cuore usa un *handler delegato* che intercetta il click impedendo la navigazione del link contenitore. Per i volumi attualmente in prestito, l'interfaccia invita esplicitamente a mettere «mi piace» per essere avvisati al ritorno della disponibilità — il caso d'uso che dà senso alla funzione. Coerentemente con il flusso del prestito, un ospite che prova a mettere «mi piace» viene invitato a iscriversi.

#### 4.12.5 Homepage personalizzata

Quando l'utente è autenticato, la homepage cambia natura. Le sezioni di pura presentazione (l'hero introduttivo e «Come funziona») sono nascoste tramite la classe `guest-presentation` e una regola `[data-auth-state="user"] .guest-presentation { display: none }`. Al loro posto compaiono, nell'ordine concordato, tre sezioni: **Novità da chi segui** (i volumi più recenti delle librerie seguite, o un invito a seguirne se non se ne segue nessuna), **I tuoi preferiti** (i volumi con «mi piace», o un invito a salvarne), e **Librerie vicine** (già esistente). Un'intestazione compatta «Bentornata, [nome]» sostituisce l'hero. Tutto reagisce al cambio di stato di autenticazione, ridisegnando le sezioni al volo. La home passa così da vetrina per i nuovi visitatori a cruscotto personale per chi è già parte della rete.

### 4.13 Illustrazione esterna "viva" e ingresso unificato (v0.9)

#### 4.13.1 Animazione continua di un asset esterno

L'illustrazione dell'hero è ora un asset esterno professionale (Freepik/Storyset) caricato via `<img src="assets/library-animate.svg">`. Questo pone un vincolo tecnico interessante: un SVG caricato come immagine è **isolato**, il CSS e il JavaScript della pagina non possono raggiungerne gli elementi interni. L'asset, però, porta con sé un proprio blocco `<style>` con un'animazione d'ingresso di circa un secondo (le classiche `slideUp`, `zoomIn`, `lightSpeed…` di Storyset, con `animation-iteration-count: 1` e `forwards`): finita l'intro, l'illustrazione resta statica.

La richiesta — un movimento perpetuo «leggero e subdolo» — non poteva quindi essere realizzata dall'esterno. La si è ottenuta **modificando il file SVG stesso**: al suo `<style>` sono stati aggiunti alcuni *keyframes* discreti (`ldFloatA`/`ldFloatB` per il galleggiamento verticale, `ldGlow` per una lieve pulsazione di opacità, `ldSway` per una micro-oscillazione) e, sui gruppi rilevanti (i due personaggi, la libreria, l'insegna), una **seconda animazione** in coda a quella d'ingresso. Il punto delicato è la temporizzazione: usando le forme estese `animation: <intro>, <continua>` e `animation-delay: 0s, 1.3s` si garantisce che il respiro continuo parta **dopo** l'intro, evitando di sovrascriverne il movimento iniziale; poiché tutte le intro terminano alla trasformazione identità, l'animazione continua oscilla attorno alla posizione naturale dell'elemento. Le ampiezze sono minime (2–2,5 px di traslazione, 7% di opacità), le durate lunghe (6–8 s) e le fasi sfalsate, così l'effetto è percepibile solo "con la coda dell'occhio". Una *media query* `prefers-reduced-motion` interna al file riduce le iterazioni per chi preferisce meno movimento. A questo si somma un respiro lentissimo dell'intero contenitore `<img>`, gestito dal CSS di pagina (qui possibile, perché agisce sull'elemento immagine, non sui suoi interni), e un piccolo rimbalzo elastico al tocco.

#### 4.13.2 Ingresso unificato registrazione/accesso

Per ridurre l'attrito d'ingresso, i due collegamenti separati *Accedi* e *Registrati* della barra di navigazione sono stati unificati in un **unico bottone «Registrati / Accedi»** che porta alla registrazione — la scelta di default per un nuovo visitatore. Chi è già iscritto trova in fondo alla pagina di registrazione l'invito «Hai già un account? **Accedi**», con la parola *Accedi* sottolineata e in bordeaux, che conduce alla pagina di accesso. È il pattern adottato da molte piattaforme consumer: una sola porta d'ingresso evidente, con la via alternativa chiaramente segnalata ma defilata.

#### 4.13.3 Changelog

A partire da questa versione il progetto include `docs/changelog.md`, uno storico leggibile di tutte le versioni (sintesi e dettaglio di ogni iterazione), aggiornato contestualmente al codice e al resto della documentazione.

### 4.14 Tassonomia BISAC, ricerca interattiva e UI di prossimità (v1.0)

#### 4.14.1 Dallo strato piatto al BISAC multi-tag

Fino alla v0.9 ogni libro apparteneva a una sola categoria scelta da un elenco piatto di una dozzina di voci («Classici», «Saggistica», «Storia»…). La v1.0 allinea la classificazione allo **standard commerciale internazionale BISAC** (*Book Industry Standards and Communications*), quello usato da editori, distributori e librerie online per descrivere il mercato: undici macro-aree (Narrativa, Saggistica, Biografie, Poesia, Teatro, Arte e fotografia, Fumetti, Letteratura per ragazzi, Cucina e casa, Viaggi, Salute e benessere) e circa settanta sotto-categorie, oltre alla possibilità che un volume porti **più tag contemporaneamente**. *Napoli milionaria!* di De Filippo, ad esempio, è insieme *Teatro contemporaneo*, *Classici* e *Narrativa storica*: tre prospettive ugualmente legittime sotto cui un lettore potrebbe cercarlo.

Sul piano dei dati la modifica è strutturale. La tabella `categories` acquisisce una colonna `parent_id` (auto-riferimento) per modellare la gerarchia macro→sub, e un campo opzionale `bisac_code` per l'integrazione futura con i veri codici BISAC. La relazione molti-a-molti fra libri e categorie passa attraverso una nuova tabella `book_categories(book_id, category_id, is_primary)`. Il flag `is_primary` marca il tag *principale* — quello mostrato come categoria nelle card compatte — ed è protetto da un indice unico parziale che ne garantisce l'unicità per libro: `CREATE UNIQUE INDEX … ON book_categories (book_id) WHERE is_primary`. Il vecchio `books.category_id` è mantenuto come scorciatoia al tag primario, per retro-compatibilità e per query rapide.

Nel prototipo lato JavaScript ogni oggetto-libro porta una proprietà `categories: string[]`; la stringa `category` resta valorizzata col primo tag così che il codice precedente continui a funzionare senza modifiche. La struttura BISAC vive in `BISAC_CATEGORIES` (mappa macro→sub) e nella lista piatta `BISAC_FLAT` (tutti i tag ordinati alfabeticamente), con una mappa di lookup `BISAC_PARENT` per associare ciascuna sotto-categoria alla sua macro-area.

#### 4.14.2 Il componente tag-input con autocomplete

Una `<select>` non si presta al multi-tag e — soprattutto — non aiuta chi non conosce a memoria una tassonomia da settanta voci. Si è quindi costruito un componente riusabile, `UI.initTagInput(container, opts)`, che rende l'inserimento dei tag immediato. La casella ospita i tag già selezionati come *chip* (con bottone «×» per rimuoverli) e un campo di testo accanto: a ogni carattere digitato compare un menu di suggerimenti con i tag che contengono la sequenza, **raggruppati visivamente per macro-area** («Gialli e noir · Narrativa», «Poesia italiana · Poesia»). Si possono usare le frecce ↑↓ per scorrere i suggerimenti, *invio* per aggiungere, *Backspace* su campo vuoto per rimuovere l'ultimo chip, *Escape* per chiudere il menu. Cliccando fuori dal componente, il menu si nasconde.

Lo stesso componente serve due contesti diversi: in `add-book.html` con limite di cinque tag (per la pubblicazione) e validazione «almeno un tag» integrata nel form; in `explore.html` senza limite, con un *callback* che fa scattare la ricerca a ogni variazione. La logica di filtraggio è una OR sui tag: un libro passa se *almeno uno* dei suoi tag coincide con uno di quelli richiesti — la semantica che combacia col modo in cui un utente aggiunge tag («voglio narrativa storica *oppure* gialli»).

#### 4.14.3 Slider di distanza con ricerca in tempo reale

La vecchia `<select>` con quattro raggi (1, 3, 5, 10 km) sottrarre informazione e attrito allo stesso tempo: pochi valori discreti, e un *click+select* per cambiarli. Al suo posto, una barra trascinabile (`<input type="range">`) da 0 a 20 km, con zero che significa «qualsiasi distanza». L'aspetto è personalizzato in CSS: la barra si riempie progressivamente di bordeaux man mano che si trascina, il *thumb* è un cerchietto color carta con bordo bordeaux. Una piccola etichetta in alto a destra mostra in tempo reale il valore («entro 7 km»).

Il vero salto di UX è il *debounce*: l'evento `input` del range scatta a ogni pixel di movimento, e basterebbe scaricarlo direttamente in `runSearch` per generare decine di ricerche al secondo. Si è quindi accumulato l'evento e schedulato un singolo ricalcolo con un ritardo di 240 ms — abbastanza breve da sentirsi istantaneo, abbastanza lungo da assorbire il *drag* continuo. Lo stesso schedulatore (`scheduleSearch`) gestisce anche le variazioni del tag-input, così aggiungere o rimuovere un tag aggiorna la lista senza dover premere «Cerca». La ricerca automatica si attiva *solo* dopo che l'utente ha avviato manualmente la prima ricerca (cioè dopo che la sezione risultati è visibile): vogliamo l'aggiornamento reattivo, non aprire la sezione da soli.

#### 4.14.4 «Librerie vicine»: minimalismo e identità del tipo

La sezione *Librerie vicine* della homepage era una griglia di card decorose ma uniformi: una libreria personale e un'associazione si distinguevano solo dal nome. La v1.0 rimette al centro la lettura del *tipo* — perché chiedere un libro a un vicino di casa non è la stessa esperienza di chiederlo a un'associazione con orari di apertura — con tre interventi insieme. Anzitutto un **nastro colorato** in alto alla copertina, di sei pixel, dichiara il tipo a colpo d'occhio: bordeaux per gli enti, salvia per le librerie personali. In alto a sinistra, un **badge tipo** con icona (🏛 per gli enti con la categoria specifica — Biblioteca, Associazione, Libreria indipendente, Centro culturale — e 📖 per le librerie personali) dà il dettaglio. La copertina vera e propria è più sobria: il glifo del tema è più piccolo, la sfumatura più tenue (`filter: saturate(.95)`), il nome non viene più stampato sopra l'immagine ma esce solo nel corpo della card — meno rumore visivo.

Sotto la descrizione, una *bandella* separata da un sottile filo orizzontale ridà importanza alle due informazioni che muovono davvero la decisione: il **luogo** (icona-pin disegnata in SVG e colorata di bordeaux + nome della città in font display, con la distanza in piccolo subito sotto) e i **libri disponibili** (un numero grande, bordeaux, in font display, con l'etichetta «libri disponibili» minuscola e maiuscoletto). Sono le due risposte che il visitatore cerca: *dov'è?* e *quanto vale come collezione attiva?*. Per dare maggiore visibilità agli enti, sono stati aggiunti due nuovi soggetti nell'area di Napoli: la *Libreria Indipendente Spaccanapoli* nel centro storico e il *Centro Culturale Mezzogiorno* al Vomero, con i propri profili-organizzazione e sei volumi che esercitano il multi-tag BISAC.

#### 4.14.5 Ritocchi di UX

Due piccole correzioni completano l'iterazione. Il bottone **«Registrati / Accedi»** della barra di navigazione, prima riempito di bordeaux pieno, urtava visivamente fra link testuali e icone monocrome; è stato sostituito da uno stile più sobrio (sfondo trasparente, bordo sottile bordeaux semitrasparente, testo nel colore dell'inchiostro), che attira l'attenzione senza prepotenza e si accende solo al passaggio del mouse o al focus. La **posizione della home al caricamento** è stata alzata riducendo il `padding-top` dell'hero da `--sp-16` a `--sp-10`, così il CTA *Inizia a scambiare* è subito sotto il titolo nel viewport iniziale; un commento ben visibile nel CSS, sopra la regola, spiega cosa modifica e quale range di valori conviene esplorare, dato che la richiesta era proprio di poter regolare a piacere quel margine in futuro.

### 4.15 Rifinitura UX mobile-first: 15 cover, copertine reali, mini-mappa (v1.1)

La v1.1 non aggiunge funzioni grandi ma raddrizza una serie di dettagli che, messi insieme, cambiano la sensazione di tutto il prodotto: meno rumore in homepage, più informazione sui blocchi che contano, vero contenuto visivo dove prima c'era solo gradiente.

#### 4.15.1 Versionamento del dataset di esempio

Aggiungere nuovi utenti di esempio (i due enti della v1.0) non aveva effetto su chi aveva già caricato il prototipo: `Storage.init` popolava i campioni solo se assenti, quindi un `localStorage` precedente continuava a mostrare le sole sei librerie personali iniziali. Si è introdotta una costante `Storage.DATA_VERSION` («1.1.0») e un metodo `_reseedSampleDataIfStale` che confronta la versione salvata con quella corrente: se differiscono, ri-semina i campioni (utenti, libri, categorie, preferenze, profili-ente) **preservando però le creazioni dell'utente** — ovvero i libri pubblicati di proprio pugno, follow, like e notifiche generate localmente. La logica è semplice: gli ID dei campioni costituiscono un *set* noto; gli altri vengono filtrati e re-incollati alla coda. Il risultato è un aggiornamento "trasparente" del dataset di base senza perdere lo stato locale.

#### 4.15.2 Home più discreta: stats inline e niente eyebrow

L'hero era diventato denso: un'eyebrow «PIATTAFORMA DI CONDIVISIONE CULTURALE», il titolo, il lead, due CTA, e un blocco a sé per i contatori "live" (quattro pillole numeriche). Per un mobile-first leggibile si è scelto di togliere l'eyebrow (informazione decorativa più che utile) e di accorpare i contatori sulla stessa riga dei CTA: un'unica pillola con tipografia mono, un pip pulsante salvia, l'etichetta «in tempo reale» e tre gruppi (`18 volumi · 8 lettori · 12 categorie`) separati da puntini centrali. Le statistiche restano "in tempo reale" (lo script che le aggiorna è invariato), ma occupano un decimo dello spazio e non sottraggono peso ai due CTA. Su viewport sotto i 720 px la pillola va a capo come blocco intero, mantenendo l'allineamento dei bottoni.

#### 4.15.3 Quindici grafiche cover per la libreria

Fino alla v1.0, la copertina della libreria — quella che si vede nelle card *Librerie vicine* — era un gradiente colorato con un grande glifo al centro (la lettera iniziale del nome, oppure un simbolo scelto dall'utente). Funzionava, ma era una scelta sola e si ripeteva uguale a sé stessa. La v1.1 introduce un catalogo di **quindici decorazioni** selezionabili dalle impostazioni del profilo, organizzato in tre famiglie da cinque elementi ciascuna: **pattern astratti** (pois, righe diagonali, onde, griglia geometrica, cerchi concentrici), **icone tematiche** (libro aperto, scaffale popolato, pila di volumi, penna d'oca, segnalibro) e **glifi tipografici** (paragrafo §, foglia di Aldo ❧, fiorone ☙, *et* &, monogramma con l'iniziale). Tutto è dichiarato in un'unica costante `LIBRARY_COVER_DESIGNS`: ogni voce porta una chiave, un nome leggibile, una famiglia, e una funzione `render(opts)` che restituisce il contenuto SVG da posare dentro la copertina (200×140 viewBox).

Le decorazioni usano `currentColor` con opacità basse, così seguono il tema cromatico scelto dall'utente: lo stesso pattern *pois* compare in beige chiaro sulla copertina bordeaux di una biblioteca e in tonalità diverse su una copertina salvia. Il default differisce per tipo libreria (`g-section` per le librerie personali, `i-shelf` per gli enti), una piccola attenzione a far sentire ciascuno "al posto giusto" anche senza intervento. In `profile-setup.html` un nuovo picker mostra le quindici miniature in griglia (5 colonne, 3 su mobile); cliccare ne seleziona una con un bordo bordeaux pieno e un alone d'ombra. Il colore di sfondo del picker segue il tema in modo reattivo: cambiare il tema cromatico re-disegna le quindici anteprime in pochi millisecondi, così l'utente può capire come la stessa decorazione "respira" con la palette.

#### 4.15.4 Avviso visivo "pochi libri disponibili"

Nella sezione *Librerie vicine* il numero di libri disponibili era già in evidenza (font display grande, color bordeaux). La v1.1 aggiunge un secondo livello di lettura: quando una libreria ha solo **uno o due volumi disponibili**, il numero diventa **arancione caldo** (`#d97706`) e il blocchetto numero+etichetta pulsa con un bordo morbido e un alone luminoso (animazione `avail-pulse` di 2.4 secondi, in `ease-in-out infinite`). È un'allerta gentile — *"vedi questa libreria? Approfittane prima che si svuoti"* — non un'emergenza. Lo stato 0 disponibili resta invece grigio: non è un'opportunità mancata, è già finita, e segnarla in arancione confonderebbe il segnale. Anche questa animazione rispetta `prefers-reduced-motion`: per chi preferisce meno movimento, il bordo resta semplicemente acceso senza pulsare.

#### 4.15.5 Copertine reali dei libri via Open Library

Le card libro mostravano un gradiente colorato con il titolo sovrapposto. Funzionale, ma anonimo. La v1.1 integra **Open Library Covers API**, un servizio gratuito senza chiave che restituisce la copertina di un libro per ISBN: `https://covers.openlibrary.org/b/isbn/{ISBN}-M.jpg?default=false`. Il parametro `default=false` è essenziale e va spiegato: senza, OL restituisce un pixel trasparente 1×1 con HTTP 200 quando la copertina non c'è, e quindi `<img onerror>` non scatterebbe mai. Con `default=false`, OL restituisce un onesto 404, e l'`onerror` può nascondere l'immagine lasciando in vista il gradiente di fallback. Si è anche aggiunto `onload=this.classList.add('is-loaded')`: l'immagine entra in fade-in solo dopo essere arrivata, evitando il "lampo" dell'immagine grezza che copre il gradiente. Quando l'immagine reale è presente, il titolo placeholder che si vedeva sopra il gradiente sparisce con la regola `.book-card__cover-img.is-loaded ~ .book-card__cover-title { opacity: 0 }`. Le copertine vere appaiono nella griglia *Esplora*, in *Dettaglio libro* (con la risoluzione `-L`) e nelle vista libreria; per i libri senza ISBN o con copertina assente, il vecchio gradiente continua a funzionare come prima.

#### 4.15.6 Pagina libreria: mini-mappa, statistiche centrate, libri grigi, filtro

Quattro miglioramenti su `library.html` per dare alla pagina lo stesso senso di "luogo concreto" che ha *Esplora*. Una **mini-mappa Leaflet** con un solo pin sulla posizione della libreria — icona 📖 per le personali, 🏛 per gli enti, entrambe in un cerchietto carta con bordo colorato — apre fra le statistiche e l'elenco volumi: controlli ridotti (`zoomControl: false`, `scrollWheelZoom: false`), zoom 15 (quartiere), una caption sotto con la città e — per gli enti — l'indirizzo pubblico. Le **statistiche** sono state riarrangiate (`library-stats--hero`): *disponibili al prestito* (in bordeaux, grassetto, primo) e *volumi totali* (font display grande, secondo) sono al centro della pagina, con *consultazioni totali* a destra. Su mobile vanno a due colonne con le consultazioni che occupano la riga sotto. I **libri in prestito** ricevono in griglia la classe `book-card--unavailable` che applica `filter: grayscale(0.7) opacity(0.55)` e `pointer-events: none`: visibili ma evidentemente non disponibili, e non cliccabili (il cuore "mi piace" resta attivo, perché è il modo per ricevere l'avviso al ritorno della disponibilità). Infine, un **filtro volumi** sopra la lista riprende esattamente lo stesso set di *Esplora*: campo di ricerca per testo (titolo, autore, descrizione), tag-input BISAC con autocomplete, e checkbox *Solo disponibili*. Il rendering è debouncato (200 ms sul testo) e mantiene la modalità di visualizzazione attiva (griglia, elenco, scaffale, cronologia). Il filtro è un'arma di esplorazione: si entra in una libreria-ente con duecento volumi e in tre tag si trova esattamente ciò che si cerca, senza dover scorrere.

### 4.16 Onboarding fluido, dropdown profilo, password reset (v1.3)

L'iterazione v1.3 sposta il fuoco dall'aggiunta di funzioni alla manutenzione fine dell'esperienza utente: come si entra nella piattaforma la prima volta, come ci si muove al suo interno una volta dentro, come si ripristina l'accesso quando si è perso. Ognuna delle quattro modifiche tocca un attrito che il prototipo aveva accumulato strada facendo.

#### 4.16.1 Iscrizione senza il vincolo del primo volume

Fino alla v1.2, il wizard di registrazione richiedeva alla terza schermata almeno un libro prima di poter completare l'iscrizione: una scelta che voleva spingere a "popolare" subito la libreria, ma che si è rivelata un freno reale per chi voleva esplorare prima di impegnarsi. Si è quindi reso facoltativo lo step "Primi volumi" (titolo aggiornato a *I tuoi primi volumi (opzionale)*, copy riscritto: *«Se vuoi puoi aggiungere subito uno o più libri — oppure saltare questo passo e completare l'iscrizione: la tua libreria nascerà comunque»*) e si è rimossa la guardia `if (!borrower && addedBooks.length === 0)` che bloccava la creazione. La parola *opzionale* nel titolo è leggermente più piccola e desaturata, perché sia subito chiaro che non è una richiesta ma un suggerimento. Il vecchio `auth-switch` *«Hai già un account? Accedi»* è stato spostato dal fondo della pagina alla cima (classe nuova `auth-switch--top`, allineato a destra, con un bordo inferiore sottile): chi ha già un account lo trova prima di iniziare la lettura del titolone, non dopo aver attraversato l'intero wizard.

Naturalmente, eliminare il vincolo non significa rinunciare a indirizzare il neo-iscritto verso la pubblicazione del primo volume: significa solo non farlo in modo ricattatorio. Lo si fa con due meccanismi che entrano in azione subito dopo `API.createUser`.

#### 4.16.2 Notifiche di onboarding e empty-state sul profilo

In coda a `createUser` si chiama un nuovo metodo `seedOnboardingNotifications(userId, user)` che inserisce nel feed dell'utente due notifiche del nuovissimo `type: 'onboarding'`: la prima invita a pubblicare il primo volume (`onboarding_action: 'add-book'`), la seconda a personalizzare l'aspetto della libreria (`onboarding_action: 'personalize'`). Le notifiche convivono con quelle sociali esistenti (`new_book`, `book_available`, `profile_update`) e condividono con loro il pannello-campanella, il badge non-letti, la marcatura come letta al click. Si distinguono per l'icona (👋 anziché 📚/✅/ℹ️) e soprattutto per la rotta del link: invece di rimandare a un libro o a una libreria, puntano direttamente a `add-book.html` o `profile-setup.html` a seconda dell'azione suggerita. Il messaggio è anche adattato al tipo di account (`tua biblioteca` per gli enti, `tua libreria` per le persone), perché la differenza terminologica resta importante. Le notifiche sono perdurate (vivono in `localStorage` come le altre) e si autoaccordano col flusso: appena l'utente pubblica un libro, può lasciare la notifica nel pannello come "letta" oppure consumarla cliccando — non c'è alcuna sparizione automatica, perché la decisione su quando il consiglio è stato seguito appartiene all'utente.

Il secondo meccanismo è un **empty-state grande** sulla pagina profilo per chi ha zero volumi pubblicati. Invece di una griglia vuota seguita da un piccolo bottone in toolbar, la sezione *La mia libreria* mostra un riquadro tratteggiato che occupa tutto lo spazio: in cima un'illustrazione SVG di una pila di libri con un + giallo (la stessa dell'icona dello step 3 del wizard, per continuità visiva), poi il titolo *"La tua libreria è pronta — manca solo il primo volume"*, una copy che riprende l'invito senza ripeterlo, e infine un CTA `btn btn--primary btn--lg btn--pulse` che recita *+ Aggiungi il primo volume*. La classe `btn--pulse` applica una leggera animazione di scala (1.0 → 1.04 → 1.0 in 2 secondi, `prefers-reduced-motion: reduce` compreso) per attirare l'occhio senza essere fastidiosa. Sotto, in piccolo, un suggerimento alle impostazioni del profilo: l'utente che vuole prima sistemare l'aspetto del proprio scaffale e poi pubblicare ha un percorso chiaro. Appena pubblica anche un solo volume, l'empty-state lascia il posto alla griglia normale.

#### 4.16.3 Dropdown del profilo nel nav, con logout

Il pallino-avatar nel nav, introdotto in v1.2, era un semplice `<a href="profile.html">`. Funzionava ma offriva una sola azione, e non c'era altrove sulla piattaforma un modo per uscire dal proprio account. La v1.3 trasforma l'avatar in un `<button>` con `aria-haspopup="true"` e `aria-expanded` che apre un menu a tendina sotto di sé. Il menu (`role="menu"`) ha tre voci: in testa una piccola intestazione non interattiva con il nome dell'utente in display e l'`@username` in monospazio, poi *Vai al profilo* (sostituisce il vecchio click diretto), *Personalizza* (scorciatoia a profile-setup, l'altra rotta che già esisteva tramite il bottone sulla pagina profilo) e infine, separata da un border-top e colorata in bordeaux per segnalarne il diverso peso, *Esci*. Il menu si apre al click sull'avatar e si chiude in tre modi: click sullo stesso avatar, click fuori dall'area `.nav-avatar-wrap`, pressione di *Escape*. Tutti i listener sono installati una sola volta in fase di init. L'animazione di entrata è un `transform: translateY(-6px)` con `opacity: 0 → 1` in 180 ms (variabile `--avatar-menu-pop`), così la tendina sembra "cadere" sotto al pallino.

Il **logout** è il passaggio nuovo. Premuto *Esci*, si chiama `API.setAuthState('guest')` (il toggle riusa la stessa funzione che muove tutta la piattaforma fra le due modalità di visualizzazione), si mostra un toast *«Sei uscito. A presto su Lookup.»* per dare un attimo di chiusura, e dopo 600 ms si reindirizza a `index.html`. È una scelta consapevole: non si svuotano like, follow, notifiche o preferenze — sono attributi dell'utente in `users` e nelle tabelle correlate, restano lì in attesa del prossimo login; si azzera solo la sessione (lo stato `auth_state`). Per il prototipo, "sessione" significa la chiave `auth_state` in `localStorage`; in produzione sarebbe il cookie di sessione o il JWT in HttpOnly.

#### 4.16.4 Password reset simulato in tre step

Il link *Password dimenticata?* nella pagina di login esisteva da sempre come `<a href="#">`: cliccarlo non portava da nessuna parte. La v1.3 lo trasforma in un flusso completo che, pur essendo simulato, ricalca fedelmente lo state of the art di una webapp moderna. Tre nuovi metodi API gestiscono lo stato:

- `API.requestPasswordReset(email)` accetta un'email e — se esiste un utente con quella mail — genera un token pseudocasuale (composizione di `Date.now().toString(36)` + due slice di `Math.random().toString(36)`), lo registra in `localStorage` sotto la chiave `password_reset_tokens` con `user_id`, `email`, `created_at`, `expires_at` a sessanta minuti, `used: false`, e restituisce `{ ok, token, preview_url, simulated_only }`. Se l'email **non** esiste, restituisce comunque `{ ok: true }` ma con `token: null`: è la *uniform response* che evita di rivelare a un attaccante quali indirizzi sono registrati nella piattaforma (*username/email enumeration*).
- `API.validateResetToken(token)` controlla esistenza, scadenza e flag `used`, restituendo `{ valid, reason, email? }`.
- `API.completePasswordReset(token, newPassword)` richiama la validazione, verifica una lunghezza minima di 8 caratteri, aggiorna la password sull'utente, e marca il token come `used: true, used_at: <ora>`. Single-use, garantito.

In `localStorage` la struttura è equivalente a una tabella `password_reset_tokens(token PK, user_id FK, email, created_at, expires_at, used BOOLEAN, used_at)` — non si è creata la tabella in `sql/schema.sql` perché non era necessaria al prototipo, ma il commento all'implementazione lo segnala chiaramente per il porting futuro. In produzione la password sull'utente sarebbe un hash bcrypt, non il valore in chiaro che il prototipo accetta.

L'interfaccia è una pagina nuova, `reset-password.html`, che orchestra tre step nella stessa view (più sobria di tre pagine separate, perché lo stato si legge dal `?token=` in URL):

- **Step 1** (visibile di default): un campo email e il bottone *Invia istruzioni*. Sopra, un `auth-switch--top` *«Te la ricordi? Torna all'accesso»* coerente con lo stile della registrazione.
- **Step 2** (mostrato dopo il submit): un alert *«Controlla la tua posta»* con l'indirizzo reinserito, e — sotto — una *box "email simulata"* visivamente distinta (sfondo oro pallido, header *🔧 Demo del prototipo*) che rende cliccabile il link che l'utente "riceverebbe via email". Senza questo box, il flusso sarebbe non testabile, perché non c'è un backend di posta; con il box, la dimostrazione è completa e l'utente capisce la differenza fra ciò che vede e ciò che vedrebbe in produzione. La box viene mostrata **solo** se l'email esisteva davvero; per le email non registrate il messaggio di conferma resta identico ma il box rimane nascosto (uniform response anche lato UI).
- **Step 3** (raggiunto navigando il link, ovvero `reset-password.html?token=…`): la pagina valida il token e — se OK — mostra il form della nuova password. Due campi `<input type="password">` con il *toggle 👁* per mostrare/nascondere il valore, un **strength meter** a cinque livelli che combina lunghezza (≥8, ≥12), mix di maiuscole/minuscole, presenza di cifre e di simboli, con etichette monospazio (*Troppo corta*, *Debole*, *Discreta*, *Buona*, *Ottima*) e una barra che cambia larghezza e colore in tempo reale, e un feedback "✓ Le password coincidono" sotto al secondo campo. Al submit valido, il form sparisce e compare un alert success con un bottone *→ Vai all'accesso* che riporta al login. Se il token è scaduto, già usato o sconosciuto, lo step 1/3 è bypassato e si vede un alert d'errore con il motivo e un link per richiedere un nuovo reset.

L'intero flusso è validato da uno smoke test Playwright che inserisce email → clicca submit → naviga al link simulato → riempie le due password → verifica che lo step success diventi visibile. Sul login il vecchio `href="#"` è ora `href="reset-password.html"`: il bottone è finalmente cliccabile.

### 4.17 Recensioni e valutazioni a stelle (v1.4)

La v1.4 introduce l'unica funzione che mancava per fare di Lookup una vera community e non solo un catalogo: la **reputazione fra utenti**. Ogni membro può recensire la libreria di un altro con un voto da 1 a 5 stelle e un testo libero, e tutte le valutazioni che riceve si aggregano in una media visibile ovunque appaia il suo profilo. La scelta di lasciare la recensione testuale obbligatoria (minimo 20 caratteri) deriva dall'idea che la sola stella senza giustificazione produce rumore: una breve riga di esperienza concreta (*"libri restituiti puntualmente"*, *"persona competente"*, *"orari un po' rigidi ma giustificati"*) trasforma il voto in informazione spendibile.

#### 4.17.1 Modello dati e vincoli

La tabella nuova è `reviews(id, target_user_id, reviewer_id, rating, text, created_at, updated_at)`. I vincoli sono espressi a livello DB (non solo nell'API): `CHECK rating BETWEEN 1 AND 5` impedisce voti fuori scala, `CHECK char_length(text) >= 20` rifiuta i testi troppo corti, `CHECK target_user_id <> reviewer_id` blocca le auto-recensioni e — il vincolo più importante — `UNIQUE (target_user_id, reviewer_id)` garantisce **una sola recensione per coppia recensore/destinatario**. Nel prototipo il vincolo è gestito dal metodo `submitReview` con logica di upsert (se esiste già una recensione, la aggiorna; altrimenti la crea); in produzione il `UNIQUE` farebbe lo stesso lavoro lato DB e l'applicazione lo intercetterebbe come violazione di constraint, mostrando *"hai già recensito questa libreria"*. Si è scelto deliberatamente di permettere la **modifica** della propria recensione (la rappresentazione mostrata è sempre l'ultima versione) e l'**eliminazione** dal proprio autore: sono pattern standard delle webapp moderne, e proteggono dalla situazione in cui il recensore cambia idea con il tempo (un'esperienza isolata negativa che dopo dieci prestiti felici merita di essere ammorbidita).

Gli indici sono `idx_reviews_target ON (target_user_id, created_at DESC)` per il caso d'uso dominante — *"dammi tutte le recensioni di Chiara, dalla più recente"* — e `idx_reviews_reviewer ON (reviewer_id, created_at DESC)` per la simmetrica *"cosa ha recensito questo utente"*, utile in vista futura di un profilo arricchito.

Per il prototipo si è generato un dataset di **45 recensioni di esempio**, distribuite circa equamente sui 10 utenti campione (4–5 ciascuno), con voti deliberatamente non tutti perfetti: la maggior parte sono 4 e 5 stelle, qualche 3 dove ha senso (*"orari rigidi ma giustificati"*, *"qualche libro un po' segnato"*) per evitare l'effetto "tutto perfetto" che farebbe perdere credibilità al sistema. I contenuti sono **differenziati per tipo di profilo**: gli enti ricevono recensioni con toni più formali e accenni al servizio collettivo (*"una realtà preziosa per il quartiere", "collaborazione fruttuosa per un nostro reading"*), le persone ricevono recensioni più personali (*"Chiara è una lettrice attentissima", "Marco è un vero appassionato del genere"*). Il dataset esiste sia come `SAMPLE_REVIEWS` in `js/app.js` (per il prototipo localStorage) sia come blocco di `INSERT INTO reviews ...` in `sql/seed_data.sql` (per il porting al DB reale).

#### 4.17.2 Le stelle: SVG inline, palette editoriale, tre stati

L'helper `UI.renderStars(rating, opts)` genera un blocco `<span class="stars">` con cinque SVG inline. La libreria sceglie lo stato di ciascuna posizione *i* a partire dal valore numerico *r*:

- *full* se `r - (i-1) ≥ 0.75` (la stella è ampiamente coperta)
- *half* se `r - (i-1) ≥ 0.25` (è coperta a metà)
- *empty* altrimenti

La media `4.8` produce quindi *full full full full full* (le ultime 0.2 contano come 0); `4.3` produce *full full full full half*; `2.7` produce *full full half empty empty*. Il rendering della mezza stella usa due path: l'outline normale (semitrasparente, `stroke-width 1.2`, `opacity 0.55`) e un fill dorato `clip-path: inset(0 50% 0 0)` che mostra solo la metà sinistra. È una tecnica SVG/CSS pulita, senza dipendenze, che si adatta a qualunque dimensione senza perdita di nitidezza.

La palette è **dorata** (`--color-gold`, `#b08840`) per ragioni semantiche: l'oro è la convenzione visiva universale delle valutazioni e si lega bene alla famiglia cromatica editoriale già usata per i dettagli accent (vedi linee dei wizard, separatori, bordi degli enti). Le opzioni dell'helper coprono i casi reali — `size: 'sm'|'md'|'lg'` per le tre dimensioni standard, `count: N` per il suffisso *"23 recensioni"* in monospazio, `asLink: '#recensioni'` per renderlo cliccabile con scorrimento alla sezione dedicata, `showAverage: true` per accodare il valore numerico in font mono come `4.8`. Lo stesso componente è usato in cinque punti diversi (hero libreria, header profilo, nearby card, popup mappa, card recensione) con dimensioni e opzioni leggermente differenti — il riuso è completo, lo styling globale.

#### 4.17.3 La sezione recensioni: riepilogo, form, lista

Su `library.html` la sezione `#recensioni` è il nuovo blocco finale, separato da una linea sottile e da uno spazio generoso dal catalogo dei volumi. La prima cosa che si vede è il **riepilogo grande**: a sinistra una colonna con il voto medio in tipografia display da 3.4rem (un numero che cattura subito l'occhio: *"4.8"*), sotto le cinque stelle in formato large, sotto ancora la conta delle recensioni in monospazio sottile; a destra la **distribuzione 1★–5★** in cinque righe ciascuna con il numero della stella, una barra dorata proporzionale alla frequenza, e il conteggio in monospazio. Il pattern è quello di Amazon/Trustpilot/Goodreads, ma rivisitato nei colori e nelle proporzioni per restare nello stile della piattaforma. Su mobile il riepilogo collassa in colonna unica, col separatore sottile sotto la colonna numerica.

Subito sotto, il **form di scrittura**. Il rendering è condizionale e gestito da `UI.renderReviewForm(container, targetUserId, onSubmit)`: se l'utente non è autenticato, mostra un alert info con il link al login e alla registrazione; se è il proprietario stesso, mostra il messaggio *"Questa è la tua libreria — qui leggi le recensioni che gli altri lasciano per te"*; in tutti gli altri casi mostra il form vero. Il form è composto da una riga di **cinque stelle cliccabili** (tasti `<button role="radio">` per accessibilità), una etichetta dinamica accanto che cambia col voto selezionato (*Inadeguato / Insufficiente / Discreto / Buono / Eccellente*), una textarea con contatore caratteri "*N/20 minimi*" in tempo reale, e due bottoni: *Pubblica recensione* (primario bordeaux) e — se c'è già una recensione esistente dell'utente corrente — *Elimina* (ghost) accanto. Il bottone Pubblica diventa *Aggiorna* automaticamente in modalità upsert, e il titolo del form passa da *"Lascia una recensione"* a *"Aggiorna la tua recensione"*. Il submit valida due cose lato JS (voto > 0, testo ≥ 20 caratteri) e poi chiama `API.submitReview` che valida le stesse cose lato API. In caso di successo: toast di conferma e re-render completo della sezione (così la nuova recensione appare immediatamente nella lista e il riepilogo si aggiorna).

La **lista** che chiude la sezione è una serie di card pulite (`.review-card`): a sinistra avatar circolare colorato col tema dell'autore (riusa le quattro varianti `cover--classic/bordeaux/sage/notturno` definite per le copertine libreria) col simbolo personalizzato, accanto nome in display e `@username` in monospazio; a destra le cinque stelle del voto e la data in monospazio uppercase; sotto il testo della recensione in font body con line-height generoso. L'hover sulla card accende leggermente il bordo (bordeaux 30% opacità) per dare il senso che è interagibile (in futuro si potrebbe linkare alla pagina del singolo autore della recensione).

#### 4.17.4 Integrazione capillare

Le stelle compaiono **ovunque** appaia un profilo, non solo nelle due pagine dedicate: nell'hero di `library.html` accanto al nome con il link `#recensioni`; nell'header di `profile.html` con link a `#panel-reviews` (che apre direttamente la tab Recensioni); nelle card *Librerie vicine* sulla home, sotto al nome in dimensione `sm`; e nei popup della mappa in `explore.html` (in tutte queste mostriamo solo la libreria che ha almeno una recensione, per non sovraffollare di "0 recensioni" gli scaffali nuovi). La tab Recensioni sul profilo personale, infine, è il punto in cui il proprietario può leggere tutto in un colpo solo cosa la comunità pensa della sua libreria: stesso riepilogo grande, stessa lista — ma niente form (non puoi recensirti). Aprendola direttamente dall'anchor (`#panel-reviews`) le stelle del proprio header diventano un'ottima scorciatoia: clic, scroll, tab aperta, riepilogo davanti agli occhi.

### 4.18 Ciclo del prestito, timeline visuale, recensioni ancorate al prestito (v1.5)

Con la v1.5 la piattaforma compie un passo cruciale: il prestito smette di essere una semplice "richiesta inviata, status pending" e diventa un **percorso strutturato a cinque stati**, ognuno con un timestamp, ognuno con un'azione ben precisa da parte del richiedente o del prestatore. Da questa scelta derivano a cascata altre cose: la timeline visuale che racconta il viaggio del libro, la pagina dedicata che il richiedente apre per vedere a colpo d'occhio dove si trovano i suoi prestiti, il vincolo che lega le recensioni a un'esperienza reale conclusa, e una nuova distinzione fra "ciò che il richiedente vede" e "ciò che il prestatore deve fare".

#### 4.18.1 Cinque stati, sei transizioni, due ruoli

Il ciclo è lineare e unidirezionale: `requested` → `confirmed` → `borrowed` → `returning` → `returned`. Ogni transizione è eseguita da uno specifico ruolo, ognuno conosce la propria parte:

| Stato di arrivo | Chi lo attiva | Cosa significa per l'utente |
|---|---|---|
| `requested` | Richiedente (chiedendo il prestito) | "Ho inviato la richiesta" |
| `confirmed` | Prestatore (accettando) | "Ok, vieni a prenderlo" |
| `borrowed`  | Richiedente (dopo il ritiro fisico) | "L'ho in mano" |
| `returning` | Richiedente (avviando la restituzione) | "Sto restituendo" |
| `returned`  | Prestatore (confermando la ricezione) | "L'ho riavuto, fine" |

Si è scelto deliberatamente di **non automatizzare** alcuna transizione (es. "dopo 7 giorni di `confirmed` passa a `borrowed`") perché ogni passaggio porta un'informazione sociale: la conferma del ritiro da parte del richiedente significa "sono andato fisicamente, ho il libro" — un atto che protegge il prestatore (sa quando esattamente il volume è uscito di casa) e responsabilizza il richiedente. Le stesse considerazioni valgono per il passaggio `returning` → `returned`: solo il prestatore può confermare la ricezione, perché solo lui sa quando il libro è davvero tornato nelle sue mani.

Lo schema SQL (`sql/schema.sql`) è stato esteso di conseguenza: la vecchia tabella `loan_requests` con `status IN ('pending','accepted',…)` è stata sostituita da una versione con i cinque nuovi stati come valori ammessi e un timestamp dedicato per ciascuno (`requested_at`, `confirmed_at`, `borrowed_at`, `returning_at`, `returned_at`). Gli indici sono mirati ai due casi d'uso dominanti: *"dammi tutti i miei prestiti come richiedente"* e *"dammi tutte le richieste che ho ricevuto come prestatore"*, ordinate per data discendente. Il vincolo `CHECK requester_id <> lender_id` impedisce l'auto-prestito a livello DB. Si è preservata la coerenza con le notifiche: ogni transizione genera una notifica all'altra parte (`loan_request`, `loan_confirmed`, `loan_picked_up`, `loan_returning`, `loan_returned`), così entrambi sanno in tempo reale a che punto siamo.

#### 4.18.2 La pagina "I miei prestiti" e la timeline orizzontale

`loans.html` è la nuova pagina dedicata al richiedente (raggiungibile dal dropdown del profilo come *↪ I miei prestiti*). In cima tre statistiche su griglia di tre colonne: prestiti totali, **volumi attualmente in tuo possesso** (evidenziato in bordeaux, perché è il dato che l'utente cerca per primo), richieste aperte. Sotto, una colonna di card prestito, ognuna con la stessa anatomia: copertina del libro a sinistra, titolo + autore + prestatore in mezzo, bottoni azione adatti allo stato a destra, e in fondo la **timeline orizzontale**.

La timeline è generata da `UI.renderLoanTimeline(loan, opts)` con cinque `<li>` (uno per stato) disposti su `display: grid; grid-template-columns: repeat(5, 1fr)`. Ogni nodo ha tre stati visivi: *raggiunto* (cerchio bordeaux pieno con segno di spunta SVG bianco), *attuale* (raggiunto + ingrossato a 44×44 con un alone semitrasparente che pulsa ogni 2.4 secondi), *futuro* (cerchio crema con il numero d'ordine in monospazio, opacità ridotta). Le linee connettrici sono posizionate `absolute` dentro l'`<li>` con `left` calcolato sul centro del nodo + il raggio del dot, così la geometria resta corretta anche quando un nodo si ingrossa. Sotto al cerchio: l'etichetta dello stato (*"Richiesta confermata"*) in font body, e — se la transizione è già avvenuta — il timestamp relativo (*"un giorno fa"*) in monospazio piccolo. Il dettaglio "centralità di *Prestato*" è automatico: essendo il 3° su 5, finisce visivamente nel mezzo della timeline, ed è proprio quello dove il libro "si trova" in senso fisico — al centro del proprio viaggio. La hint sotto la timeline (*"Ora puoi recarti fisicamente a prendere il volume"*, *"Il volume è in tuo possesso. Quando hai finito, avvia la restituzione"*) è un rigo di testo con un border-left bordeaux che orienta l'utente verso il prossimo passo senza farlo cercare. Su viewport sotto i 700px la timeline collassa in **verticale**: ogni nodo prende una riga, le connettrici scompaiono, le etichette diventano leggibili anche su schermo stretto. La versione `compact` della timeline (senza data e con dot più piccoli) è usata nella tab "Richieste ricevute" del profilo, dove serve solo un'indicazione veloce dello stato.

#### 4.18.3 Il wizard di restituzione e l'email simulata

L'avvio della restituzione è il passaggio più delicato del ciclo, perché segna il momento in cui il libro "lascia il richiedente" senza essere ancora "tornato dal prestatore". Per non confondere l'utente con un click silenzioso, si è scelto un **wizard modale**: bottone *↦ Inizia restituzione* sulla card del prestito → si apre un overlay con backdrop sfocato → un riepilogo del volume (copertina, titolo, autore, prestatore) + una nota chiara sul prossimo passo (*"Una volta avviata la restituzione, lo stato del prestito passerà a 'Restituzione in corso'. Sarà cura del prestatore confermare la ricezione del volume per chiudere definitivamente il prestito"*) → due bottoni *Annulla* e *Conferma e avvia*. Il wizard si chiude su *Annulla*, click sul backdrop, oppure pressione di *Escape* (accessibilità). Quando si conferma, si chiama `API.startReturn(loanId)` che fa tre cose: aggiorna lo status a `returning` con il timestamp, manda una notifica al prestatore, e **salva un'email simulata** in `localStorage['simulated_emails']` con `to`, `to_name`, `subject`, `body_html`, `loan_id`, `created_at`.

L'email non viene davvero inviata (non c'è SMTP nel prototipo), ma viene **mostrata in pagina** in un box dedicato: sotto la card del prestito in stato `returning` appare il box *"🔧 Demo del prototipo — l'email inviata al prestatore"* con sfondo oro pallido come nel password reset, e dentro: indirizzo del destinatario, oggetto, corpo HTML che include il link `loans.html?id=${loan.id}`. Il prestatore aprendo quel link arriva direttamente alla card del prestito (`?id=` evidenzia con un alone bordeaux la card corrispondente e ci scrolla sopra con `behavior: 'smooth'`). In produzione il box scomparirebbe: l'email arriverebbe davvero via posta, e il link funzionerebbe identicamente. Lo stesso ragionamento del password reset, applicato a un caso d'uso diverso.

La controparte è la **tab "Richieste ricevute"** del prestatore (su `profile.html`): mostra le sue richieste con timeline compatta. Per i prestiti in stato `requested` compare *✓ Conferma richiesta*; per quelli in stato `returning` compare *✓ Conferma ricezione del volume*. Quest'ultimo è il pulsante che chiude il ciclo: lo stato diventa `returned`, il libro torna disponibile per nuovi prestiti, e — questo è il punto importante — entrambi i partecipanti possono ora **lasciarsi una recensione**.

#### 4.18.4 Le recensioni adesso pesano: serve un prestito concluso

Il vincolo è essenziale: in v1.4 chiunque poteva recensire chiunque (era già qualcosa, perché richiedeva autenticazione e impediva l'auto-recensione), ma il sistema soffriva di un problema teorico di credibilità — un utente cattivo poteva inondare di valutazioni un altro senza aver mai avuto un rapporto reale. La v1.5 chiude la falla: in `API.canReview(targetUserId)` aggiungiamo il controllo "almeno un prestito con status `returned` fra l'utente corrente e il target, in qualsiasi direzione (lui ha prestato a me o io ho prestato a lui)". Se non c'è, la risposta è `{ ok: false, reason: 'no-completed-loan' }` e il form sulla pagina libreria mostra il messaggio *"Per recensire questa libreria devi prima aver concluso almeno un prestito. Le recensioni sono ancorate a un'esperienza reale di scambio"*. Le 45 recensioni di esempio precedenti restano in *modalità grandfathered*: esistono pre-esistenti al vincolo e sono trattate come storia consolidata; il vincolo si applica solo ai nuovi tentativi. Per supportare i test del flusso completo, abbiamo seminato 15 prestiti sample (`SAMPLE_LOANS`), distribuiti fra stati diversi: alcuni in `requested`, alcuni in `borrowed`, alcuni in `returning`, alcuni `returned`. Le date sono **dinamiche** — calcolate con `daysAgo(N)` ad ogni seeding — così la demo è sempre "fresca" e i timestamp relativi (*"2 giorni fa"*, *"una settimana fa"*) restano coerenti senza richiedere manutenzione.

#### 4.18.5 Dettagli minori: time-ago, niente self-like

Due rifiniture chiudono l'iterazione. La prima: la nuova utility `UI.timeAgo(iso)` produce frasi italiane corrette per qualunque differenza (*"pochi secondi fa"*, *"un minuto fa"*, *"3 ore fa"*, *"una settimana fa"*, *"un mese fa"*, *"2 anni fa"*) ed è applicata sopra alla data assoluta nelle card recensione (la data ISO resta lì sotto, in monospazio piccolo, per chi vuole il dettaglio preciso). La seconda: si è eliminato il **self-like**, cioè la possibilità di mettere "mi piace" ai propri libri. Era un'incongruenza visiva (un cuore sul libro che hai pubblicato tu non vuole dire niente) e un piccolo rischio di gonfiare artificialmente i contatori. La modifica è chirurgica: in `renderBookCard` calcoliamo `isOwn = me && +book.owner_id === +me.id` e omettiamo del tutto il chip se è vero; su `book-detail.html` il pulsante *Mi piace* è nascosto con `hidden = true` quando il visitatore è il proprietario. Niente avvisi, niente messaggi: semplicemente, sui tuoi libri il cuore non c'è.

### 4.19 Rifiuto e annullamento, scadenza con sollecito, recensioni scritte (v1.6)

Con la v1.5 il ciclo del prestito era diventato strutturato — cinque stati, transizioni unidirezionali, timeline visuale — ma restava il dubbio su cosa succedesse quando le cose **non** andavano nella direzione standard. Cosa fa il prestatore se la richiesta non gli sta bene? E il richiedente se ci ripensa? Cosa succede se il libro non torna entro un tempo ragionevole? La v1.6 risponde a queste tre domande chiudendo i percorsi laterali del ciclo e introducendo un meccanismo di scadenza con sollecito automatico. Nello stesso colpo, l'area recensioni guadagna una vista *"Scritte"* speculare a quella delle ricevute, completando la simmetria delle due direzioni di valutazione.

#### 4.19.1 Lo slider dei giorni: durata pattuita all'origine

Già al momento della richiesta di prestito serve sapere per quanto tempo il richiedente vorrebbe tenere il volume. Si è introdotto un **input slider HTML5** (`<input type="range" min="5" max="28" step="1" value="14">`) nel dialog di richiesta su `book-detail.html`, stilato per restare coerente con la palette: thumb bordeaux con bordo crema e ombra, traccia sottile in due colori (`linear-gradient` bordeaux/crema), pillola monospazio con il valore numerico aggiornato in tempo reale ("21 giorni") accanto all'etichetta. Sotto al cursore due piccole etichette mono "5 gg" e "28 gg" segnano gli estremi. La scelta del range — 5 minimo, 28 massimo — bilancia due esigenze: cinque giorni è il limite ragionevole sotto cui il prestito perde senso pratico (sotto, il libro non si finisce); ventotto giorni (un mese in pratica) è il massimo oltre cui il prestatore si sentirebbe "privato" del proprio volume troppo a lungo. Il default a 14 giorni è il compromesso più frequente nelle biblioteche civiche italiane. La validazione è doppia: il `min`/`max` dell'input HTML5 limita l'UI, e l'API `requestLoan(bookId, requesterId, message, daysRequested)` clamp il valore in `[5, 28]` con fallback a 14 — così se qualcuno aggira l'input lato client, il backend regge comunque.

Il valore si memorizza sul prestito come `days_requested` e diventa il punto di riferimento per il calcolo della scadenza: `deadline = borrowed_at + days_requested * 24h`. Lo schema SQL è esteso di conseguenza (`days_requested SMALLINT CHECK (BETWEEN 5 AND 28)`), e i 15 prestiti di esempio portano valori variabili (7, 10, 14, 21, 28 giorni) così la demo mostra subito casi diversi — uno dei prestiti seminati, *Napoli milionaria!*, è volutamente sotto-dimensionato (in possesso da 15 giorni con un termine di 7) e fa scattare automaticamente il sollecito al primo caricamento, rendendo dimostrabile il meccanismo senza che l'utente debba aspettare giorni.

#### 4.19.2 Il sollecito automatico: doppio canale, una sola volta

Quando il `now` supera la `deadline` di un prestito in stato `borrowed`, deve partire un sollecito. Ma quando si controlla? In una webapp con backend, un cron job periodico (ogni ora) gira sui prestiti scaduti e invia le email. Nel prototipo non c'è un cron, quindi si fa **opportunistic checking**: il metodo `API.checkOverdueLoans()` viene chiamato ad ogni `Storage.init()` (cioè ad ogni caricamento di pagina) e, ridondantemente, anche all'apertura di `loans.html`. Scorre tutti i prestiti `borrowed`, calcola la deadline, e per quelli scaduti senza un `reminder_sent_at` esegue tre azioni atomiche: imposta il timestamp del sollecito, aggiunge una notifica `loan_overdue` (icona ⏰) al richiedente, e registra un'email simulata in `simulated_emails` con oggetto *"Sollecito restituzione: …"* e corpo HTML che contiene il calcolo dei giorni di ritardo e il link diretto al prestito (`loans.html?id=N`). Il flag `reminder_sent_at` garantisce l'invio **una sola volta**: il check successivo trova il flag pieno e salta il prestito.

Il box "🔧 Demo del prototipo" che già mostrava l'email di restituzione (avviata dal richiedente) viene riusato per i solleciti: la funzione `renderSimulatedEmailFor(loan)` su `loans.html` accetta ora due trigger, `status === 'returning'` come prima e `status === 'borrowed' && reminder_sent_at` per i solleciti. L'utente vede così sotto la card del prestito scaduto l'email completa che il sistema "gli ha inviato": destinatario, oggetto, corpo con il link. In produzione, naturalmente, il box scompare — l'email arriva davvero. Il design è identico al pattern del password reset (sfondo oro pallido, header *🔧 Demo del prototipo*) per coerenza visiva con tutte le altre simulazioni email del prototipo.

Lato visivo, ogni card prestito calcola sempre lo stato di scadenza e mostra un piccolo badge se rilevante: *"⏰ Scaduto da N giorni"* (bordeaux pulsante per i ritardi conclamati), oppure *"Restituisci entro N giorni"* (oro, niente pulsazione) quando mancano 3 giorni o meno. Sotto al titolo, per i prestiti `borrowed`, una riga *"Periodo pattuito: X giorni"* informa con chiarezza dei termini. Tutto il complesso visivo nasce dal singolo campo `days_requested` impostato in fase di richiesta.

#### 4.19.3 Rifiuto motivato e annullamento

Due stati nuovi terminali — `rejected` e `cancelled` — chiudono i percorsi laterali del ciclo. Entrambi erano già previsti nello schema (l'enum dei `status` ammessi li contemplava), ma mancava l'UI per attivarli. Il **rifiuto** è prerogativa del prestatore: nella tab "Richieste ricevute" del profilo, ogni richiesta in stato `requested` mostra ora due bottoni invece di uno solo — *✓ Conferma richiesta* (primario) e *✕ Rifiuta* (ghost). Click su Rifiuta apre un **modale dedicato** che chiede una motivazione testuale obbligatoria (min 10 caratteri, validata sia lato UI che lato API in `rejectLoan(loanId, reason)`). La scelta di rendere obbligatoria la motivazione deriva da una considerazione sociale: in una community basata sulla fiducia, rifiutare un libro "in silenzio" lascia il richiedente confuso e potenzialmente offeso; chiedergli una riga (*"Il volume è già impegnato per un altro prestito imminente"*, *"Preferisco non prestarlo, è una copia troppo fragile"*) costa poco al prestatore e tantissimo al richiedente. Il motivo viene poi mostrato sulla card del prestito rifiutato al posto della timeline, dentro un box con border-left bordeaux e tipografia corsiva.

L'**annullamento** è simmetrico, prerogativa del richiedente: la card del prestito in stato `requested` (su `loans.html`) ha ora un bottone *✕ Annulla richiesta* (ghost). Click → `confirm()` JS → `API.cancelLoan(loanId)`. A differenza del rifiuto, qui non si chiede una motivazione — è una scelta interna del richiedente, non c'è un destinatario a cui giustificarsi (la notifica al prestatore è breve e neutra: *"Il richiedente ha annullato la richiesta"*). La card mostra un banner soft *"Richiesta annullata da te"* con border-left grigio in luogo della timeline. L'annullamento è permesso **solo** da `requested`: una volta confermato il prestito, per "tirarsi indietro" servirebbe una procedura più complessa che esula dallo scopo di questa iterazione.

Entrambi gli stati sono terminali: una volta `rejected` o `cancelled`, il prestito non si muove più. La tabella `loan_requests` ora ha due nuovi timestamp dedicati (`rejected_at`, `cancelled_at`) e un nuovo campo `rejection_reason TEXT`. Le notifiche nuove (`loan_rejected`, `loan_cancelled`) si aggiungono al routing intelligente del pannello campanella: quelle del richiedente (es. rifiuto ricevuto) portano a `loans.html?id=N`, quelle del prestatore (es. annullamento ricevuto) portano a `profile.html#panel-requests`. Le icone scelte — ✕ per il rifiuto, ⊘ per l'annullamento — sono visivamente distinte e si leggono al volo nel feed.

#### 4.19.4 Recensione: suggerimento più forte e vista "Scritte"

Due rifiniture all'area recensioni completano la simmetria della v1.6. La prima: quando un prestito passa a `returned`, la card sulla pagina dei prestiti ora mostra il bottone *★ Lascia una recensione* come **CTA primario** bordeaux (era ghost in v1.5) — un invito chiaro a chiudere il cerchio sociale del prestito. Se l'utente ha già lasciato una recensione (verificato con `API.getReviewByPair(lender_id, me.id)`), il bottone scompare e al suo posto compare un piccolo tag *"✓ Recensione lasciata"* in verde sage, così da non chiedere due volte la stessa cosa.

La seconda: la tab "Recensioni" del profilo personale, prima dedicata solo alle recensioni ricevute, ora ospita **due sub-tab** "Ricevute" e "Scritte" in stile pillola (bordeaux/crema). Il conteggio appare nel chip a destra di ognuna ("Ricevute (5) · Scritte (9)"), aggiornato dinamicamente. La sub-tab *Scritte* mostra l'elenco delle recensioni che l'utente ha lasciato ad altri — nuova API `API.getReviewsByReviewer(userId)`, nuovo helper UI `UI.renderReviewsByReviewerList(container, reviewerId)`. Le card "scritte" hanno una piccola differenza visiva rispetto alle "ricevute": un'etichetta *"HAI RECENSITO"* in monospazio uppercase sopra al nome (è il target della recensione, non l'autore), e nel footer due bottoni *✎ Modifica* (link a `library.html?id=N#recensioni`) e *🗑 Cancella* (con `confirm()` JS, chiama `API.deleteReview(id)` già esistente). È la chiusura naturale del giro: vedi cosa ricevi nella sub-tab principale, vedi cosa hai dato e puoi rivederlo in quella nuova. La simmetria delle due viste rende il sistema di reputazione più trasparente — non si gestisce solo *quello che gli altri dicono di te*, ma anche *quello che tu hai detto degli altri*.

### 4.20 Chat di prestito, filtri notifiche, documenti legali, export GDPR (v1.7)

Con la v1.7 chiudiamo quattro buchi rimasti dal `<TODO>` storico: la comunicazione fra le parti del prestito (oltre al messaggio iniziale della richiesta), un centro notifiche più ricco di significato, due pagine legali reali al posto dei placeholder nel footer, e il diritto di portabilità del GDPR effettivamente esercitabile dalla pagina del profilo. Le quattro funzionalità sono indipendenti come scope, ma condividono lo stesso *pattern di design*: trasformare una "mancanza" del prototipo in qualcosa di credibile anche in un'ottica produttiva.

#### 4.20.1 La chat: messaggi liberi più scia narrativa dello stato

Il modello mentale di riferimento è Vinted: ogni transazione (lì un acquisto, qui un prestito) ha la propria conversazione, e dentro la conversazione si mescolano *messaggi liberi* fra le parti e *messaggi di sistema* generati automaticamente alle transizioni di stato. La chat non è un'aggiunta esterna, è il **luogo naturale** dove leggere la storia del prestito. Si è scelto deliberatamente di metterla inline sotto a ogni card del prestito (sia su `loans.html` che su `profile.html > Richieste ricevute`) invece di costruire una pagina dedicata `messages.html`: la conversazione vive nel contesto, non in un silo separato.

La struttura del dato è semplice: tabella `loan_messages(id, loan_id, sender_id NULL, type, event_type, content, created_at, read_by[])`. Quando `sender_id` è NULL e `type='system'`, il messaggio è un sistema; altrimenti è user-generated. Il tracking delle letture è un array JSON `read_by` con gli userId che hanno aperto la chat dopo la creazione di quel messaggio — sufficiente per un prototipo; in produzione si userebbe una tabella separata `message_reads` per query più efficienti. La nuova API `getUnreadMessageCount(loanId, userId)` e `markLoanMessagesRead(loanId, userId)` gestiscono lo stato di lettura; `sendMessage(loanId, text)` valida (utente è uno dei partecipanti, contenuto non vuoto, max 2000 caratteri) e inserisce. Il metodo interno `_addSystemMessage(loanId, eventType, content)` è chiamato da **tutte le sette transizioni di stato** (`requestLoan`, `confirmLoan`, `confirmPickup`, `startReturn`, `confirmReturn`, `rejectLoan`, `cancelLoan`) e dal check del sollecito (`checkOverdueLoans`): la chat diventa così una *replica narrativa* di quel che è successo, con timestamp relativi accanto a ciascuna bolla.

Il componente UI `UI.renderLoanChat(container, loan, opts)` si occupa di tutto. Il toggle in alto mostra il nome dell'interlocutore e, se ci sono messaggi non letti, un badge bordeaux *"N nuovi"* che attira l'attenzione. Il pannello espandibile contiene una lista scrollabile (max-height 380px) di bolle. I messaggi user hanno avatar tematico (riusa le palette `cover--classic/bordeaux/sage/notturno` già definite) e bolla colorata: bordeaux se sono miei (a destra), crema con bordo sottile se sono dell'altro (a sinistra). I messaggi system sono pillole centrali, oro pallido, con icona dell'evento (📨 per richiesta, ✓ per conferma, ↦ per ritiro, ↩ per restituzione, ✓✓ per chiusura, ✕ per rifiuto, ⊘ per annullamento, ⏰ per sollecito). All'apertura del pannello, automaticamente: i messaggi vengono marcati come letti, il counter scompare, lo scroll va in fondo, l'input riceve focus. Enter invia (Shift+Enter va a capo). Dopo l'invio, la nuova bolla viene appesa senza re-render completo, per fluidità.

Le 26 bolle d'esempio (`SAMPLE_MESSAGES`) sono distribuite su 5 prestiti che coprono tutti gli stati: una conversazione di richiesta in corso (loan id=2), una con prestito in possesso (loan id=3, dove la chat racconta richiesta → conferma → ritiro), una scaduta (loan id=4, solo system messages perché nessuno ha ancora scritto), una chiusa (loan id=6, intera vita del prestito incluso "grazie mille — è stato preziosissimo"), e una in cui Chiara come prestatore non ha letto l'ultimo messaggio dei Lettori Erranti (loan id=9), così da dimostrare il badge unread.

#### 4.20.2 Filtri nel centro notifiche: navigare il rumore

Il centro notifiche v1.6 era già funzionale ma sopra il limite di una dozzina di notifiche diventava difficile trovare quello che si cercava. La soluzione è la più classica delle UX: chip-filtro in alto. Cinque chip pill (*Tutte / Prestiti / Recensioni / Social / Sistema*) in `display: flex` con scroll orizzontale su mobile, il chip attivo è bordeaux pieno, gli altri sono outline soft. Il filtro è uno stato locale dell'istanza del componente notifiche (`activeFilter` chiusura JavaScript), non è persistito — ogni apertura riparte da *Tutte*. Il counter rotondo sul bell continua a contare TUTTO il non letto, non il sottoinsieme filtrato: è la cosa giusta da fare perché l'indicatore visivo "hai notifiche nuove" non dipende dal filtro impostato. La funzione `matchesFilter(n)` mappa le categorie ai tipi di notifica:

- **Prestiti**: tutto ciò che inizia con `loan_*` (request, confirmed, rejected, cancelled, picked_up, returning, returned, overdue, message)
- **Recensioni**: `new_review`, `loan_returned` (perché spinge a recensire)
- **Social**: `new_book`, `book_available`, `new_follower`
- **Sistema**: `onboarding`

Quando una categoria è vuota appare il messaggio *"Nessuna notifica in questa categoria"* invece di sembrare un bug. Il bottone *"Segna tutte come lette"* (già esistente in v1.6) ha priorità sui filtri: marca **tutto**, non solo la categoria visualizzata, perché la sua semantica è chiara e non confonde l'utente che voglia "azzerare la campanella".

#### 4.20.3 Privacy + Termini: due documenti reali

I link nel footer puntavano a `href="#"` da sempre. Era una mancanza visibile, soprattutto in una piattaforma che gestisce dati personali. La v1.7 produce due documenti reali in italiano, lunghi e dettagliati ma scritti per essere leggibili — non boilerplate legalese. `privacy.html` è strutturato in 9 sezioni: premessa sul carattere didattico del prototipo, titolare del trattamento, dati raccolti (esplicitando che vivono in `localStorage`), servizi esterni utilizzati (OpenStreetMap, Open Library Covers, CDN Leaflet/Chart/Google Fonts) con link alle rispettive policy, email simulate (rimando al pattern del box "Demo del prototipo"), diritti GDPR con la nota che il prototipo implementa effettivamente la portabilità via export JSON, sicurezza, modifiche, contatti. `terms.html` ha 10 sezioni che coprono natura del servizio, iscrizione, pubblicazione di volumi, prestiti (con i loro impegni reciproci e il riferimento esplicito al range 5–28 giorni), recensioni, comportamento accettabile, proprietà intellettuale con riferimento alla licenza GPL-3.0, disclaimer ("as is"), modifiche, legge applicabile. Lo stile tipografico — definito nella nuova classe `.legal-doc` — riprende la tradizione editoriale del sito: titoli H2 in display con sottile linea di separazione, paragrafi in line-height ampio (1.7), code inline su sfondo paper-dark, link in bordeaux. Il footer di tutte le pagine è stato aggiornato in un colpo solo con `sed -i` per puntare ai nuovi URL.

#### 4.20.4 Esportazione GDPR: il diritto di portabilità reso effettivo

L'articolo 20 del GDPR sancisce il diritto di ricevere i propri dati personali in un formato strutturato, di uso comune e leggibile da una macchina. JSON soddisfa tutti e tre i requisiti. Il bottone *"↓ Scarica i miei dati (JSON)"* nella tab *Impostazioni* del profilo invoca `API.exportUserData(userId)`, che costruisce un oggetto con dodici sezioni: `_meta` (timestamp di esportazione, versione, nota GDPR), `user`, `preferences`, `org_profile`, `books` (solo quelli pubblicati dall'utente), `loans` con sotto-chiavi `as_requester` e `as_lender` (così è chiaro il ruolo), `messages` (tutti quelli dei prestiti dell'utente, sia user che system), `reviews` con sotto-chiavi `received` e `written`, `follows`, `likes`, `notifications`, `simulated_emails` (solo quelle relative ai prestiti dell'utente). Il principio fondamentale è "solo dati di cui l'utente è partecipante diretto": non si esportano informazioni private di altri utenti che potrebbero apparire in vista relazionale (es. nomi degli altri sì, ma non le loro preferenze, libri non-condivisi, follow/like personali). Il file scaricato si chiama `lookup-export-{username}-{date}.json` (es. `lookup-export-chiara.morandi-2026-06-09.json`). Per Chiara Morandi nel sample, sono circa 23 KB — un oggetto leggibile con qualunque editor di testo, programmaticamente parsabile, sufficiente per una migrazione o un backup personale.

Tre note tecniche: il download è generato lato client con `Blob` + `URL.createObjectURL` + `<a download>` cliccato programmaticamente — nessun server coinvolto, perché il prototipo non ne ha. In produzione la stessa operazione richiederebbe un'API server-side che ricostruisce l'oggetto dai database; il pattern di disegno dell'oggetto resta identico. Il `JSON.stringify` con indentazione `2` produce un file human-readable; per file molto grandi (centinaia di MB) si dovrebbe streaming, ma il caso del singolo utente non lo richiede. Il pulsante è in posizione coerente: la tab *Impostazioni* è dove un utente cerca naturalmente le opzioni del proprio account, e la sezione *"Esporta i tuoi dati"* sta sopra al bottone "Salva impostazioni" così da essere visibile anche senza scroll.

### 4.21 Fast-track Lettore, banner libreria, theme picker visuale (v1.8)

La v1.8 lavora su tre frizioni della UX rimaste dalle versioni precedenti. La prima — e la più importante — è il *funnel della prima richiesta di prestito*: un utente non iscritto che clicca *"Richiedi prestito"* doveva fino a ora attraversare tre passi prima di vedere la sua richiesta sulla pagina dei prestiti. Tre passi sono troppi per un'azione che dovrebbe essere immediata, e l'abbandono in quel punto era atteso anche se non misurato. La seconda è la *coerenza visiva dei selettori di tema*: il theme picker era nato come `<select>` testuale in v1.0, sopravvissuto a 17 iterazioni senza essere rivisitato, e stonava completamente con il resto dell'interfaccia editoriale dove ogni controllo significativo ha la propria identità visiva. La terza è l'*invito al passaggio da Lettore a Curatore*: il sistema sapeva distinguere i due ruoli ma non offriva un percorso evidente per cambiare ruolo, lasciando i Lettori in un limbo dove non capivano di poter pubblicare anche loro.

#### 4.21.1 Il fast-track: un solo passo, tutto automatico

Il flusso obiettivo è preciso: utente non iscritto → clicca *Richiedi prestito* su un libro → arriva su `register.html?intent=borrow&book=N` → compila i campi essenziali → clicca *Completa l'iscrizione* → si trova su `loans.html?id=M` con il prestito già creato sulla timeline. Un solo form, tre azioni dietro le quinte (crea utente, login, crea prestito).

Per ottenerlo abbiamo lavorato sulla pagina di registrazione in modo chirurgico, senza riscrivere il wizard a tre step esistente. La logica che decide quanti step mostrare era una funzione `lastStep()` che ritornava `isBorrower() ? 2 : 3`. L'abbiamo estesa con un terzo caso: `if (window.__isBorrowIntent) return 1`. La variabile `window.__isBorrowIntent` è impostata a `true` quando l'URL contiene `?intent=borrow`. A quel punto la nav-bar del wizard considera lo step 1 come quello finale, e il bottone *"Continua →"* viene sostituito da *"Completa l'iscrizione"*. La sequenza visiva degli step in cima alla pagina mostra il primo come attivo e gli altri due come *is-skipped* (in grigio, barrati), comunicando con chiarezza che il flusso è più corto del normale.

Lo step 1 da solo, però, non basta: contiene i dati account ma mancano i consensi GDPR (TOS, età), che vivono nello step 2 come fieldset accanto a bio/motto/theme. Abbiamo risolto **spostando il fieldset consensi nello step 1 al volo via JavaScript**, ottenuto con un semplice `step1Panel.insertBefore(consentsBlock, step1Footer)`. Il fieldset mantiene tutti i suoi vincoli (`required` sui checkbox obbligatori), e la validazione dello step 1 ora cattura anche loro. Bio, motto e theme — non più necessari per un Lettore puro — non vengono nemmeno mostrati. Anche la card del role-picker (*Persona / Lettore / Ente*) viene nascosta perché il Lettore è già pre-selezionato e la scelta è ridondante.

C'era un bug subdolo emerso durante lo smoke test: dopo aver impostato `window.__isBorrowIntent = true`, la nav-bar mostrava ancora *"Continua →"* invece di *"Completa l'iscrizione"*. Causa: `showStep` veniva chiamato per la prima volta al click del *Continua*, ma la sua logica era già stata precompilata nelle variabili `nextBtn.hidden = (n >= last)` e `finishBtn.hidden = (n !== last)`, con `last = lastStep()` calcolato al volo. All'init, però, queste variabili non venivano impostate (l'HTML era già nello stato del default *Persona*, lastStep=3). Soluzione: aggiungere una chiamata esplicita a `showStep(1)` subito dopo la definizione della funzione `showStep`, condizionata su `isBorrowIntent`. Una riga di codice, un bug risolto.

La parte server-less della creazione del prestito avviene nel submit handler. Quando il form viene completato, l'utente è già creato e loggato (logica esistente). Poi controlliamo: se `isBorrowIntent && pendingBook` (dal sessionStorage), chiamiamo `API.requestLoan(+pendingBook, newUser.id, pendingMessage, pendingDays)`. Tutti i parametri sono già stati salvati da `book-detail.html` al momento del primo tentativo: il modale di richiesta prestito salva `pending_loan_book`, `pending_loan_days`, `pending_loan_message` in sessionStorage prima del redirect, così il fast-track ha tutto pronto. Se la chiamata va a buon fine, redirect a `loans.html?id=N` (il `?id=N` evidenzia visualmente la card del prestito appena creato). Se fallisce per qualsiasi motivo (es. il libro nel frattempo è stato preso da altri), comunque si va a `loans.html` con un toast d'errore — non si lascia l'utente sospeso. In parallelo, una notifica `onboarding` di tipo *open-library* viene generata, così la campanella mostra subito *"Vuoi condividere i tuoi libri? Apri la tua libreria con un click"*. Il routing delle notifiche esistente la indirizza correttamente ad `add-book.html`.

#### 4.21.2 Il banner "Apri la tua libreria" sull'hub

Il banner che appare in cima a `profile.html` per gli utenti senza libri pubblicati ha tre obiettivi: visibilità (è la prima cosa che si vede entrando nell'hub), informazione (spiega chiaramente cos'è il passaggio Lettore→Curatore), azione (un CTA primario che porta dritti alla pubblicazione del primo libro). Il blocco usa una palette accent (gradiente bordeaux/oro semitrasparente) per distinguersi dal resto della pagina senza diventare invasivo, ha un'illustrazione SVG line-art (scaffale con simbolo "+" sovrapposto, coerente con lo stile delle altre illustrazioni della piattaforma), e una `×` di dismiss in alto a destra.

Il dismiss è persistente: quando l'utente clicca la `×`, salviamo `localStorage[open_library_cta_dismissed_{userId}] = '1'` e il banner non riappare più, fino a quando l'utente non pubblicherà un libro (che è già l'altro motivo di sparizione). La condizione di rendering è quindi `books.length === 0 && !dismissed`, valutata a ogni caricamento del profilo. Il banner è dismissibile per rispettare gli utenti che hanno consapevolmente deciso di restare Lettori senza voler aprire una libreria — non ha senso assillarli a ogni visita.

#### 4.21.3 Il theme picker: dal `<select>` al button-grid

La griglia delle quattro card del theme picker è composta da `<label>` (radio nascosto + span con nome + span con descrizione), stilate come blocchi di 110px di altezza con un gradiente come sfondo che è esattamente quello che il tema produrrà sulla copertina della libreria. Il nome in font display (Cormorant Garamond) e la descrizione in mono (JetBrains Mono) sono entrambi bianchi con un sottile text-shadow per garantire leggibilità su qualunque gradiente. La card selezionata si distingue per tre cose: bordo nero scuro, alone bianco di separazione esterno (`box-shadow: 0 0 0 3px paper, 0 0 0 5px ink`), e soprattutto un tick `✓` in un cerchietto bianco in alto a destra — il segno universale di selezione.

La griglia è responsive: `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))` significa che a viewport stretti le card si dispongono in 2×2 o 1×4. La transizione su hover è discreta — un piccolo `translateY(-2px)` e un cambio di bordo da `--color-line` a `--color-ink-soft` — coerente con il microfeedback degli altri controlli della piattaforma. Il nuovo stile si applica automaticamente anche a `profile-setup.html`, che usa lo stesso componente `.theme-swatch`: abbiamo aggiunto le descrizioni mancanti lì (in v1.7 erano vuote) così la simmetria è completa fra registrazione e personalizzazione. Risultato: la stessa scelta che prima richiedeva di leggere quattro righe di testo in un dropdown ora si fa con un colpo d'occhio sul gradiente — molto più *editorial*, molto più in linea con l'identità della piattaforma.

### 4.22 Simulatore stato, wizard apertura libreria inline (v1.9)

Quattro rifiniture chiudono il blocco di lavoro iniziato con il fast-track della v1.8. La prima è cosmetica: il riquadro giallo *"💡 Da lettore puoi richiedere prestiti..."* in `register.html` era una ripetizione esatta del banner bordeaux già mostrato in cima al form per `?intent=borrow`. Due blocchi di testo identici a 40 pixel di distanza l'uno dall'altro sono un classico errore di onboarding che dilata il primo schermo senza aggiungere informazione. Rimosso. Il riferimento JavaScript a `borrower-hint` è stato reso null-safe (`if (borrowerHint) borrowerHint.hidden = !borrower`) per evitare crash in caso di rimozione futura di altri snippet correlati.

#### 4.22.1 Il simulatore di stato come tool di demo

La seconda — e più sostanziosa — è il **simulatore di transizioni di stato** sui prestiti. In un prototipo accademico l'utente vuole vedere come si comporta il sistema quando lo stato di un prestito avanza, ma in un'app real-world ciò richiederebbe due account, sincronizzazione fra loro, e tempo. Abbiamo introdotto un escamotage: un pulsante *"🎬 Simula prossimo stato (demo)"* in fondo a ogni card di prestito attivo (visibile per gli stati `requested`, `confirmed`, `borrowed`, `returning`, nascosto per i terminali `returned`, `rejected`, `cancelled`). Lo stile lo distingue chiaramente dalle azioni reali: monospazio, oro, su sfondo color sabbia chiaro, con la dicitura *"A scopo dimostrativo: avanza il prestito allo stato successivo e fa rispondere automaticamente l'altra parte in chat"* accanto. Niente confusione con i controlli normali.

L'implementazione lato API è il metodo `simulateNextState(loanId)`. Il problema centrale era: come bypassare gli `if (+me.id !== +loan.lender_id) return forbidden` che ogni transizione effettua per garantire che solo l'attore corretto possa cambiare lo stato? La soluzione pulita è uno **swap temporaneo del `current_user_id`**:

```js
const savedCurrent = Storage.get('current_user_id', 1);
const actorId = next.actor === 'lender' ? loan.lender_id : loan.requester_id;
Storage.set('current_user_id', actorId);
const result = this[next.method](loanId);
Storage.set('current_user_id', savedCurrent);
```

Il `current_user_id` viene impostato sull'attore previsto, il transition method viene chiamato senza modifiche (raffina pure le validazioni, gli storage update, le notifiche, il messaggio di sistema in chat — tutto come in produzione), poi viene ripristinato. Il pattern è anche usato per inviare la **risposta contestuale automatica**: una volta avanzato lo stato, il simulatore swap `current_user_id` sull'altro partecipante e chiama `sendMessage` con il testo generato da `_contextualReply`. Questo garantisce che la notifica `loan_message` venga generata correttamente per l'utente che sta guardando la pagina (l'utente reale, che riceve il messaggio dall'altro). Tre swap, due chiamate ai metodi esistenti, zero codice duplicato.

Le risposte contestuali sono una banca di frasi: per ognuno dei quattro nuovi stati `confirmed`, `borrowed`, `returning`, `returned`, ci sono **tre frasi alternative** sia per il caso "altro è prestatore" sia per "altro è richiedente", per un totale di 24 stringhe. Il metodo `_contextualReply` sceglie una frase a caso con `arr[Math.floor(Math.random() * arr.length)]`, interpolando il nome dell'utente attivo. Esempi quando l'altro è il prestatore: per `confirmed`, *"Ciao [nome]! Ti ho confermato la richiesta, puoi venire a prenderti il libro quando ti torna comodo. Ti serve aiuto con la posizione?"*; per `returning`, *"Va bene, ho ricevuto la notifica di restituzione. Quando passi a riportarlo? Stessi orari di prima."* Il tono è colloquiale, riflette una conversazione realistica fra due persone che si stanno scambiando un libro nel quartiere — non un'email automatica.

L'animazione lato UI è semplice ma efficace: al click sul bottone, la card riceve la classe `is-simulating` che innesca una `state-fade` di 500ms su timeline e azioni (opacità da 1 a 0.3, scale da 1 a 0.97, blur 2px nei due frame centrali). Durante l'animazione viene chiamato `simulateNextState`, poi un toast informa del nuovo stato (*"🎬 Demo: stato avanzato → Restituzione avviata"*), e infine `render()` ridipinge la card con i nuovi dati. La chat sotto si aggiorna automaticamente perché il suo helper `UI.renderLoanChat` viene rimontato dal re-render con i messaggi nuovi (sistema + utente). Una `prefers-reduced-motion` guard disattiva l'animazione per gli utenti che la preferiscono spenta.

#### 4.22.2 Le notifiche chat confermate già funzionanti

La terza è una verifica esplicita richiesta dall'utente: *"Inoltre ad ogni messaggio di chat deve arrivare la notifica, controlla se questa cosa c'è già"*. La risposta è sì, era già implementata in v1.7 dal metodo `sendMessage`:

```js
const otherId = +me.id === +loan.requester_id ? loan.lender_id : loan.requester_id;
this.addNotification(otherId, {
  type: 'loan_message',
  actor_id: me.id,
  book_id: loan.book_id,
  loan_id: loan.id,
  message: `Nuovo messaggio da <strong>${me.display_name}</strong> sulla chat di <em>${book ? book.title : 'un volume'}</em>.`,
  created_at: new Date().toISOString()
});
```

Il routing era anch'esso già coperto: cliccando sulla notifica si arriva a `loans.html?id=N`, evidenziando il prestito specifico. Lo smoke test della v1.9 ha verificato che dopo un click del simulatore (che internamente chiama `sendMessage` dall'altro utente), il counter delle notifiche dell'utente corrente aumenta correttamente — la catena è chiusa.

#### 4.22.3 Il wizard di apertura libreria inline

La quarta è la finalizzazione del passaggio Lettore→Curatore. La v1.8 aveva introdotto un banner *"Apri la tua libreria"* sopra le tab del profilo + un secondo CTA nello stesso punto. Era ridondante. La v1.9 fa pulizia: il banner sopra le tab è eliminato, e l'**empty-state della tab libri diventa conditional sul ruolo dell'utente**. Per `library_role === 'borrower'` mostra una nuova CTA dedicata *"Vuoi diventare anche tu un curatore?"* con illustrazione SVG (libro con simbolo `+`), copy che spiega il passaggio in due righe, bottone primario *"📚 Apri ufficialmente la tua libreria"* e hint sottostante *"Bastano due minuti: ti chiediamo bio, città, motto e tema cromatico"*. Per `library_role === 'curator'` mostra l'empty-state classico *"La tua libreria è pronta — manca solo il primo volume"* con link diretto a `add-book.html`.

Il click sulla CTA Lettore innesca `startOpenLibraryWizard(container, user)`, che è la parte più interessante. La transizione visiva è in due tempi: prima `container.classList.add('is-transitioning')` (fade-out con `opacity → 0` e `translateY(10px)` in 280ms), poi `setTimeout(280, ...)` per sostituire `innerHTML` con il markup del wizard, e infine `is-wizard-active` (fade-in con `wizard-fade-in` keyframe). Il wizard vive **nello stesso `<div id="my-books">`** dove prima c'era l'empty-state — niente navigazione, niente stack browser polluito, l'utente resta esattamente dove era.

Il wizard ha tre step con la stessa estetica della registrazione: un progress indicator in monospazio in cima (`✓ 1. Identità` quando già fatto, `2. Estetica` quando attivo bordeaux), pannelli con `slide-in` da 8px a destra, e una nav in fondo (← Indietro / Continua → / 📚 Apri la libreria sull'ultimo step). I tre step coprono ciò che il fast-track v1.8 aveva tagliato per il Lettore: bio (min 20 caratteri, max 500), città (richiesta), motto (facoltativo), tema cromatico (4 swatch cliccabili, identiche a quelle introdotte in v1.8). L'ultimo step mostra un riepilogo `<dl>` di tutto e il bottone *"📚 Apri la libreria"*. Submit → `user.library_role = 'curator'`, bio/city aggiornati su `Storage.set('users')`, motto+theme su `Storage.set('profile_prefs_{id}')`, toast di successo, `location.reload()` per ripartire pulito. Al refresh, l'empty-state ora mostra *"+ Aggiungi il primo volume"* — l'utente è effettivamente diventato un Curatore.

Il **gate su `add-book.html`** chiude il loop: chi prova ad accedere alla pagina di pubblicazione mentre è ancora Lettore viene rispedito a `profile.html#panel-books` con un toast cortese *"Apri prima la tua libreria dal profilo per pubblicare volumi"*. Niente bypass possibile, niente crash se per caso uno arriva con un link diretto. Il flusso è ora coerente al 100%: Lettori che non hanno mai aperto libreria non possono pubblicare libri; il wizard è l'unica strada, e la strada è chiara.

### 4.23 Master-detail prestiti, badge esperienza, nav "Prestiti" (v2.0)

La v2.0 segna un cambio di paradigma sulla pagina `loans.html`. Fino alla v1.9, la pagina mostrava uno scroll verticale infinito di card — ogni prestito occupava 400-600px di altezza, con timeline, chat espandibile, simulatore. Funzionava bene con 3-4 prestiti, peggiorava rapidamente oltre i 10. Inoltre, mostrava soltanto i prestiti dove l'utente era richiedente; per gestire le richieste ricevute bisognava andare in `profile.html > Richieste ricevute`. Due viste separate per due ruoli sulla stessa entità: un'incoerenza che la v2.0 chiude. La nuova pagina è un **master-detail** che aggrega entrambi i ruoli, filtra per stato, e mostra un solo prestito alla volta nel pannello di dettaglio. Bump a 2.0 non perché l'API rompa qualcosa, ma perché il modello mentale dell'utente cambia: i prestiti diventano un'entità di prima classe, navigabile come una mailbox.

#### 4.23.1 Master-detail e filter pills

Il layout principale è una `grid` di due colonne (`grid-template-columns: 360px 1fr` su desktop). A sinistra una colonna sticky con la lista dei prestiti — sticky perché su un long list deve restare visibile mentre si scorre un dettaglio lungo. A destra, il pannello di dettaglio che cambia in base alla selezione. Su mobile (`max-width: 900px`) il layout collassa: si vede solo la lista per default, e il dettaglio è nascosto; cliccando un item, la lista scompare e appare il dettaglio con un *"← Torna alla lista"* in cima per tornare indietro. La stessa logica delle app di messaggistica nativa.

I **filter pills** in cima alla lista sono quattro chip a forma di pillola (*Tutti / In corso / Completati / Annullati*) con counter live. Il counter non è statico: a ogni `render()` viene ricalcolato dal numero di prestiti che passano il filtro corrispondente. La logica del filtro è in `passesFilter(loan, filter)`: *Tutti* lascia passare tutto; *In corso* è `['requested', 'confirmed', 'borrowed', 'returning'].includes(loan.status)`; *Completati* è `loan.status === 'returned'`; *Annullati* è `['rejected', 'cancelled'].includes(loan.status)`. La scelta di raggruppare *rejected* e *cancelled* sotto un'unica voce *Annullati* è stata pragmatica: a livello utente, entrambi sono "il prestito non si è concretizzato", il dettaglio del perché lo si trova entrando nel dettaglio. Lo stato visivo della pill attiva è bordeaux pieno, le altre outline soft.

I **list items** (`.loan-listitem`) sono ottimizzati per la scansione veloce. Ognuno è un button (`<button type="button" data-open-loan="N">`) accessibile a tastiera. Contiene una copertina miniaturizzata 50×70px con la classe tema dell'altra parte (così visivamente il colore richiama la libreria con cui si sta interagendo), il titolo del libro (con `text-overflow: ellipsis` se troppo lungo), un'etichetta *"da [nome]"* per i prestiti dove sono richiedente o *"a [nome]"* per quelli dove sono prestatore (con il ruolo in monospace uppercase per chiarezza grammaticale immediata), uno status pill colorato (`requested` oro chiaro, `borrowed` bordeaux, `returned` sage, `cancelled` grigio), e un timestamp relativo. Se ci sono messaggi chat non letti, un badge rosso `loan-listitem__unread` in alto a destra mostra il conteggio. L'item selezionato ha un `box-shadow: inset 3px 0 0 var(--color-burgundy)` che disegna una barra verticale bordeaux a sinistra — il classico segnaposto delle inbox.

#### 4.23.2 Aggregazione richiedente + prestatore, deep-linking

Il nuovo metodo `API.getLoansForUser(userId)` aggrega tutti i prestiti dove l'utente è uno dei due partecipanti, ordinati per `requested_at` discendente. Le **azioni nel dettaglio** si calcolano in `renderLoanDetail(loan)` basandosi sul ruolo dell'utente corrente: se `meIsRequester` mostra i bottoni del lato richiedente (annulla / conferma ritiro / inizia restituzione / lascia recensione); altrimenti i bottoni del lato prestatore (conferma / rifiuta / conferma restituzione). Il **simulatore di stato v1.9** continua a funzionare come prima — bypassa i controlli ruolo e fa avanzare lo stato a prescindere — visualizzato in coda alle azioni per gli stati non terminali. Il rifiuto da `loans.html` usa un `prompt()` semplice per la motivazione invece del modale custom presente su `profile.html`; semplificazione coerente con il fatto che il dettaglio è già contestuale e non serve un overlay.

Il **deep-linking** via hash `#loan-N` permette ai link delle notifiche di aprire direttamente il dettaglio del prestito specifico. Al cambio di selezione, `history.replaceState(null, '', '#loan-N')` aggiorna l'URL senza creare una nuova entry nella history (così il tasto "indietro" del browser non si riempie di un entry per ogni click in lista). Per retrocompatibilità con i link generati pre-2.0 (formato `loans.html?id=N`), il parser legge anche `URLSearchParams.id` e lo usa come selectedId iniziale. Il bottone "Torna alla lista" su mobile chiama `history.replaceState(null, '', location.pathname)` per ripulire l'hash.

L'animazione di transizione è volutamente minimal: nessun fade-out → fade-in fra una selezione e l'altra, perché il pattern master-detail si aspetta cambi rapidi e ogni animazione qui costerebbe perceived performance. Il dettaglio si sostituisce istantaneamente. La chat dentro al dettaglio viene rimontata fresca a ogni cambio (`UI.renderLoanChat(mount, selected, { startOpen: true })`), così l'utente vede subito i messaggi senza dover prima toggle-aprire il pannello chat.

#### 4.23.3 Il badge esperienza e la nav "Prestiti"

Le altre due rifiniture sono più piccole ma importanti per l'esperienza. Il **badge `loan-experience`** mostra accanto alle stelle delle recensioni un conteggio dei prestiti completati dall'utente (in entrambi i ruoli). La motivazione è semplice: in una community basata sulla fiducia, sapere che un utente ha portato a termine 12 prestiti con successo dà un livello di confidenza che le sole stelle non danno — uno potrebbe avere 5 recensioni a 5 stelle ma essere all'inizio, uno potrebbe avere 5 recensioni a 5 stelle dopo 50 prestiti completati: l'esperienza non è uguale. Il badge è in stile pillola sage soft (verde salvia chiaro su fondo bianco-sage), con icona `↺` (ciclo completato) e il conteggio in display font. Compare solo se count > 0 — chi è all'inizio non viene "marchiato" come inesperto, è semplicemente visto come "nuovo". Il calcolo è `API.getCompletedLoansCount(userId)`: conta i prestiti in stato `returned` dove `userId` è `requester_id` o `lender_id`.

La **nav "Prestiti"** è stata inserita in tutti i 17 file HTML con un singolo comando `perl -i -pe`. Posizione: subito dopo "Statistiche" e prima di "Profilo" — una scelta consapevole. *Statistiche* è dove l'utente va per i numeri dell'intera community; *Profilo* è la sua area personale generica; *Prestiti* sta nel mezzo perché è una vista personale specifica di un'entità (i prestiti) che non è tipicamente parte del "profilo" mentalmente. La classe `auth-only` (esistente da v1.x) la nasconde agli ospiti, perché non avrebbero prestiti da vedere. Quando l'utente è su `loans.html`, l'esistente helper `UI.highlightActiveNav()` colora la voce con la sottolineatura bordeaux. Tre dettagli che chiudono il ciclo del redesign della pagina prestiti.

### 4.24 Username univoco, empty-state centrato, enfasi visibilità libreria (v2.1)

Tre rifiniture pratiche di qualità: una validazione mancante che produceva potenziali duplicati silenziosi, un layout visivo che non centrava davvero quello che diceva di centrare, e un meccanismo di feedback più esplicito per gli utenti che non hanno ancora reso visibile la propria libreria. Insieme alzano la maturità della UX di un altro gradino senza introdurre feature nuove.

#### 4.24.1 La validazione di univocità che mancava

`API.createUser` riceveva i dati dal form di registrazione e li scriveva in `users[]` senza alcuna verifica di duplicazione. Era un bug serio: chiunque poteva registrarsi con username "chiara.morandi" e l'app non si sarebbe accorta. La fix è chirurgica: prima di costruire l'oggetto user, due check case-insensitive sull'array esistente. Se l'username (trimmato e lower-cased) coincide con uno già presente, ritorna `{ok: false, reason: 'username-taken'}`. Stesso per email. Il check insensitive è importante: "Mario.Rossi" e "mario.rossi" devono essere considerati lo stesso username, per evitare collisioni di phishing e per essere coerenti con il comportamento standard delle piattaforme moderne.

Il return type di `createUser` è cambiato da "oggetto user nudo" a `{ok: true, user}` (o `{ok: false, reason}`). Questa è una breaking change a livello API, ma il prototipo ha un solo chiamante (`register.html`), che è stato aggiornato in coerenza. Il pattern `{ok, ...}` è già usato dagli altri metodi che possono fallire (`requestLoan`, `rejectLoan`, `confirmLoan`, ecc.), quindi è una normalizzazione gradita.

Il **feedback live su `blur`** è la metà più "user-facing" della fix. Quando l'utente lascia il campo username o email, una funzione `attachLiveUniqueCheck(fieldId, errorMsg)` confronta il valore con tutti gli utenti esistenti. Se duplicato, applica la classe `is-invalid-unique` (bordo bordeaux + sfondo bordeaux 4%) al campo, e inserisce un piccolo messaggio mono sotto: *"Nome utente già in uso."* o *"Email già registrata."* Il messaggio si rimuove automaticamente al successivo blur con valore diverso. Usa `input.setCustomValidity()` così il browser nativo aggiunge il campo allo stato `:invalid` per gli screen reader.

Una **scoperta laterale durante questo lavoro**: il flag `library_role` era salvato nelle `profile_prefs` da `createUser` (v1.x), ma il wizard inline di v1.9 lo salvava sul `user` object. Le due viste si erano divergenti. La fix porta `library_role` su `user` per coerenza (e lo mantiene anche nelle prefs per retrocompatibilità con vecchio codice). Tutti i check `user.library_role === 'borrower'` ora hanno una fonte unica e affidabile.

#### 4.24.2 L'empty-state che non si centrava davvero

Il container `.empty-state--first-book` aveva `text-align: center` da v1.3. Eppure visivamente, il paragrafo descrittivo si vedeva chiaramente allineato a sinistra rispetto al titolo (anche se entrambi avevano formalmente lo stesso `text-align`). Il problema, scoperto via getComputedStyle + getBoundingClientRect: il `<p>` aveva `margin: 0 auto var(--sp-5)` ma `marginLeft` e `marginRight` computati erano `0` — il `margin: auto` non veniva risolto perché qualcosa nella cascade impediva la centratura del blocco. Investigando la specificity, le regole sembravano OK, ma il browser non collaborava.

La soluzione robusta è abbandonare `margin: auto` come meccanismo di centratura e usare invece **flexbox sul container**: `display: flex; flex-direction: column; align-items: center`. Con questa modifica, OGNI elemento figlio (h3, p, button, hint, illustration) viene centrato indipendentemente dal proprio `margin`. Funziona anche se i figli hanno `max-width` (vengono centrati nel container, larghi quanto serve). Bonus: niente più dipendenza da `width` esplicita per far funzionare il `margin: auto`. Le tre `max-width` (h3, p, hint) sono state uniformate a `48ch` per coerenza visuale fra le righe.

#### 4.24.3 Tre stati visivi di visibilità della libreria

La tab "La mia libreria" del profilo aveva due bottoni a destra del titolo: *⚙ Personalizza profilo* e *+ Aggiungi volume*. Tutti gli utenti li vedevano, sempre. Per un Lettore che non aveva ancora aperto la libreria, era confusionario: il bottone "+ Aggiungi volume" lo portava ad `add-book.html` che però lo respingeva con un toast (gate aggiunto in v1.9), e "Personalizza profilo" non aveva senso prima di aprire la libreria. La v2.1 chiude questo gap definendo tre stati visivi distinti:

**(a) Lettore puro** (`library_role === 'borrower'`): la libreria non è stata aperta, quindi non è visibile a nessuno. Pill `--locked` accanto al titolo (*🔒 NON ANCORA VISIBILE* in bordeaux), banner `--strong` sopra all'area libri che spiega esplicitamente *"La tua libreria non è ancora visibile agli altri. Sei iscritto come lettore: per apparire negli elenchi della comunità e ricevere richieste di prestito, apri ufficialmente la tua libreria e pubblica almeno un volume."*, e bottoni del header NASCOSTI (`#library-header-actions.hidden = true`). L'empty-state contiene già la CTA *"Apri ufficialmente la tua libreria"* dal v1.9.

**(b) Curatore senza libri** (`library_role === 'curator' && books.length === 0`): tecnicamente la libreria è aperta (bio, tema, motto configurati) ma non ha contenuti, quindi non è elencabile dalle ricerche pubbliche. Pill `--empty` (*◐ IN ATTESA DEL PRIMO VOLUME* in oro), banner `--soft` che ricorda *"La tua libreria è configurata ma non ancora elencabile dagli altri membri: pubblica almeno un volume per apparire nelle ricerche e nelle pagine pubbliche della comunità."*, bottoni del header VISIBILI (servono per aggiungere il primo libro o personalizzare ulteriormente).

**(c) Curatore con almeno un libro**: tutto pubblico. Nessuna pill, nessun banner, bottoni visibili. Lo stato "normale" della piattaforma.

La distinzione fra `--strong` (bordeaux) e `--soft` (oro) comunica il livello di gravità: per il Lettore mancano *due cose* (apertura + libri) e quindi il banner è "rosso urgente"; per il Curatore manca *una sola cosa* (un libro) ed è "ambra suggerimento". L'icona ⓘ in cerchietto pieno è coerente fra i due (è lo stesso "info" simbolo) ma il colore di sfondo distingue l'urgenza. La pill stessa usa monospace uppercase con letter-spacing per stare visualmente in linea con gli altri micro-badge della piattaforma (es. il rating badge `loan-experience`, le label di stato sui prestiti). Tre rifiniture, una grammatica visiva coerente.

### 4.25 Stats redesign, admin login, separazione reale/simulato (v2.2)

La v2.2 chiude due capitoli importanti del prototipo: rende la pagina statistiche **trasparente** su cosa è dato reale e cosa è seed, e **ripristina il pannello admin** dietro autenticazione vera. Insieme sono il primo passo verso un prototipo che sa dire onestamente "questa parte funziona, quest'altra è una demo" — qualità fondamentale per una presentazione accademica o un pitch a un cliente.

#### 4.25.1 Separare dati reali da dati simulati

Il problema della v2.1 era che le statistiche mescolavano dati calcolati dal localStorage (prestiti, recensioni, ecc.) con dati hardcoded nei seed (`book.views: 320`, `[320, 480, 620, ...]`). Un visitatore della pagina non aveva modo di distinguere. La v2.2 introduce **due tag visivi espliciti**: `.stats-tag--real` (verde sage) per "calcolato dai dati persistenti", `.stats-tag--mock` (oro) per "non da tracciamento reale", entrambi in monospace uppercase per coerenza con la grammatica delle altre etichette tecniche del sito. I tag sono **accanto al titolo della sezione** (non nascosti in tooltip o footnotes) così l'occhio li capta immediatamente. La sezione "Dati reali" ha 6 KPI (volumi, utenti, prestiti, recensioni, messaggi, notifiche), la sezione "Dati simulati" ne ha 2 (visualizzazioni totali e media per libro).

Il metodo `API.getRealStats()` aggrega tutto dai dati persistiti senza ricorrere a seed: `total_loans` da `loan_requests`, `completed_loans` filtrando per `status === 'returned'`, `total_messages` dai `loan_messages` con `type === 'user'` (escludendo i messaggi di sistema generati dalle transizioni), `total_notifications` dall'aggregazione di `notifications[userId]` per ogni utente, `avg_rating` come media aritmetica di `reviews[].rating`, e così via. `API.getSimulatedStats()` invece restituisce SOLO le `book.views` con il loro nome onesto. Le due funzioni sono usate dalla pagina come fonti di dati distinte; mai si mischiano in una stessa card.

#### 4.25.2 Timeline reale di attività, sunburst gerarchico, matrice di co-occorrenza

Il grafico "visualizzazioni nel tempo" della v2.1 era hardcoded: `[320, 480, 620, 780, 950, 1240]`. La v2.2 lo sostituisce con una **timeline reale di attività piattaforma** (`API.getActivityTimeline()`): per ognuna delle 12 settimane precedenti, conta gli eventi con timestamp reale che cadono in quel range. Quattro tipi di evento, ognuno con il proprio colore della palette (bordeaux per libri, oro per prestiti, sage per recensioni, ink scuro per messaggi), impilati in uno stacked bar chart. Il bucketing avviene calcolando il "lunedì della settimana" di ogni timestamp; gli eventi più vecchi di 12 settimane sono ignorati. Il chart è di Chart.js (già usato altrove nel sito) configurato con `responsive: true, maintainAspectRatio: false` per scalare al container.

Il grafico delle categorie aveva un altro problema strutturale: era un doughnut piatto, e dopo l'introduzione del **modello BISAC multi-tag** (ogni libro ha 2-3 etichette gerarchiche) non aveva senso. Un libro con tag *[Narrativa contemporanea, Storia, Filosofia]* contribuiva a tre fette diverse senza che la struttura gerarchica fosse visibile. La v2.2 risolve con **due rappresentazioni complementari**:

1. **Sunburst gerarchico** (`API.getBisacHierarchy()`): un doughnut di Chart.js a due dataset (anelli concentrici). L'anello esterno (datasetIndex=0) ha le 11 macro-categorie BISAC con colori distinti dalla palette; l'anello interno (datasetIndex=1) ha tutti i sotto-generi, ciascuno colorato come una sfumatura più chiara (alpha 70%) del macro a cui appartiene. Niente legenda visiva (sarebbe troppo affollata con 50+ etichette); l'identificazione avviene via tooltip al passaggio del mouse. Chart.js non ha un tipo sunburst nativo, ma due doughnut concentrici nidificati fanno il lavoro in modo compatibile con il resto della stack tecnologica.

2. **Matrice di co-occorrenza 11×11** (`API.getCategoryCooccurrence()`): per OGNI coppia di macro-categorie, conta quanti libri hanno **entrambe** le categorie nei propri tag. La diagonale è il count totale per categoria (incluse intersezioni con sé stessa, cioè libri che hanno solo tag di quella macro). Le celle fuori dalla diagonale rendono visibili le **intersezioni**: per esempio, "Narrativa × Storia: 4" significa che 4 libri hanno tag sia in Narrativa che in Storia (probabilmente *narrativa storica*). Il colore è proporzionale al valore: la diagonale è bordeaux con alpha crescente, le intersezioni sono oro con alpha crescente. Le celle a 0 sono neutre per non distrarre. Una legenda inline sotto la matrice spiega la scala cromatica.

Le due viste sono **complementari**: il sunburst mostra le proporzioni gerarchiche, la matrice mostra le co-occorrenze. Insieme rispondono a domande diverse: "quanta narrativa abbiamo?" → sunburst; "quanti libri sono insieme narrativa e storia?" → matrice.

#### 4.25.3 Top libri con sparkline, top utenti pluri-metrica

Le classifiche del v2.1 erano statiche: un bar chart orizzontale dei top 5 libri per `views`. La v2.2 le arricchisce in due direzioni:

**Top libri**: `API.getTopBooksWithTimeline(8)` calcola per ogni libro una **sparkline mensile su 12 mesi** delle interazioni reali (richieste di prestito + like timestampati). Il ranking è per `total_interactions`. Ogni voce della classifica è un `.top-book-item` con rank in display font, copertina miniaturizzata (50×70px), titolo + autore + anno, sparkline di 12 micro-barre verticali (proporzionate al massimo della sparkline), e count totale a destra. Su mobile (<700px) il layout si riorganizza con CSS Grid template-areas: la sparkline va sotto, prendendo la larghezza piena. Componente leggero, niente Chart.js: pure HTML/CSS con `<span>` per ogni barra e `style="height:..."` calcolato in JS.

**Top utenti**: `API.getTopUsers(8)` non restituisce un solo ranking, ma **cinque**: per punteggio composito (`prestiti_completati × 3 + recensioni_scritte × 2 + libri_pubblicati + follower`), prestiti completati, recensioni scritte, volumi pubblicati, e follower. La UI mostra 5 pill cliccabili in cima alla sezione che cambiano il ranking visualizzato. Ogni voce è un `.top-user-item` clickable (link a `library.html?id=...`), con avatar circolare con iniziali, nome + username + città, e la metrica del ranking corrente a destra. Il punteggio composito è quello di default perché aggrega le 4 dimensioni in una visione "utenti complessivamente più contributivi".

#### 4.25.4 Login admin e gate amministrativo

`admin.html` esisteva da v1.0 ma non aveva alcuna autenticazione: chiunque conoscesse l'URL la vedeva. La v2.2 la mette dietro un vero login. Tre componenti:

1. **Utente sample admin**: aggiunto a `SAMPLE_USERS` con `id: 11, username: 'admin', is_admin: true, library_role: 'admin'`. È l'unico user del sample con `is_admin: true`, ed è escluso dai conteggi delle statistiche (`getUsers().filter(u => !u.is_admin)` in `getRealStats` e `getTopUsers`) per non sporcare le metriche.

2. **`API.authenticate(usernameOrEmail, password)`**: la funzione fa lookup case-insensitive su `username` ed `email`. Se trova un user con `is_admin: true`, richiede password ESATTA `'admin'`; per gli altri sample user, accetta qualsiasi password ≥8 caratteri (siamo in demo, non c'è uno store di password hashate reali). Su successo: setta `current_user_id` e ritorna `{ok: true, user}`; su fallimento: `{ok: false, reason: 'wrong-password' | 'user-not-found' | ...}`.

3. **`API.requireAdmin(redirectIfMissing, redirectIfForbidden)`**: chiamato all'inizio dello script di `admin.html`. Se l'utente non è autenticato → redirect a `login.html`; se è autenticato ma `!is_admin` → redirect a `index.html`. Restituisce l'user admin per essere usato dal resto dello script.

Il form di `login.html` (che pre-v2.2 era decorativo: faceva sempre `location.href='profile.html'`) ora chiama `API.authenticate` davvero, mostra messaggi di errore specifici in un banner `#login-error` (`.form__error-banner`), e dopo successo redireziona a `admin.html` per gli admin, `profile.html` per gli altri. Il banner è in bordeaux soft, coerente con gli altri stati di errore della piattaforma.

`UI.initAdminLink()` viene chiamato globalmente da `DOMContentLoaded`. Se `getCurrentUser().is_admin === true`, inietta un `<a class="nav-admin">🛡 Admin</a>` nella nav header subito dopo *Profilo*. Stile: oro, distinto dagli altri link per segnalare l'area riservata. Nessuna manomissione del markup HTML statico — l'iniezione è pulita e dinamica.

#### 4.25.5 Sample users come curatori

Una conseguenza del refactor della v2.1 (`library_role` su user object): i 10 sample user pre-esistenti non avevano il campo. Quando la pagina stats v2.2 ha tentato di mostrare "10 curatori · 0 lettori", risultava "0 curatori" perché nessuno aveva esplicitamente `library_role: 'curator'`. Fix: aggiungere `library_role: 'curator'` a tutti i 10 sample user via `sed`. Coerente con il loro setup (ognuno ha una libreria pubblicata con libri), e ora i KPI sui curatori funzionano. L'admin user ha `library_role: 'admin'` per chiarezza semantica anche se non viene mai conteggiato nei KPI utente.

### 4.26 View tracking reale, eliminazione volume, admin CRUD (v2.3)

La v2.3 chiude tre fronti che la v2.2 aveva lasciato aperti: il dato simulato delle visualizzazioni, la mancanza di un modo per "togliere" un libro dalla piattaforma, e il pannello admin che era statico con grafici hardcoded. La logica unificante: ogni dato visualizzato sulla pagina stats deve essere **reale**, e ogni dato modificabile deve essere effettivamente modificabile.

#### 4.26.1 View tracking come eventi timestampati

Fino alla v2.2, `book.views` era un contatore intero seedato in `SAMPLE_BOOKS` con valori plausibili (320, 480, 620…) ma totalmente arbitrari. Veniva incrementato di 1 ad ogni `incrementViews()` chiamato in `book-detail.html`. Problema: non era una storia, era un numero. Non si poteva chiedere "quante visualizzazioni questo libro ha avuto a febbraio 2025?" perché l'informazione non esisteva.

La v2.3 introduce `book_views[]` come **tabella di eventi** (mappata 1:1 con quella che esisterebbe in produzione PostgreSQL). Ogni evento ha `{id, book_id, viewer_id, ts}`. `API.recordBookView(bookId)` viene chiamato da `book-detail.html` al primo accesso nella session corrente. La **deduplicazione per session** (via `sessionStorage.getItem('viewed_<bookId>')`) è importante: senza, ogni reload incrementerebbe il contatore, e gli sviluppatori che testano il sito gonfierebbero a dismisura i loro libri preferiti. Una visualizzazione = un'apertura della pagina in una session.

Per backward compat, `book.views` resta come campo del libro e viene incrementato in parallelo. Ma `getRealStats().total_views` ora viene da `book_views.length`, non dalla somma di `book.views`. Il vecchio comportamento smetterà di funzionare per nuovi libri (che partono con `views: 0` e li acquisiscono solo via tracking), mentre i seed mantengono i loro valori storici per non perdere "vita". L'effetto è che la sezione "Dati simulati" della v2.2 sparisce: tutto è reale ora. La pagina stats ha un'unica sezione "Dati della piattaforma" con 7 KPI, e una sola lede onesta sul tracciamento reale.

#### 4.26.2 Eliminazione hard di un volume

"Fino alla sua rimozione" — la richiesta dell'utente era ambigua fra soft-delete (libro nascosto ma cronologia preservata) e hard-delete (sparisce). Scelta: hard-delete, perché il prototipo non ha ancora una tabella "deleted_books" e gestire orfani sparsi nel codice sarebbe stato un debito tecnico per una funzionalità demo. La timeline "fino alla rimozione" diventa quindi: finché il libro esiste, la sua timeline va dalla pubblicazione a oggi; una volta rimosso, sparisce ovunque (classifiche, ricerche, profilo).

`API.deleteBook(bookId)` fa quattro cose:
1. Rimuove il libro da `books[]`
2. Rimuove tutti i prestiti collegati (`loan_requests` con `book_id === id`)
3. Rimuove tutti i view events del libro (`book_views`)
4. Rimuove il libro dai like di ogni utente (`likes_<userId>[]`)

In produzione queste sarebbero `ON DELETE CASCADE` su foreign keys. Qui sono passi imperativi. Il permission check è semplice: il chiamante deve essere il proprietario (`book.owner_id === me.id`) o un admin. Niente intermedio: nessun co-curator o moderator-but-not-admin per ora.

Lato UI: pulsante *"🗑 Elimina volume"* su `book-detail.html`, posizionato accanto al like (stesso row), visibile solo per il proprietario o admin via JavaScript (`btn.hidden = !(isOwner || isAdmin)`). Il click apre una `confirm()` nativa che enumera cosa verrà cancellato — il prompt non è elegante ma è chiarissimo. Dopo il delete, redirect intelligente: l'admin che elimina dal pannello torna ad `admin.html`, il proprietario torna a `profile.html`.

#### 4.26.3 Top-book espandibili con timeline cumulative

La top books della v2.2 aveva una sparkline mensile su 12 mesi accanto a ogni voce. Utile per il colpo d'occhio, ma poco per analisi reale. La v2.3 aggiunge un **dettaglio espandibile**: cliccando il toggle ▼ a destra di ogni voce, si apre un pannello sotto con due cose:

1. **6 mini-KPI** in griglia responsive (auto-fit minmax 120px): visualizzazioni totali (da `book_views`), richieste prestito totali, prestiti conclusi, prestiti attivi, like ricevuti, giorni in piattaforma (calcolato come `floor((now - book.added) / 86400000)`). Ogni KPI è in un riquadro con border, numero in display font + label in monospace uppercase — coerente con la grammatica visiva della pagina.

2. **Line chart cumulativo** Chart.js con 3 serie sovrapposte (area filled + tension 0.3): visualizzazioni, richieste prestito, like — ognuna con il colore della palette assegnato in modo coerente (`#7a1e2b` per views, `#b08840` per loans, `#6e7a5a` per likes). L'asse X copre ogni mese dalla data di pubblicazione del libro a oggi (può essere 3 mesi come 36 mesi, dipende dal libro), l'asse Y conta cumulativo. La cumulazione visualizza "crescita continua" e rende chiari i momenti di accelerazione.

Implementazione: `API.getBookTimeline(bookId)` itera attraverso i mesi dalla `added` a `now`, accumulando i 3 contatori. Restituisce `{book, events, monthLabels, monthBuckets: {views[], loans[], likes[]}, summary}`. La pagina stats consuma `monthLabels` per `chart.data.labels` e `monthBuckets.X` per `chart.data.datasets[X].data`. Il caricamento è **lazy**: il chart si costruisce solo al primo click sul toggle (`detail.dataset.loaded = '1'` marca il done); click successivi sono solo show/hide.

#### 4.26.4 Pannello admin con CRUD reale

Il vecchio `admin.html` (v1.0-v2.2) aveva una tabella di gestione utenti vuota, una tabella libri vuota, e due grafici hardcoded ("Crescita utenti (ultimi 6 mesi)", "Richieste prestito per stato") che mostravano sempre gli stessi numeri inventati. Era un mockup di mockup. La v2.3 lo riscrive da zero come **CRUD tool funzionante**.

Layout: KPI strip in cima (6 numeri reali dalla stessa `getRealStats`), poi tre tab — *Utenti*, *Volumi*, *Sistema*. Ogni tab è un `.admin-pane` che mostra/nasconde con `hidden`. Niente animazione di transizione: il pannello deve essere reattivo per l'admin, non scenografico.

**Tab Utenti**: `<table class="admin-table">` con colonne ID, Nome, Username, Email, Città, Ruolo, Libri, Azioni. La riga dell'admin corrente è evidenziata con `bg: rgba(176,136,64,0.04)` (oro soft) e ha un pill "ADMIN" inline. Il bottone elimina è omesso solo sull'admin che sta vedendo la pagina (per evitare auto-suicidio); altri admin restano cancellabili. La ricerca live filtra su display_name, username, email, city con `String.toLowerCase().includes()` — semplice ma sufficiente per il prototipo.

**Tab Volumi**: stessa struttura, con colonne ID, Titolo, Autore, Anno, Proprietario, Categoria, Stato, Azioni. Lo stato (`available`) è renderizzato come pill `--ok` verde o `--off` grigio.

**Modal di edit utente**: 7 campi (display_name, username, email, city, account_type, library_role, bio) con validazione client (`required`, `pattern="^[a-z0-9._]+$"` per username). Il bottone "Salva" chiama `API.updateUser(id, data)` se modifica esistente o `API.createUser(data)` se nuovo. Gli errori (`username-taken`, `email-taken`) sono mappati a toast specifici.

**Modal di edit libro**: 9 campi (title, author, year, language, isbn, owner_id come dropdown popolato da `API.getUsers()`, category, available come checkbox, description). Chiama `API.updateBook(id, data)` o `API.adminAddBook(data)`.

**Modal di conferma riusabile**: una sola istanza nel DOM, mostrata via `askConfirm(title, body, onOk)` con title/body dinamici. Il callback `onOk` viene memorizzato in una variabile module-scoped `pendingConfirm` e invocato al click su "Conferma". Pattern semplice, funziona.

**Tab Sistema**: tre azioni di gestione dati: esporta backup JSON di tutto il localStorage (ogni chiave, parseando i valori JSON quando possibile), reset al seed (forza `data_version = '0'` così al reload viene rifatto il `_reseedSampleDataIfStale`), svuota completo del localStorage. Ognuna apre il modal di conferma.

**Stile coerente**: tutti i bottoni usano le classi esistenti (`btn`, `btn--primary`, `btn--ghost`, `btn--danger`), le tabelle hanno il border-bottom della line color, le icone delle azioni sono in `.admin-icon-btn` (cerchietti 30×30 con hover bordeaux). Le pill di stato sfruttano il pattern già esistente (`.loans-filter__count`, `.visibility-pill`). Nessun nuovo paradigma visivo — l'admin si integra nel sistema di design del sito.

#### 4.26.5 Note sull'integrità referenziale

Cancellando un utente, vengono cancellati anche i libri, prestiti, recensioni, view events collegati. Il rischio è "orfani" se qualche tabella collegata viene dimenticata. Per il prototipo abbiamo gestito le tabelle principali (`books`, `loan_requests`, `reviews`, `book_views`, `profile_prefs_<id>`, `org_profile_<id>`, `follows_<id>`, `likes_<id>`); i `loan_messages` con `sender_id === userId` NON vengono cancellati esplicitamente (un messaggio orfano resta nel DB ma non è più rilevante perché il prestito a cui appartiene è stato cancellato a sua volta in cascade). In produzione PostgreSQL il problema sarebbe risolto con `FOREIGN KEY ... ON DELETE CASCADE` o con un soft-delete che invalida tutto in modo elegante. Per il prototipo, va bene così — l'admin che cancella un utente sa cosa sta facendo.

### 4.27 Post sociali, security fix, library cleanup (v2.4)

La v2.4 risponde a quattro temi: una domanda teorica (che differenze ci sono fra i tipi di utente), un bug di sicurezza sul delete-book, un'igiene visiva su `library.html`, e una feature nuova consistente — i Post sociali. Si è scelto di trattare ogni punto separatamente perché le decisioni di design sono ortogonali.

#### 4.27.1 Risposta tecnica: Persone vs Organizzazioni, Curatore vs Lettore

**Persone vs Organizzazioni**: l'`account_type` discrimina solo a livello *presentazionale*. Esiste una tabella `org_profile_<userId>` 1:1 con campi specifici (legal_name, org_category, public_address, opening_hours, website, legal_form). `library.html` mostra un pannello aggiuntivo `renderOrgPanel(org_profile)` con orari di apertura, indirizzo, categoria istituzionale, e l'hero ha una label diversa ("libreria personale" vs "biblioteca/associazione/libreria indipendente/centro culturale"). Il form di registrazione step 2 ha campi diversi per le organizzazioni. **Tutto il resto è identico**: stessi permessi, stesso workflow di pubblicazione/prestito/recensione, nessuna policy speciale, nessun limite. Verdetto: tenere la separazione per ricchezza editoriale (un'app real-world avrebbe una mixed userbase di privati + biblioteche di quartiere), ma essere consapevoli che eliminarla costerebbe poco — basterebbe un campo `is_institutional: boolean` o l'eliminazione totale del pannello e dei suoi campi. L'overhead è 1 tabella e ~50 righe di rendering UI.

**Curatore vs Lettore**: differenza reale e meccanica. Il `library_role: 'borrower'` è il tag dell'utente registrato via fast-track (`?intent=borrow&book=N`) che ha saltato il wizard di apertura libreria della v0.6. Conseguenze concrete: (a) gate hard su `add-book.html` con redirect cortese al wizard inline di apertura libreria; (b) banner forte sul profilo *"La tua libreria non è ancora aperta"*; (c) pill rossa `--strong` su `library.html` con CTA *"Apri la tua libreria"*; (d) i bottoni *"+ Aggiungi volume"* e *"⚙ Personalizza profilo"* sono nascosti. La transizione `borrower → curator` avviene una volta sola via wizard inline (`startOpenLibraryWizard`) che imposta il `library_role` definitivamente. Verdetto: pattern collaudato e utile, da tenere. Riduce l'attrito di registrazione per gli utenti che vogliono solo prendere in prestito (un cittadino che vuole leggere un libro specifico non vuole compilare 5 step subito), e introduce un momento di engagement consapevole quando l'utente decide di iniziare a condividere. Vinted, Airbnb e moltissime piattaforme adottano questo schema. Nella v2.4 abbiamo riusato la stessa distinzione per gating dei post: solo chi ha almeno un libro pubblicato può scrivere post, perché è la stessa logica — chi non ha condiviso nulla, non parla ancora.

#### 4.27.2 Security fix sul delete-book

Il bug della v2.3: la condizione di visibilità del bottone *"🗑 Elimina volume"* in `book-detail.html` era `if (!isOwner && !isAdmin) return;`. Quindi l'admin poteva eliminare qualsiasi libro direttamente dal book-detail. In sé l'admin ha già il diritto via `API.deleteBook()` (che lo accetta in permission check), ma esponendo l'azione dalla **pagina pubblica** del libro mescola due canali: il canale "utente normale che gestisce le proprie cose" e il canale "admin che modera". Questo è problematico per due motivi:

1. **Audit**: se domani aggiungessimo un log degli eventi di moderazione, ci aspetteremmo che ogni delete amministrativo passi dal pannello admin e produca un log specifico (chi ha cancellato cosa quando, per quale motivo). Permettere il delete amministrativo da una pagina pubblica bypassa questo audit trail.

2. **Confusione cognitiva**: un admin che è anche utente normale (visita libri per piacere, non per moderare) può cliccare "Elimina" pensando che stia facendo qualcosa di personale, e finire per cancellare il libro di qualcun altro. Separare i canali rende l'azione amministrativa **deliberata** — devi andare nel pannello admin per farla, e quel contesto rende consapevoli.

Fix: condizione diventa `if (!isOwner) return;` (rimosso `|| isAdmin`). L'admin elimina dal pannello admin (`admin.html`, tab Volumi, bottone 🗑 con modal di conferma). La logica server-side di `API.deleteBook` resta inalterata (accetta sia owner che admin) perché è il giusto livello di permessivitá — ma l'**accesso UI** all'azione è separato per canale di responsabilità.

#### 4.27.3 Cleanup di `library.html`

Tre rimozioni intenzionali:

1. **Banner sola-lettura per visitatori**: era *"Stai visitando la libreria di un altro membro della comunità: la vista è in sola lettura. Solo X può modificarla."* — informazione ridondante. Un utente che non è proprietario non vede pulsanti di modifica, non c'è form di edit, niente; il fatto che sia "sola lettura" è ovvio dal contesto. Il banner introduceva noise dove non serviva. Il banner per il proprietario (*"Questa è la tua libreria. Puoi modificarne i contenuti dalla pagina Profilo"*) resta, perché lì sì c'è informazione utile (dove vai per modificare).

2. **Switch layout (Griglia/Elenco/Scaffale/Cronologia)**: erano 4 pulsanti che permettevano ai *visitatori* di cambiare la modalità di visualizzazione. Ma questa è una preferenza che ha senso solo per il **proprietario** della libreria — `profile-setup` permette al curatore di scegliere come la sua libreria deve apparire al pubblico (griglia minimal, scaffale con copertine, ecc.). Permettere ai visitatori di override-are quella scelta sminuiva il senso della personalizzazione del curatore. Ora la libreria appare sempre come l'ha pensata il proprietario — coerente con il principio che la libreria è una *vetrina personale*, non uno strumento di esplorazione generica. Per esplorare in modi diversi c'è `explore.html`.

3. **Riquadro "consultazioni totali"**: numero che mostrava `stats.total_views` come quarto KPI dell'hero della libreria, accanto a "volumi totali" e "disponibili al prestito". Era rumore: il visitatore di una libreria non ha bisogno di sapere quante volte la pagina è stata vista in totale, è metrica da pannello stats, non da vetrina utente. Inoltre il "consultazioni" era ambiguo (consultazioni della pagina della libreria? somma dei view dei libri?) e in ogni caso un numero senza contesto interpretativo non aggiunge valore. Rimosso. I due KPI rimanenti (volumi totali, disponibili) sono quelli che il visitatore vuole davvero sapere prima di esplorare il catalogo.

L'effetto complessivo: `library.html` è ora più focalizzata. L'hero dice chi è il curatore, dove sta, che tipo di libreria ha; sotto si vede la libreria come l'ha pensata, e basta.

#### 4.27.4 Architettura del sistema Post

I post sono un *social layer* sopra al modello esistente. Decisioni chiave:

**Store**: tabella `posts[]` con record `{id, author_id, content, created_at, reactions: {emoji: [userId, ...]}, reports: [...]}`. La struttura `reactions` come mappa `emoji → array di userId` è quella più compatta che permette le tre operazioni che ci servono in O(1) o quasi: contare le reazioni per emoji (length dell'array), sapere se un utente ha reagito (includes), invertire (push/splice). In produzione PostgreSQL questa sarebbe una tabella `post_reactions(post_id, user_id, emoji)` con UNIQUE su `(post_id, user_id)`, ma per il prototipo la mappa annidata è più semplice da gestire in JS.

**Vincolo di pubblicazione (`canPublishPosts`)**: requisito = almeno un libro pubblicato. La motivazione: se solo i curatori possono parlare, i post manterranno un livello di pertinenza tematico (libri/biblioteche) anche senza moderazione esplicita. È lo stesso filtro sociale che si applica naturalmente a Reddit per i subreddit chiusi o a una mailing list di settore — chi ha "skin in the game" partecipa, chi non ce l'ha ancora ascolta. I Lettori non sono esclusi per sempre: dal momento in cui pubblicano un libro (anche solo 1), il composer si sblocca automaticamente. Coerente con il modello di v1.9 dell'apertura libreria.

**Reazioni one-per-user-per-post**: scelta di design per dare un peso uguale a ogni utente. Lasciare il like a "no limit" su Facebook ha senso perché le reazioni sono solo segnale di gradimento, ma 4 emoji distinte (apprezzamento, amore, applauso, perplessità) hanno significati diversi — un utente deve scegliere quale rappresenta meglio la sua reazione. Cliccare la stessa emoji rimuove la reazione (toggle), cliccare un'altra sostituisce — comportamento "atomico" coerente con l'esperienza Facebook/LinkedIn.

**Segnalazioni con motivo enum + nota**: enum 5 motivi (`offensivo`, `spam`, `off-topic`, `violenza`, `altro`) per facilitare la triage admin senza obbligare a leggere note libere. La nota libera ≤300 char è opzionale, utile per casi che non rientrano nelle categorie standard. Una segnalazione per utente per post (UNIQUE virtuale): non si può inondare il sistema rincalzando lo stesso report. Le segnalazioni sono cumulative — se 5 utenti diversi segnalano lo stesso post per 3 motivi diversi, l'admin vede tutte e 5 le segnalazioni con i loro motivi specifici, e può decidere se il post è davvero problematico o se è solo controverso. Il post stesso *non* viene nascosto automaticamente — l'admin deve decidere. Coerente con i principi di moderazione delle piattaforme decentralizzate (Mastodon, Bluesky): trasparenza più che automazione.

**Coda admin (`getReportedPosts`)**: la tab "Segnalazioni" nel pannello admin mostra solo i post con `reports.length > 0`. Badge contatore live in cima al tab. Per ogni post: autore, contenuto inline (escape XSS, niente HTML), aggregazione motivi (es. *"2× off-topic · 1× spam"*), elenco dettagliato delle segnalazioni con reporter + nota + timestamp. Due azioni: `clearPostReports` (archivia, post resta — utile quando le segnalazioni non sono fondate, evita di mostrare lo stesso post nella coda all'infinito) o `deletePost` (rimuove definitivamente).

**Tre punti di ingresso UI**:
1. **Tab "Post" sul profilo (`profile.html`)**: composer + cronologia personale. Tab posizionata fra "La mia libreria" e "Richieste ricevute" per coerenza di flow (prima vedo cosa ho condiviso come oggetti, poi cosa dico in voce). Si attiva solo al click sulla tab (lazy: `if (btn.dataset.tab === 'posts') renderPostsTab(user.id)`).
2. **Sezione "Aggiornamenti dalla libreria" su `library.html`**: vista pubblica dei post del curatore visitato. Anchor `#posts` per il deep link dalle notifiche. Niente composer (è pagina pubblica, l'autore scrive dal proprio profilo).
3. **Sezione "Aggiornamenti recenti" su `index.html`** (auth-only): in cima alla home per utenti loggati, mostra i post degli utenti seguiti via `getPostsFromFollowed(me.id, 10)`. Include anche post propri (un utente vuole vedere la propria attività nel flusso). Empty state che invita ad esplorare la mappa per iniziare a seguire profili — chiusura ottimista del loop social.

**Helper UI condivisi** (`UI.renderPostsFeed`, `UI.renderPostComposer`): un solo punto di rendering per tutte e tre le sezioni, opzioni `{showAuthor, emptyMessage, onChange}` per personalizzare. Niente DRY-violation: il pattern di rendering è lo stesso per tutte le viste e isolare le differenze in opzioni mantiene il codice leggibile. Il wiring delle reazioni/segnalazioni/elimina avviene una sola volta (in `UI._wirePostsFeed`).

**Notifiche `new_post`**: alla creazione, itera su tutti gli utenti, controlla `follows_<userId>` di ciascuno, se include l'autore aggiunge una notifica con `{type: 'new_post', actor_id, post_id, message, created_at}`. In produzione questo sarebbe una query batch `INSERT INTO notifications SELECT user_id, ... FROM follows WHERE followed_id = :author_id`. Routing: la notifica porta a `library.html?id=:author_id#posts`, così l'utente vede il post nel contesto del profilo dell'autore. Inclusa nel filtro "social" della campanella (insieme a `new_book`, `book_available`, `new_follower`) per coerenza tematica.

**Anti-XSS**: `UI._escapePostContent` fa `textContent` → `innerHTML` + sostituzione `\n` → `<br>`. Niente Markdown, niente link auto-rilevati, niente HTML nei post. Trade-off consapevole: si rinuncia all'espressività per evitare ogni rischio di injection. Aggiungere Markdown sicuro è una migrazione fattibile in futuro con una library come marked + DOMPurify.

**Esempi seed (`SAMPLE_POSTS`)**: 5 post che dimostrano i casi d'uso reali. 4 sono normali (annuncio di nuove acquisizioni, organizzazione gruppo di lettura, scoperta di un volume raro, richiesta di scambio); 1 è controverso ("Comprate solo libri usati! Smettetela di sostenere l'editoria che inquina") con una segnalazione di Marco De Vito (motivo: off-topic, nota: *"Sembra più un proclama politico che un post sulla libreria"*). Questo quinto post serve a popolare la tab Segnalazioni dell'admin dal primo load e a mostrare un caso ambiguo: il post non è offensivo né spam, ma qualcuno l'ha trovato off-topic. L'admin deve decidere — situazione realistica.

### 4.28 Nav a icone SVG, foto profilo personalizzata (v2.5)

La v2.5 chiude due richieste UX dell'utente: portare la navigazione a uno standard contemporaneo (icone invece di testo) e dare agli utenti il controllo sulla propria immagine personale (foto profilo). Sono due interventi visivi importanti che insieme alzano l'asticella di "prototipo finito" verso "applicazione che potresti davvero usare".

#### 4.28.1 Iconografia: scelte di disegno e ragionamento

Le 5 icone (Esplora, Statistiche, Prestiti, Admin, Pubblica) sono state **generate da Claude (Anthropic)** come SVG inline — non importate da una libreria esterna (Feather, Heroicons, Lucide). La scelta è deliberata: con una libreria di terze parti il prototipo importa un pacchetto da 50+ KB di icone non usate, e ogni icona porta con sé il suo stile (Feather è "linee sottili e arrotondate", Heroicons è "linee più decise", Lucide è una variante di Feather). Mantenere la mano grafica coerente in un'app che ha già la sua identità (Cormorant + Fraunces + palette bordeaux/oro) richiede o l'override massiccio dello stile della libreria, o disegnare 5 icone su misura. La seconda è più pulita.

Le regole comuni delle 5 icone:
- **viewBox 24×24**: standard industriale (Material, Heroicons, Feather, Lucide condividono questo viewport)
- **stroke 1.8 px**: a metà strada fra Feather (1.5 — molto sottile, elegante) e Heroicons outline (2.0 — più tondo, friendly). 1.8 è "letterario": ricorda lo spessore di una penna nera media usata per illustrazioni a mano
- **stroke-linecap: round, stroke-linejoin: round**: morbidezza coerente con il character del sito (font serif, palette calda)
- **currentColor**: ogni icona eredita il colore dal CSS contestuale, così la stessa SVG funziona in bordeaux (nav burgundy), oro (Admin) o paper (su sfondo Pubblica). Massima flessibilità senza moltiplicare le copie
- **fill: none**: tutte le icone sono outline, non solid. Coerente con la sensazione "tratto a mano" del sito
- **una sola idea visiva per icona**: niente decorazioni gratuite

Le 5 icone, una a una, con la logica di disegno:

- **Esplora** (`map + magnifier`): una mappa stilizzata a 3 pannelli ripiegati (path zigzagante) con la lente di ingrandimento in basso a destra (cerchio + linea diagonale). Comunica immediatamente "esplora un territorio". Alternative scartate: solo lente (poteva essere search dei libri), solo mappa (poteva essere il pin geografico). La combinazione è univoca.

- **Statistiche** (`bar chart`): 4 barre verticali di altezze diverse su una baseline. Pattern universalmente riconosciuto. Altezze 10/16/7/13 (in unità del viewBox) per ricordare un piccolo trend con un picco al centro — non barre identiche che sembrerebbero un'illustrazione astratta.

- **Prestiti** (`speech bubble`): un fumetto rettangolare con coda e due righe di testo dentro. La "code" suggerisce conversazione, perché i prestiti **sono** conversazione (chat tra prestatore e prestatario). Alternative scartate: simbolo ↺ (ambiguo, usato anche per "refresh"), libro con freccia (troppo letterale).

- **Admin** (`shield + check`): scudo con segno di spunta interno. Lo scudo evoca protezione/autorità senza essere intimidatorio (no chiave, no lucchetto — quelli ostili). Il check inscritto dice "verifica, controllo". Coerente con un ruolo di moderazione (non di "sicurezza chiusa"). Colore oro per distinguerlo visivamente dagli altri link, segnalando area riservata senza usare il rosso (che è "errore" e "delete" altrove nel sito).

- **Pubblica** (`document + plus`): un foglio piegato (corner-fold visibile) con un piccolo + inscritto al centro. È l'icona "primaria" della nav (sfondo bordeaux pieno), quindi visivamente domina. Comunica "aggiungi un nuovo documento" — coerente con "aggiungi un volume". Alternative scartate: solo +, libro singolo (troppo generico, usato altrove). Il piegamento del documento richiama anche il libro fisico — coerenza tematica con la piattaforma.

**Home eliminato dalla nav**: il logo *"Lookup"* a sinistra è già un `<a href="index.html">`. Mantenere "Home" come voce separata era ridondante. Pattern adottato da Twitter (bird), GitHub (logo octocat), Slack (workspace logo): il logo è la home.

**Profilo eliminato dalla nav**: l'avatar circolare dell'utente loggato (in alto a destra) è già un trigger per la dropdown del profilo (di v1.3) che ha la voce *"Vai al profilo"* e altre. Mantenere "Profilo" come link separato duplicava la stessa funzione in due punti diversi della stessa nav. Pattern adottato da Gmail, Slack, GitHub: l'avatar è il punto di ingresso al profilo, e duplicarlo confonde più che aiutare.

**Label responsive**: su desktop ≥1100px mostro icona + label testuale ("Esplora", "Statistiche"…) perché c'è spazio e la label aiuta il riconoscimento al primo uso (un utente nuovo capisce subito cosa fa ogni icona). Sotto i 1100px solo l'icona, la label resta accessibile via `aria-label` e `title`. Tecnica: `.nav-icon__label { position: absolute; width: 1px; height: 1px; clip: rect(0,0,0,0); }` — la "visually hidden" classica, accessibilità preservata.

**Pubblica come pulsante primario**: l'unica icona della nav con sfondo pieno (bordeaux) e testo paper. Visivamente è quella che "spicca". Questo è coerente con il principio UX di avere **una sola call-to-action primaria** in vista per pagina/sezione: nella nav, l'azione che vogliamo invitare di più è "Pubblica un volume" (il prodotto cresce con i contenuti generati dagli utenti).

#### 4.28.2 Foto profilo: architettura

Il pattern dell'avatar editabile è familiare (Gmail, Slack, Twitter, GitHub tutti lo implementano), ma le scelte tecniche sotto possono variare moltissimo. Le decisioni prese qui:

**Storage**: data URL JPEG base64 in `user.avatar_data_url`, stesso store di `users` che esiste già. Non file separato. Non upload a un blob storage (non c'è). Non riferimento a una path locale. Una stringa che vive con il record utente. Trade-off: il record utente diventa più grosso (un JPEG quadrato 320×320 a qualità 0.85 pesa ~12-20 KB → la stringa base64 è ~16-27 KB). Per 100 utenti con foto siamo a 1.6-2.7 MB di localStorage. localStorage permette 5-10 MB per dominio. Margine sufficiente per un prototipo che simula una piattaforma con 10-100 utenti.

In produzione PostgreSQL questo sarebbe un campo `avatar_url TEXT` che punta a un blob storage (S3, R2, Cloudinary), e il client carica direttamente al blob storage tramite presigned URL — il backend non vede mai i bytes dell'immagine. Per il prototipo, la pipeline base64 → localStorage è più pratica perché elimina ogni dipendenza esterna.

**Crop quadrato a 320×320**: l'utente carica una foto qualunque (verticale, orizzontale, quadrata, gigante o piccola). Prima di salvare la passo per `cropImageToSquare(dataUrl, 320, 0.85)` che:
1. Crea un canvas 320×320
2. Calcola il crop quadrato centrato sull'originale: `src = min(width, height)`, `sx = (width - src) / 2`, `sy = (height - src) / 2`
3. Disegna il crop sul canvas
4. Esporta come JPEG con quality 0.85

320 px è abbastanza per il rendering @2x retina di un avatar 144 px (max size nel sito, sul profilo). Più piccolo = byte risparmiati ma rendering brutto su display ad alta densità. Più grande = byte sprecati senza guadagno visibile. 320 è il sweet spot.

JPEG quality 0.85: alto abbastanza da non vedere artefatti su volti, basso abbastanza da pesare 12-20 KB invece dei 40+ del PNG/JPEG full quality. Le foto profilo non sono opere d'arte da preservare bit per bit.

**Riadattamento a cerchio via CSS**, non via canvas: salvo l'immagine quadrata, poi il rendering la fa diventare cerchio con `border-radius: 50%` + `object-fit: cover`. **Perché**: se l'utente cambia idea sul layout della UI (cerchio vs rounded square vs hexagon), o se domani aggiungo un hover effect che zooma, l'immagine sottostante resta quadrata e flessibile. Salvare già una versione "tagliata a cerchio" via canvas + alpha mask sarebbe stato un over-commit: l'immagine sarebbe stata indissolubilmente legata a una specifica forma. Il principio: **salva il dato canonico, applica la presentazione al rendering**.

**Menu a tendina al click**: l'avatar è cliccabile con `role="button"` + `tabindex="0"` + `aria-haspopup="menu"` per accessibilità da tastiera. Al click si apre un `<div class="avatar-menu">` con `position: fixed` ancorato alla bounding box dell'avatar. Due voci dinamiche:
- *"📷 Carica foto…"* — sempre presente, label cambia in "Cambia foto…" se foto già presente
- *"✕ Rimuovi foto"* — visibile **solo** se `user.avatar_data_url` è truthy

La voce "Rimuovi" ha conferma nativa `confirm()` per evitare delete accidentali (l'utente potrebbe perdere una foto che gli piaceva e che non ha più in altri device).

**Click outside chiude il menu**: `document.addEventListener('click', () => closeMenu())`. Combinazione robusta con il `e.stopPropagation()` sul click dell'avatar stesso (altrimenti il click sull'avatar prima aprirebbe il menu e poi chiuderebbe immediatamente, bouncing).

**File input nascosto**: invece di mostrare un `<input type="file">` esplicito (che ha styling difficile da personalizzare in modo cross-browser), creo un input volatile via JS quando l'utente sceglie "Carica foto…": `const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.click();`. Pattern standard per UX di upload custom. L'input non viene mai nel DOM persistente.

**Validazione client**: `if (file.size > 5 * 1024 * 1024) reject` — limite 5 MB per evitare che un utente carichi un'immagine da 30 MB che farebbe esplodere il localStorage. La validazione server in produzione resterebbe comunque obbligatoria (mai fidarsi del client), ma per il prototipo questo è sufficiente.

**Propagazione del cambiamento**: dopo `setUserAvatar` il callback `onChange` invoca `location.reload()`. Soluzione semplice (ricarica la pagina) ma efficace: la nuova foto appare in tutte le posizioni (nav avatar, profilo, post composer, eventuali post card già renderizzati). Alternativa più elegante sarebbe un sistema di pub/sub interno (un'event bus) che notifica tutti i componenti che mostrano l'avatar di re-renderizzare. Trade-off: il reload è 1 riga di codice, l'event bus sarebbero 50+ righe per gestire `subscribe/unsubscribe` su mount/unmount, gestione di subscribe duplicati, ecc. Per un prototipo, la prima è sproporzionatamente più efficiente in termini di codice/value.

**Visibilità della foto in tutti i posti dell'app**: il pattern `user.avatar_data_url ? <img> : initials` viene replicato in 4 punti:
1. `UI.initProfileAvatar()` (nav header) — paint condizionale
2. `profile.html` (header del profilo) — markup condizionale al render
3. `UI.renderPostComposer()` (composer post) — markup condizionale al render
4. `UI._renderPostCard()` (avatar autore) — markup condizionale al render

Il pattern è 3 righe di codice per ognuno, niente helper centralizzato. Sarebbe stato possibile fare `UI.renderUserAvatar(user, size)` che restituisce HTML coerente — ma le size, posizioni, e CSS class sono leggermente diverse in ogni contesto (44px round in nav, 88px nel profilo, 32px nel composer, 40px nel post card), quindi un helper avrebbe avuto troppi parametri. Quattro implementazioni mirate sono più chiare di una funzione generica con 8 parametri.

**Non implementato (volutamente)**: editor di crop interattivo (utente trascina/zooma per scegliere il crop esatto), filtri (color, brightness, contrast), foto da webcam, integrazione con Gravatar. Tutto fattibile, ma fuori scope. Il prototipo dimostra il **pattern**, non l'editing avanzato.

### 4.29 Welcome neutri, libri-novità con aura, ridgeline editoriale, "Selezione" reale (v2.6)

La v2.6 risponde a un mix di richieste UX, accessibilità linguistica e algoritmica. Quattro temi distinti che si intrecciano nella home autenticata e nella pagina stats. Le scelte di design sono accomunate da un principio: ogni miglioramento deve sembrare "fatto a mano" dentro la grammatica visiva del sito, non importato da fuori.

#### 4.29.1 Messaggi di benvenuto gender-neutral

La v2.5 mostrava *"Bentornata Francesco"* — frase grammaticalmente sbagliata in italiano (concordanza di genere fallita) e culturalmente problematica (presuppone un genere per il visitatore). Soluzioni canoniche: (a) abbandonare la formula "Bentornat*"; (b) usare costruzioni che si adattano a qualsiasi genere; (c) variare lessicalmente per evitare la sensazione di formula meccanica.

17 messaggi in `API.WELCOME_MESSAGES`, tutti gender-neutral: usano forme infinite, sostantivi non genderati, frasi nominali, o l'asterisco inclusivo `Bentornat*` (presente in *uno* solo per non abusarne). Esempi:

- *"Ciao Chiara, buona lettura."* — semplice, calda
- *"È bello rivederti, Marco."* — affettiva, neutra (rivederti è infinito)
- *"La pagina ti aspettava, Anna."* — letteraria, in tema sito
- *"Tra gli scaffali c'è movimento, Luca."* — evocativa
- *"Quale libro ti chiamerà oggi, Maria?"* — interrogativa, invita

Niente formule legate all'orario (*"Buongiorno"*, *"Buonasera"*) — un utente che apre l'app alle 3 di notte non vuole sentirsi dire *"Buongiorno"* (e calcolare il fuso orario lato client introdurrebbe complessità inutile).

**Rotazione**: per evitare che lo stesso utente veda sempre la stessa frase, ogni record utente ha un campo `welcome_index` (integer) che viene incrementato in `authenticate()` ad ogni login riuscito, modulo `WELCOME_MESSAGES.length`. `getWelcomeMessage(user)` legge l'indice corrente e ritorna `MESSAGES[idx].replace('{name}', firstName)`. **Deterministico per session** (non casuale ad ogni reload): un utente che si logga vede *"Ciao Chiara"*, ricarica 10 volte, vede sempre *"Ciao Chiara"* finché non si rilogga. Questo evita la sensazione disorientante di "ogni volta diverso" e mantiene un'identità per la sessione.

#### 4.29.2 Algoritmo "Selezione della settimana"

La v2.5 (e prima) usava `getGlobalStats().top_books`: ordinamento per `book.views` decrescente, filtro `available: true`, slice 4. Problemi enumerati in apertura:
- I nuovi libri partono da 0 view, mai chance contro i seed con 100+ views
- Nessun decay temporale
- Nessuna considerazione di qualità
- Nessuna diversity (4 libri della stessa categoria possibili)
- Label *"selezione della settimana"* suggerisce un **trend** che non esiste

Algoritmo nuovo, ispirato a Reddit Hot e Hacker News (entrambi pubblicamente documentati, in particolare HN: `score = (votes-1)^0.8 / (hours+2)^1.8`):

```
trend_score = (views_7d × 1 + loans_7d × 3 + likes × 2)
              × quality_multiplier
              ÷ √(days_since_added + 7)

quality_multiplier = 1 + 0.4 × (avg_rating - 3) / 2
```

**Pesi**: i **prestiti** pesano 3× perché sono il segnale più forte di interesse reale (qualcuno ha davvero voluto leggere quel libro, non solo cliccato sulla pagina). Le **views** 1× perché sono il rumore di fondo (curiosità transitoria). I **like** 2× perché sono un commitment intermedio (l'utente ha detto "mi interessa" ma non si è impegnato a prenderlo in prestito). Pesi ricavati a occhio editorialmente, non da A/B testing; in produzione un team di product avrebbe i loro propri.

**Quality multiplier**: usa il rating medio del **proprietario** (non del libro singolo) perché Lookup non recensisce i libri ma le librerie/persone che li offrono. Se l'owner è recensito 4.5★ medio, `quality_mult = 1 + 0.4 × 0.75 = 1.30`. Se 1★, `quality_mult = 1 + 0.4 × -1 = 0.60`. Range realistico [0.6, 1.4]. Se nessuna recensione → neutro (1.0). Non oscilla troppo: evita che un solo voto negativo (rating 1) annulli completamente un libro che ha attività.

**Decay**: `√(days_since_added + 7)` invece di `(hours+2)^1.8` di HN. HN ha un decay molto aggressivo perché il loro contenuto invecchia in ore. Per i libri condivisi in quartiere, l'invecchiamento è in **giorni**, non ore. La radice quadrata è morbida: un libro di 100 giorni divide il punteggio per ~10, uno di 1000 giorni per ~32 — i libri non spariscono mai del tutto ma cedono il passo ai nuovi. Il `+7` evita che un libro appena aggiunto (`days = 0`) divida per `√0` (infinito).

**Diversity penalty**: scorro la lista ordinata; se una categoria appare già 2 volte, i candidati successivi di quella categoria vengono moltiplicati ×0.5 e la lista viene ri-ordinata. Risultato: nei top 4 raramente hai >2 libri della stessa categoria. Algoritmo greedy non ottimale (un MIP risolverebbe esattamente il problema della massima diversità a parità di score) ma sufficiente per 4 risultati.

**Fallback**: se tutti i `trend_score` sono 0 (caso app appena seedata, nessuna attività degli ultimi 7 giorni), torno alle `book.views` storiche per non avere classifica vuota. Realistico: nei primi giorni dopo il deploy non c'è ancora abbastanza segnale.

**Test pratico** (dopo seed pulito): la classifica era *Le città invisibili* (6gg, score 0.83), *Gomorra* (20gg, 0.58), *Storia di Napoli* (767gg, 0.11), *Se questo è un uomo* (825gg, 0.10) — 4 categorie diverse (Narrativa contemporanea, Saggistica, Storia, Classici), 2 libri freschi davanti, 2 libri storici dopo. Comportamento desiderato.

#### 4.29.3 Tag "Novità" con aura e badge "Appena aperta"

Pattern: due tag visivi temporanei (espirano dopo 14 giorni) per segnalare freshness — uno sui libri, uno sulle librerie. La finestra di 14 giorni è un compromesso: troppo corta (1-2 giorni) renderebbe i tag visibili solo agli utenti molto attivi e farebbe sparire la feature; troppo lunga (1 mese+) li renderebbe sempre presenti e quindi invisibili per assuefazione. 14 giorni = 2 settimane = ritmo umano.

**Aura sui libri**: pseudo-elemento `::before` con `inset: -3px`, gradient con 3 stop della palette (`gold → burgundy → gold` per dare ritmo asimmetrico), `background-size: 200% 200%` per permettere l'animazione di posizione, `filter: blur(6px)` per renderlo "alone" e non "bordo", `z-index: -1` per stare dietro al contenuto. L'animazione `aura-shimmer` di 4s alterna `background-position` da 0% a 100% e scala leggera (1 → 1.02) — molto sottile, non irritante. Solo applicato se `options.highlightRecent: true` su `renderBookCard`, così la sezione "Novità da chi segui" lo attiva ma il resto del sito no. Il badge `✦ NOVITÀ` in alto a sinistra è una pill bordeaux con font-mono uppercase — coerente con gli altri micro-badge.

**Badge "✦ Appena aperta"**: posizionato in alto a destra sulla cover della nearby card. Sfondo `paper/95%` + bordo bordeaux + testo bordeaux. Visivamente distinto dal type-label che sta in alto a sinistra. Trigger: `API.isLibraryFresh(user)` controlla se `user.joined` è < 14 giorni fa. In produzione esisterebbe un campo dedicato `library_opened_at` settato quando `library_role` passa a `'curator'` (un Lettore di vecchia data che apre la libreria oggi dovrebbe essere "appena aperta"), ma per il prototipo `user.joined` è una proxy ragionevole.

**Fix spacing card senza recensioni**: il problema era che `.nearby-card__stars` veniva renderizzato vuoto se `s.count === 0`, collassando il layout e disallineando le card della grid. Fix:
- Se nessuna recensione, renderizzo un placeholder *"Nessuna recensione ancora"* in font-mono soft
- `.nearby-card__stars` ha `min-height: 22px` come safety net anche senza placeholder
- Tutte le card mantengono altezza coerente nella grid

#### 4.29.4 Filter own posts su "Aggiornamenti recenti"

Decisione semplice ma con un trade-off: includere i propri post nel feed degli aggiornamenti?
- **Pro inclusione**: l'utente vede una vista cronologica completa di "cosa è successo", inclusa la propria voce
- **Contro inclusione**: l'utente vede i propri post in più posti (Profilo > tab Post, Libreria pubblica > sezione Post, e ora anche Home > Aggiornamenti recenti), creando ridondanza che diminuisce il valore di ognuno

Decisione: **escludere** i propri post dal feed. Lo spazio in cima alla home è prezioso, vogliamo che mostri *roba degli altri* — chi-segui — non echi dei propri post. I propri post restano nelle altre due location. `getPostsFromFollowed(userId, limit)` da v2.4 includeva `[+userId, ...follows]`; v2.6 toglie l'`userId` dall'insieme. Una riga di codice cambiata.

#### 4.29.5 Popover di conferma sui top-user-item

Nella tab "Utenti più attivi" delle stats, ogni utente è un blocco cliccabile. Pre-v2.6 era un `<a href="library.html?id=...">` — click istantaneo, navigazione via. Problema UX: se l'utente sta **esplorando le statistiche** (confrontando metriche, decidendo a chi interessarsi), un click accidentale lo strappa fuori dalla pagina. La pagina stats è una pagina di **esplorazione contemplativa**, non un'index di chiamate all'azione.

Soluzione: cambio `<a>` → `<button>` con popover di conferma ancorato. Click apre un piccolo dialog vicino al blocco cliccato (`position: absolute` rispetto al `.top-user-item`), con testo *"Vuoi visitare la libreria di {nome}?"* e due bottoni: *Annulla* (chiude il popover) e *Vai al profilo* (link reale che porta a `library.html?id=N`). Click esterno o cambio tab chiude il popover senza navigare.

Il popover ha una piccola "tacca" triangolare in cima (`::before` ruotato 45°) che lo ancora visivamente al blocco — pattern UI riconoscibile da app come Slack/Notion. Animazione `popover-in` 0.18s di apertura. Z-index 50 per stare sopra agli altri blocchi.

Resta accessibile da tastiera: il blocco è un `<button>`, focus visibile (outline), Enter apre il popover, Tab raggiunge i bottoni dentro.

#### 4.29.6 Ridgeline chart "Cronache dei più attivi"

L'utente ha chiesto un grafico "creativo e sperimentale, in tema con il sito" che mostri l'attività dei top 10 utenti nel tempo. Opzioni considerate e scartate:

- **Stacked bar** (come timeline della pagina stats): chiaro, ma piatto. Non racconta — somma.
- **Multi-line chart**: troppe linee sovrapposte = spaghetti illeggibile con 10 utenti.
- **Heatmap calendar (GitHub-style)**: ognuno una griglia, ma occupa tantissimo spazio per 10 utenti.
- **Stream graph (NYT-style)**: bellissimo ma complesso da implementare, e non comunica chi è la persona meglio.

**Scelta: ridgeline (Joy Division-style)**. Ogni utente è una "corsia" orizzontale con la sua linea che fluttua nel tempo, le corsie si sovrappongono leggermente (Joy Division: pulsar PSR B1919+21, copertina di Unknown Pleasures, 1979). Visivamente forte, "editoriale", in tema con la palette letteraria del sito. Mai banale.

**Implementazione**: SVG custom, non Chart.js — Chart.js non ha ridgeline nativo, e usare un wrapper come D3 per una cosa sola era eccessivo. Math semplice:
- Layout: 10 righe alte `ROW_H=56px`, sovrapposte di `OVERLAP=22px`, totale altezza = `TOP_PAD + ROW_H + (N-1)×(ROW_H-OVERLAP) + BOTTOM_PAD`
- Per ogni utente: linea cubic-bezier che attraversa i 26 punti settimanali, ognuno scalato sull'altezza con `y = baseline - (value/max) × (ROW_H × 0.95)`
- Path generator: per ogni segmento `(p[i], p[i+1])`, control point a mezzo della distanza orizzontale con stessa y dei punti — produce curve morbide senza overshoot
- Area: stesso path della linea + due punti di chiusura sulla baseline → `<path fill="color" opacity="0.18">`
- Linea: `<path fill="none" stroke="color" stroke-width="1.6" stroke-linecap="round">`
- Colori: alternanza ciclica `[burgundy, gold, sage]` (le 3 macro della palette) — niente arcobaleno
- Etichette: nome utente a sinistra (`text-anchor="end"`), totale attività a destra
- Asse temporale in basso: tick ogni 4 settimane con label del mese

**Interactivity**: hover su una riga fa scendere l'opacità delle altre a 0.35 — pattern "focus + context" della info-vis classica. Implementato in 3 righe CSS (`.ridgeline-svg:hover .ridgeline-row { opacity: 0.35 } .ridgeline-svg .ridgeline-row:hover { opacity: 1 }`).

**Tema "partitura"**: l'intera lede della sezione la inquadra esplicitamente: *"Una strofa visiva per ciascuno dei dieci utenti più attivi: ogni linea racconta le sue settimane di lavoro nelle librerie diffuse — pubblicazioni, prestiti, recensioni, messaggi — sovrapposte come tracce in una partitura."* La metafora musicale è coerente con il character letterario del sito (Cormorant + Fraunces + palette calda) — non era stato il primo pensiero, ma una volta scelto il ridgeline, è venuto naturale.

**Niente library esterna**: il viewBox è 900×totalH, l'SVG scala via CSS `width: 100%`. Il file rendering è ~200 righe inline in `stats.html` (la funzione `renderTopUsersRidgeline()`) — gestibile, ispezionabile, modificabile senza black box.

### 4.30 Modularizzazione del JavaScript — Fase 0b (v3.0.0-alpha.0+)

Con il bump a `v3.0.0-alpha.0` il progetto entra ufficialmente in transizione verso l'Alpha closed. Il primo passo strutturale è la divisione di `app.js` (5594 righe in un singolo file) in moduli ES separati. Le decisioni di granularità e gli aspetti che abbiamo *deliberatamente* lasciato non-modulari meritano una spiegazione, perché la tentazione di "ESM-ificare tutto" è forte ma controproducente per uno sviluppatore solo che mantiene il progetto.

#### 4.30.1 Cosa è stato spezzato e perché

Cinque moduli, boundaries semantici chiari:

| Modulo | Righe | Responsabilità |
|---|---|---|
| `data.js` | 1065 | Seed fixtures + costanti tassonomiche (BISAC, LOAN_STATUS, ORG_CATEGORIES, LIBRARY_COVER_DESIGNS) + helper temporale `daysAgo()` |
| `storage.js` | 162 | Wrapper su `localStorage` + `DATA_VERSION` + reseed logic |
| `api.js` | 2621 | Logica applicativa: tutti i metodi business (books, users, loans, reviews, posts, stats, geo, auth) |
| `ui.js` | 1809 | Rendering DOM + wiring eventi (componenti, nav, avatar menu, popover) |
| `app.js` | 63 | Entry point: import + init `DOMContentLoaded` + esposizione globale `window.API/UI/Storage` |

Dipendenze unidirezionali, niente cicli:

```
            ┌─────────────┐
            │   app.js    │  (entry)
            └──────┬──────┘
                   │ import
        ┌──────────┴──────────┐
        ▼                     ▼
    ┌────────┐            ┌────────┐
    │ ui.js  │ ─ import ─→│ api.js │
    └────────┘            └────┬───┘
                               │ import
                               ▼
                          ┌─────────┐
                          │storage  │
                          │   .js   │
                          └────┬────┘
                               │ import
                               ▼
                          ┌─────────┐
                          │ data.js │
                          └─────────┘
```

`ui.js` importa anche direttamente da `data.js` per le costanti che usa nel rendering (LIBRARY_COVER_DESIGNS, LOAN_STATUS_LABEL): è un'eccezione consapevole alle dipendenze "a piramide" — alternativa sarebbe stato esporre tutto via `api.js` come passthrough, ma sarebbe stato un anti-pattern facade gratuito.

#### 4.30.2 Cosa NON è stato spezzato (e perché)

Tre componenti restano "monolitici" *deliberatamente*. Ogni scelta è motivata, non frutto di pigrizia.

**`api.js` resta in un solo file da 2621 righe.** Sarebbe stato facile spezzarlo in `api/books.js`, `api/users.js`, `api/loans.js`, `api/posts.js`, etc. — ma per uno sviluppatore solo che mantiene il progetto, navigare 10 file piccoli è *più lento* che navigare un file singolo con sezioni chiare. Le sezioni interne di `api.js` sono già marcate con commenti grossi `/* ===== USERS ===== */`, `/* ===== BOOKS ===== */`, raggiungibili con Ctrl-F in 2 secondi. Inoltre, molti metodi attraversano i confini di dominio (es. `deleteUser` cancella anche libri, prestiti, recensioni dell'utente — sta in 1 file ma toccherebbe 4 file dopo lo split). La modularizzazione fine porta a "import bloat" e mental overhead senza vero beneficio in questa scala.

**`ui.js` resta in un solo file da 1809 righe.** Stessa logica. I componenti UI (renderBookCard, renderLibraryCard, renderPostCard, ridgeline, popover, avatar menu) sono già marcati con sezioni chiare. Spezzare in `ui/components/bookCard.js`, `ui/components/postCard.js` etc. avrebbe creato 15+ file ognuno con 50-200 righe e import incrociati per condividere helper. Mantenuti insieme, il refactor cross-componente è banale (es. *"cambio il colore burgundy in tutti i componenti che lo usano"*).

**Il CSS resta unificato in `styles.css` (7062 righe).** Già organizzato in 52 sezioni numerate con commenti chiari (`/* 51. v2.5 quick fix... */`). Spezzare in `css/base.css`, `css/components/*.css`, `css/pages/*.css` raddoppierebbe il lavoro di questa sessione senza beneficio percepibile: il browser carica un singolo bundle CSS, e per il dev navigare le sezioni è già rapido con la table of contents in cima al file. Decisione: lasciato così, eventualmente spezzato in una sessione dedicata se cresce oltre 10k righe.

**Gli inline script negli HTML restano dove sono.** Pagine come `index.html` (~150 righe inline), `stats.html` (~200 righe inline) hanno `<script>...</script>` con wiring specifico della pagina: render del feed "Novità da chi segui", event handler dei filtri, animazioni di entrata, popolamento condizionale di sezioni `auth-only`. Sarebbe stato possibile estrarre in `js/pages/index.js`, `js/pages/stats.js` e farne moduli ES — *ma* avrebbe trasformato il sito in qualcosa di più "framework-like" senza vero beneficio:

1. **Gli HTML sono auto-contenuti.** Aprendo `stats.html`, leggi sopra il markup, sotto la logica che lo anima. Niente file separato da trovare.
2. **Lo scope è naturalmente limitato.** Una variabile dichiarata nell'inline script di `stats.html` non interferisce con `index.html`. È IIFE-like senza l'IIFE.
3. **Il debug è più facile.** Lo stack trace dice "stats.html linea N" non "pages/stats.js linea N → main.js linea M".

In Fase 1 (backend), il rapporto cambierà: i tipi Zod condivisi e i metodi di API client async vivranno in moduli importati anche dagli inline script. Ma anche allora gli inline script delle pagine resteranno page-specific — non c'è valore nel "page object pattern" full quando ogni pagina è statica e indipendente.

#### 4.30.3 Esposizione globale via `window`

Il nuovo `app.js` ha esattamente 4 sezioni: import dei 4 moduli, esposizione globale via `window.API`, `window.UI`, `window.Storage` (più alcune costanti), event listener `DOMContentLoaded` con gli init. Il pattern `window.API = API` può sembrare "globals are bad" a chi viene da React/Vue, ma in questo contesto è la scelta corretta:

- Gli inline script delle pagine HTML *si aspettano* `API`/`UI`/`Storage` come globali (è così che il prototipo è stato scritto, è così che funziona)
- I moduli ES sono **chiusi** by design — niente `var X = ...` finisce su `window`
- Per esporre intenzionalmente serve `window.API = API` esplicito
- Se in futuro vogliamo "depurare" gli inline e farli diventare moduli, si tolgono le 4 righe di `window.X = X` e si fanno `import { API } from './api.js'` negli script delle pagine

Il pattern è opt-in, esplicito, reversibile. Non è una "rete di puntatori globali ovunque" — è un'interfaccia esposta intenzionalmente a uno strato (gli inline script) che ne ha bisogno per ragioni storiche e di leggibilità.

#### 4.30.4 Tag `<script type="module">`

Gli HTML caricano ora `app.js` con `<script type="module">`. Conseguenze tecniche:

- I moduli sono **deferred per default**: eseguiti dopo il parsing del DOM, ma prima dell'evento `DOMContentLoaded`
- L'attributo `defer` esplicito (usato in `login.html` pre-modularizzazione) è ridondante e l'ho rimosso
- I moduli ES richiedono **server HTTP** (non funzionano con `file://`). Per testing locale serve un server, anche minimale (`python3 -m http.server`)

L'ordine di esecuzione garantito è:
1. Il browser parsa l'HTML
2. Incontra i `<script>` inline regolari → li esegue immediatamente (registrando i loro `DOMContentLoaded` listener)
3. Continua a parsare l'HTML
4. Quando vede `<script type="module" src="js/app.js">` lo schedule come deferred
5. Finito di parsare l'HTML → carica ed esegue il modulo `app.js` (e tutte le sue dipendenze in cascata)
6. Il modulo `app.js` registra il suo `DOMContentLoaded` listener e assegna `window.API/UI/Storage`
7. Browser scatena `DOMContentLoaded` → tutti i listener vengono chiamati in ordine di registrazione
8. Quando un listener inline chiama `API.foo()`, `window.API` è già definito ✓

L'unico caso che fallirebbe è uno script inline che usa `API.*` *al top level* (fuori da event listener), perché verrebbe eseguito al passo 2 quando `app.js` non è ancora caricato. Audit della codebase: zero occorrenze di questo pattern. Tutto è dentro `DOMContentLoaded` o event handler successivi.

#### 4.30.5 Cosa cambia in Fase 2

In Fase 2 (migrazione frontend → backend reale), `storage.js` sarà il modulo che cambia di più. Da synchronous wrapper su localStorage diventerà async client API che chiama fetch sul backend Fastify:

```javascript
// storage.js (oggi, Fase 0b)
export const Storage = {
  get(key) { return JSON.parse(localStorage.getItem(key)); },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

// storage.js (target Fase 2)
export const Storage = {
  async get(key) {
    const res = await fetch(`/api/state/${key}`);
    return res.ok ? res.json() : null;
  },
  async set(key, value) {
    return fetch(`/api/state/${key}`, {
      method: 'PUT', body: JSON.stringify(value),
      headers: {'Content-Type': 'application/json'}
    });
  }
};
```

Questa è una semplificazione: in realtà il refactor sarà più radicale, con `api.js` che diventerà un client REST puro (`async function getBooks() { return fetch('/api/books').then(r => r.json()) }`) invece di passare per Storage. Ma il principio resta: i confini introdotti in Fase 0b sono *esattamente* quelli che servono per rendere la migrazione gestibile in Fase 2.

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

*Lookup* dimostra che è possibile costruire uno strumento di condivisione culturale di prossimità con tecnologie web consolidate e con un approccio rigoroso ad accessibilità e privacy. Il prototipo implementato copre il percorso utente completo — dalla registrazione alla richiesta di prestito — e pone le basi per un'evoluzione verso un sistema in produzione.

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

*Documento redatto nell'ambito del progetto didattico Lookup — v3.0.0-alpha.0*
