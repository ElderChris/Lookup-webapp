# Libreria Diffusa

> Piattaforma di **geolocalizzazione culturale** per la condivisione del patrimonio librario privato.

Libreria Diffusa permette a lettori, collezionisti e piccole biblioteche domestiche di pubblicare il proprio patrimonio, geolocalizzarlo in modo rispettoso della privacy, e metterlo a disposizione per consultazione o prestito tra utenti limitrofi.

Il prototipo qui incluso è ambientato nell'**area metropolitana di Napoli** (Chiaia, Vomero, Posillipo, Centro Storico, Portici, Pozzuoli) ed è pensato come riferimento replicabile per altre comunità territoriali o tematiche.

---

## Indice

1. [Caratteristiche](#caratteristiche)
2. [Stack tecnologico](#stack-tecnologico)
3. [Come eseguire il prototipo](#come-eseguire-il-prototipo)
4. [Struttura del repository](#struttura-del-repository)
5. [Database](#database)
6. [Accessibilità e privacy](#accessibilità-e-privacy)
7. [Documentazione aggiuntiva](#documentazione-aggiuntiva)
8. [Licenza](#licenza)

---

## Caratteristiche

- **Registrazione e profilo utente** con preferenze di privacy granulari (visibilità profilo, precisione della geolocalizzazione su 4 livelli, consensi GDPR espliciti).
- **Pubblicazione di libri** con inserimento metadati bibliografici (titolo, autore, anno, ISBN, categoria, lingua, pagine, condizione, descrizione) e **upload della copertina** con generazione lato client della miniatura 160×240.
- **Ricerca combinata**: testuale (titolo, autore, descrizione) e **spaziale** (raggio 1/3/5/10 km dal punto di interesse).
- **Visualizzazione su mappa** (Leaflet + OpenStreetMap) con marker raggruppati per proprietario e popup dettagliati.
- **Pagina di dettaglio libro** con anteprima, metadati completi, altri libri del medesimo proprietario e form di **richiesta di prestito** con consenso esplicito alla condivisione dei dati di contatto.
- **Statistiche pubbliche** (grafici interattivi su visualizzazioni, categorie, top libri) con fallback testuale accessibile.
- **Dashboard amministrativa** per moderazione utenti, libri e segnalazioni, più azioni di sistema (export backup JSON, rigenerazione miniature, reset).

## Stack tecnologico

### Prototipo (questo repository)

| Layer | Tecnologia | Note |
|---|---|---|
| Frontend | HTML5 semantico + CSS3 + JS vanilla (ES2020) | Nessun framework, zero dipendenze di build |
| Mappe | [Leaflet 1.9](https://leafletjs.com/) + OpenStreetMap | Marker personalizzati, popup HTML |
| Grafici | [Chart.js 4.4](https://www.chartjs.org/) | Line, doughnut, bar, combo |
| Persistenza demo | `localStorage` del browser | Mock backend per finalità didattiche |
| Tipografia | Cormorant Garamond, Fraunces, JetBrains Mono | Via Google Fonts |

### Architettura di produzione (descritta nel rapporto tecnico)

| Layer | Scelta |
|---|---|
| Runtime | Node.js 20 LTS + Express 4 |
| Database | PostgreSQL 15 + PostGIS 3.3 |
| Storage immagini | S3-compatibile (MinIO in dev, AWS S3 in prod) |
| Elaborazione immagini | [Sharp](https://sharp.pixelplumbing.com/) per generazione varianti |
| Auth | JWT + bcrypt, refresh token httpOnly |
| Deploy | Docker Compose in dev, Kubernetes/container in prod |

## Come eseguire il prototipo

Il prototipo è **interamente lato client**: nessun server, nessuna compilazione, nessuna dipendenza da installare.

### Opzione 1 — Doppio click

Aprire il file `index.html` direttamente nel browser.

> ⚠️ Alcuni browser (in particolare Chrome) applicano restrizioni CORS sul `file://` che possono impedire il caricamento di alcune risorse. In questo caso, usare l'opzione 2.

### Opzione 2 — Server locale (consigliato)

Qualsiasi server statico funziona. Esempi:

```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve -p 8080

# PHP
php -S localhost:8080
```

Poi aprire <http://localhost:8080>.

### Percorsi utente suggeriti

1. **Home** (`index.html`) → panoramica, libri in evidenza, categorie.
2. **Esplora** (`explore.html`) → mappa + filtri testuali e spaziali.
3. **Dettaglio libro** (`book-detail.html?id=1`) → simulare una richiesta di prestito.
4. **Profilo** (`profile.html`) → gestire libreria, richieste ricevute, impostazioni privacy.
5. **Aggiungi libro** (`add-book.html`) → form con upload copertina e generazione miniatura.
6. **Statistiche** (`stats.html`) → grafici e tabelle.
7. **Admin** (`admin.html`) → dashboard moderazione.

### Reset dei dati

Dalla pagina Admin o dalla console del browser:

```javascript
localStorage.clear(); location.reload();
```

## Struttura del repository

```
libreria-diffusa/
├── index.html              # Homepage
├── explore.html            # Ricerca + mappa
├── book-detail.html        # Dettaglio libro + richiesta prestito
├── add-book.html           # Pubblicazione libro + upload copertina
├── profile.html            # Profilo utente (tab: libreria/richieste/privacy)
├── stats.html              # Statistiche pubbliche
├── admin.html              # Dashboard amministrativa
├── login.html
├── register.html
│
├── css/
│   └── styles.css          # Foglio di stile unico, tokens + componenti
│
├── js/
│   └── app.js              # Mock data + API layer + utilities UI
│
├── sql/
│   ├── schema.sql          # Schema PostgreSQL + PostGIS
│   └── seed_data.sql       # Dati di popolamento
│
└── docs/
    └── rapporto_tecnico.md # Rapporto tecnico (requisiti, architettura, UX)
```

## Database

Lo schema è PostgreSQL 15+ con estensione **PostGIS** per la gestione geospaziale e **pg_trgm** per la ricerca testuale fuzzy.

```bash
# Creazione database
createdb libreria_diffusa

# Schema e seed
psql -d libreria_diffusa -f sql/schema.sql
psql -d libreria_diffusa -f sql/seed_data.sql
```

Punti salienti dello schema:

- `users.location` è un `GEOGRAPHY(POINT, 4326)` (WGS84) con **indice GIST**.
- `users.location_precision` codifica la granularità desiderata dall'utente (0 = nascosta, 1 = solo città, 2 = zona ±200m, 3 = precisa). La **view `v_public_books`** applica automaticamente la fuzzificazione via `ST_SnapToGrid`.
- La **funzione `find_books_within(lat, lng, radius_m)`** esegue la ricerca spaziale usando `ST_DWithin` su tipi `geography` (supporto nativo ai metri sulla superficie terrestre).
- Indici GIN trigram su `title` e `author` per la ricerca testuale tollerante agli errori di battitura.
- Vincoli `CHECK` a livello schema (es. `no_self_loan`, range anno pubblicazione, valori enum).
- Triggers per `updated_at` e aggiornamento automatico di `request_count`.

Credenziali demo (dopo il seed): tutti gli utenti hanno password **`demo1234`** (hash bcrypt placeholder — cambiare prima di esporre il servizio).

## Accessibilità e privacy

### Accessibilità (WCAG 2.1 livello AA)

- HTML5 semantico: landmark `<header>/<nav>/<main>/<footer>`, heading gerarchia corretta, liste per insiemi di elementi.
- **Skip link** su ogni pagina per saltare direttamente al contenuto principale.
- Focus visibile esplicito (`:focus-visible` con outline 2px di colore contrastato).
- Tutti gli elementi interattivi raggiungibili da tastiera; tab-order logico.
- **ARIA** usato solo dove necessario: `role="tablist"/"tab"/"tabpanel"` nel profilo, `aria-live` per messaggi di stato, `aria-label` per icone senza testo.
- Contrasti testo/sfondo ≥ 4.5:1 (testi normali) e ≥ 3:1 (testi grandi).
- `prefers-reduced-motion`: disabilita transizioni per utenti che lo richiedono.
- Tutti i grafici hanno un **fallback tabellare** in `<details>` con dati strutturati.

### Privacy

- **Geolocalizzazione a precisione variabile** controllata dall'utente (4 livelli).
- Per i livelli 1–2 la posizione visualizzata è fuzzificata sul server prima di essere restituita al client.
- Richieste di prestito con **consenso esplicito** e separato alla condivisione dei dati di contatto.
- Dashboard privacy con azioni **GDPR**: export dati, rettifica, cancellazione account.
- Consensi raccolti con timestamp separati (ToS, privacy policy, newsletter opt-in).

## Documentazione aggiuntiva

Il **rapporto tecnico completo** (analisi del contesto, requisiti funzionali e non-funzionali, architettura di riferimento, scelte UX) è in `docs/rapporto_tecnico.md`.

## Licenza

Distribuito con licenza **GPL-3.0**. Vedi il file `LICENSE` (da aggiungere in fase di rilascio).

I dati di esempio (nomi utenti, descrizioni libri) sono fittizi e creati a fini didattici.

---

**Versione**: 0.1.0 — prototipo didattico
