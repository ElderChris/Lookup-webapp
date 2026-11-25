# Lookup

Piattaforma web per la condivisione e il prestito di libri tra privati e
organizzazioni culturali, con ricerca geolocalizzata.

Questo documento spiega come avviare Lookup sul proprio computer e come
verificarne il funzionamento.

---

## Requisiti

| Software | Versione | Note |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows, macOS) oppure Docker Engine (Linux) | Compose v2 | Deve essere **avviato** prima dei comandi qui sotto |
| [Node.js](https://nodejs.org/) | 26 o superiore | Include `npm` |
| [Git](https://git-scm.com/) | qualsiasi recente | Per clonare il repository |

Porte che devono essere libere: `8080` (applicazione), `3000` (API),
`5432` (PostgreSQL), `6379` (Redis), `1025` e `8025` (email di prova).

---

## Installazione

```bash
git clone https://github.com/ElderChris/Lookup-webapp.git
cd Lookup-webapp
npm ci
```

`npm ci` installa le dipendenze e crea il file di configurazione
`apps/api/.env` a partire da `apps/api/.env.example`. I valori predefiniti
funzionano senza modifiche.

---

## Avvio

### 1. Servizi

```bash
docker compose --profile backend up -d --build
```

Il primo avvio scarica le immagini e costruisce l'API: richiede qualche
minuto. Per controllare lo stato:

```bash
docker compose --profile backend ps
```

Tutti i servizi devono risultare `healthy` (l'API impiega circa 15 secondi).

### 2. Database (solo al primo avvio)

```bash
npm run db:migrate:deploy -w apps/api
npm run db:seed -w apps/api
```

Il primo comando crea le tabelle, il secondo carica i dati di prova
(utenti, libri, categorie).

> Il comando `db:seed` **azzera** i dati esistenti prima di ricaricare
> quelli di prova. Va eseguito solo al primo avvio o dopo un reset.

### 3. Indirizzi

| Servizio | Indirizzo |
|---|---|
| Applicazione | http://localhost:8080 |
| API — stato dei servizi | http://localhost:3000/api/health |
| API — documentazione interattiva | http://localhost:3000/api/docs |
| Email di prova (Mailpit) | http://localhost:8025 |

Tutte le email inviate dall'applicazione (conferma registrazione, recupero
password, notifiche) non escono dal computer: si leggono in Mailpit.

---

## Account di prova

Tutti gli account hanno la stessa password: **`Lookup2026!`**

| Email | Tipo |
|---|---|
| `admin@lookup.local` | Amministratore |
| `c.morandi@mail.it` | Persona |
| `m.devito@mail.it` | Persona |
| `a.russo@mail.it` | Persona |
| `l.esposito@mail.it` | Persona |
| `g.ferrari@mail.it` | Persona |
| `r.mazzone@mail.it` | Persona |
| `info@bibliosanita.org` | Organizzazione |
| `contatti@lettorierranti.it` | Organizzazione |
| `ciao@libreriaspaccanapoli.it` | Organizzazione |
| `info@centromezzogiorno.it` | Organizzazione |

---

## Test

### Verifica completa (Windows)

Dalla cartella del progetto, in PowerShell:

```powershell
.\scripts\verify.ps1
```

Lo script controlla i requisiti, installa le dipendenze, avvia i servizi,
prepara il database (caricando i dati di prova solo se è vuoto), controlla
le versioni in esecuzione, esegue una prova delle funzioni principali
(accesso, prestiti, notifiche in tempo reale), la suite di test automatici
e i test nel browser.
Al termine mostra un riepilogo con l'esito di ogni passo.

Il dettaglio completo è salvato in `logs/verify-latest.log`.

Opzioni utili:

| Opzione | Effetto |
|---|---|
| `-SkipInstall` | Non reinstalla le dipendenze |
| `-SkipPull -SkipBuild` | Riusa le immagini Docker già presenti |
| `-SkipTests` | Salta la suite di test automatici |
| `-SkipE2E` | Salta i test nel browser |
| `-Down` | Ferma i servizi al termine |
| `-Reseed` | Ricarica i dati di prova anche se il database non è vuoto (**cancella** i dati esistenti) |

Se PowerShell impedisce l'esecuzione dello script, eseguire una sola volta:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Test automatici (qualsiasi sistema operativo)

Con i servizi avviati:

```bash
npm run test:setup-db -w apps/api
npm test -w apps/api
```

Il primo comando prepara un database dedicato ai test (`lookup_test`),
separato da quello dell'applicazione: i test non toccano i dati in uso.

### Test nel browser (Playwright)

Percorrono l'applicazione come farebbe una persona: apertura di tutte le
pagine, iscrizione con conferma via email, richiesta di prestito da ospite,
ciclo completo del prestito, sospensione da parte dell'amministratore,
recupero della password ed eliminazione dell'account.

Una sola volta, dalla cartella del progetto (così viene scaricata la versione
del browser adatta a quella di Playwright installata):

```bash
npx playwright install chromium
```

Poi, con i servizi avviati (compreso Mailpit, da cui i test leggono i link
di conferma):

```bash
npm run test:e2e
```

I test creano solo utenti propri (nome utente che inizia con `e2e.`) e li
eliminano al termine; usano l'amministratore dei dati di prova
(`admin@lookup.local`). Indirizzi e credenziali si cambiano con le variabili
`E2E_BASE_URL`, `E2E_MAILPIT_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`.
In caso di errore il report dettagliato è in `e2e/report/index.html`.
`verify.ps1` li esegue automaticamente se il browser è installato.

### Prova manuale consigliata

1. Aprire http://localhost:8080 e accedere come `c.morandi@mail.it`
2. In un secondo browser (o in una finestra anonima) accedere come
   `m.devito@mail.it`
3. Dal primo utente, richiedere in prestito un libro del secondo
4. Verificare che nel secondo browser la notifica compaia **senza ricaricare
   la pagina**
5. Accettare la richiesta e seguire il prestito fino alla restituzione

---

## Servizi opzionali

| Servizio | Avvio | Indirizzo | Credenziali |
|---|---|---|---|
| Monitoraggio (Grafana + Prometheus) | `docker compose --profile monitoring up -d` | Grafana: http://localhost:3001 — Prometheus: http://localhost:9090 | `admin` / `admin` |
| Amministrazione database (pgAdmin) | `docker compose --profile admin up -d` | http://localhost:5050 | `admin@localhost` / `admin` |

---

## Arresto e reset

```bash
# Ferma i servizi, i dati restano
docker compose --profile backend down

# Ferma i servizi e CANCELLA tutti i dati
docker compose --profile backend down -v
```

Dopo un reset, ripetere il passo 2 dell'avvio (database).

---

## Configurazione delle porte

Per cambiare una porta, copiare `.env.example` in `.env` nella cartella
principale e modificare la variabile corrispondente (`WEB_PORT`,
`POSTGRES_PORT`, `REDIS_PORT`, `PGADMIN_PORT`).

La porta dell'API (`3000`) **non va modificata**: l'applicazione la usa
come indirizzo fisso.

---

## Problemi comuni

| Sintomo | Soluzione |
|---|---|
| `error during connect` o `Cannot connect to the Docker daemon` | Docker Desktop non è avviato |
| `port is already allocated` | Una porta è occupata da un altro programma: liberarla o cambiarla (vedi sopra) |
| L'accesso con gli account di prova non funziona | Eseguire `npm run db:seed -w apps/api` |
| `/api/health` risponde `degraded` | PostgreSQL o Redis non sono pronti: attendere qualche secondo e verificare con `docker compose --profile backend ps` |
| Le modifiche non si vedono nel browser | Ricaricare senza cache (Ctrl+F5) |

---

## Licenza

GNU General Public License versione 3 (GPL-3.0): testo completo nel file
[LICENSE](LICENSE). Caratteri e librerie in `apps/web/vendor` mantengono le
rispettive licenze, incluse nelle loro cartelle.

### Dati di terze parti

- **Comuni italiani** (ricerca per luogo in Esplora): confini amministrativi
  © ISTAT, licenza [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  nella versione GeoJSON di Openpolis
  ([geojson-italy](https://github.com/guglielmo/geojson-italy)). Sono caricati nel
  database dalla migrazione `20261125150000_places`, generata con
  `apps/api/scripts/build-places-migration.mjs` (istruzioni nel file).
- **Mappe**: © contributori di OpenStreetMap, licenza ODbL.
