-- =============================================================================
-- LIBRERIA DIFFUSA — Schema del database PostgreSQL
-- -----------------------------------------------------------------------------
-- Sistema di gestione: PostgreSQL 15+ con estensione PostGIS
-- Autore: progetto didattico
-- Data: 2026-04
-- =============================================================================

-- ---- 1. Estensioni necessarie ------------------------------------------------
-- PostGIS per dati geospaziali (coordinate, ricerca per distanza)
CREATE EXTENSION IF NOT EXISTS postgis;
-- pg_trgm per ricerca testuale fuzzy (ILIKE ottimizzato)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- pgcrypto per hash password e UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- 2. TABELLE PRINCIPALI
-- =============================================================================

-- ---- Tabella UTENTI ---------------------------------------------------------
-- Contiene le informazioni di profilo e le preferenze di privacy.
-- La geolocalizzazione è salvata come GEOGRAPHY(POINT, 4326), che permette
-- di usare operatori di distanza in metri (ST_DWithin, ST_Distance).
-- -----------------------------------------------------------------------------

CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  uuid            UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  username        VARCHAR(30) NOT NULL UNIQUE,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,   -- bcrypt / argon2

  -- Profilo pubblico
  display_name    VARCHAR(100) NOT NULL,
  bio             TEXT,
  avatar_url      VARCHAR(500),
  city_label      VARCHAR(150),             -- testo libero: "Napoli, Chiaia"

  -- Tipo di account / libreria
  -- 'person'       → collezione privata di un lettore
  -- 'organization' → fondo di un ente (associazione, biblioteca di
  --                   quartiere, libreria indipendente…). I dati
  --                   specifici dell'ente vivono in organization_profiles.
  account_type    VARCHAR(20) NOT NULL DEFAULT 'person'
                  CHECK (account_type IN ('person','organization')),

  -- Posizione geospaziale (PostGIS)
  -- In produzione la si ottiene da geocoding dell'indirizzo
  location        GEOGRAPHY(POINT, 4326),   -- WGS84 = standard web

  -- Preferenze privacy
  location_precision  SMALLINT NOT NULL DEFAULT 2
                      CHECK (location_precision BETWEEN 0 AND 3),
                      -- 0 = nascosta, 1 = solo città, 2 = zona (±200m), 3 = precisa
  profile_visibility  VARCHAR(20) NOT NULL DEFAULT 'public'
                      CHECK (profile_visibility IN ('public','registered','private')),
  email_visible       BOOLEAN NOT NULL DEFAULT FALSE,
  accepts_loans       BOOLEAN NOT NULL DEFAULT TRUE,
  accepts_messages    BOOLEAN NOT NULL DEFAULT TRUE,

  -- Consensi GDPR
  consent_tos         TIMESTAMPTZ NOT NULL,    -- data accettazione ToS
  consent_privacy     TIMESTAMPTZ NOT NULL,    -- data accettazione Privacy
  consent_newsletter  TIMESTAMPTZ,             -- nullable: opt-in

  -- Controllo account
  role                VARCHAR(20) NOT NULL DEFAULT 'user'
                      CHECK (role IN ('user','moderator','admin')),
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','pending','suspended','deleted')),
  email_verified      BOOLEAN NOT NULL DEFAULT FALSE,

  -- Auditing
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at       TIMESTAMPTZ
);

COMMENT ON TABLE users IS 'Utenti della piattaforma con profili e preferenze di privacy';
COMMENT ON COLUMN users.location_precision IS '0=nascosta, 1=solo città, 2=zona ±200m, 3=precisa';


-- ---- Tabella CATEGORIE ------------------------------------------------------
-- Tassonomia controllata dei generi letterari.
-- -----------------------------------------------------------------------------

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL UNIQUE,
  slug        VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  sort_order  SMALLINT DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);


-- ---- Tabella LIBRI ----------------------------------------------------------
-- Un libro appartiene a un utente (owner). Può contenere metadati ISBN,
-- descrizione, condizione e uno stato di disponibilità al prestito.
-- -----------------------------------------------------------------------------

CREATE TABLE books (
  id              BIGSERIAL PRIMARY KEY,
  uuid            UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  owner_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id     INT NOT NULL REFERENCES categories(id),

  -- Metadati bibliografici
  title           VARCHAR(500) NOT NULL,
  author          VARCHAR(300) NOT NULL,
  year            INT CHECK (year BETWEEN 1400 AND 2100),
  language        VARCHAR(50) DEFAULT 'Italiano',
  isbn            VARCHAR(13),       -- 10 o 13 cifre
  publisher       VARCHAR(200),
  pages           INT CHECK (pages > 0),
  description     TEXT,
  tags            TEXT[],            -- array di tag liberi

  -- Stato fisico e logistica
  condition       VARCHAR(30) DEFAULT 'buone condizioni'
                  CHECK (condition IN ('come nuovo','ottime condizioni',
                                       'buone condizioni','discrete','da restauro')),
  available       BOOLEAN NOT NULL DEFAULT TRUE,
  loan_policy     VARCHAR(20) NOT NULL DEFAULT 'loan'
                  CHECK (loan_policy IN ('loan','consult','display')),
                  -- loan=prestito, consult=solo consultazione, display=solo visibile

  -- Metriche
  view_count      INT NOT NULL DEFAULT 0,
  request_count   INT NOT NULL DEFAULT 0,

  -- Moderazione
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','pending_review','hidden','removed')),

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN books.tags IS 'Tag libero-testuali aggiuntivi (es. prima edizione, dedica autografa)';


-- ---- Tabella IMMAGINI (copertine e miniature) -------------------------------
-- Ogni libro può avere più varianti (original, medium, thumb) memorizzate
-- come record distinti per facilitare il serving ottimizzato.
-- -----------------------------------------------------------------------------

CREATE TABLE book_images (
  id          BIGSERIAL PRIMARY KEY,
  book_id     BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  variant     VARCHAR(20) NOT NULL
              CHECK (variant IN ('original','large','medium','thumb')),
  url         VARCHAR(500) NOT NULL,    -- path/URL su storage (S3/locale)
  width       INT, height INT,
  mime_type   VARCHAR(50),
  size_bytes  BIGINT,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (book_id, variant)
);


-- ---- Tabella RICHIESTE DI PRESTITO ------------------------------------------
-- Traccia le interazioni di prestito tra utenti.
-- -----------------------------------------------------------------------------

CREATE TABLE loan_requests (
  id              BIGSERIAL PRIMARY KEY,
  book_id         BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  requester_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  message         TEXT,                  -- messaggio iniziale del richiedente
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','rejected','completed','cancelled')),
  response_note   TEXT,                  -- nota del proprietario

  requested_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,

  -- Vincolo: no auto-prestito
  CONSTRAINT no_self_loan CHECK (requester_id <> owner_id)
);


-- ---- Tabella EVENTI DI VISUALIZZAZIONE --------------------------------------
-- Log anonimizzato delle consultazioni (per statistiche).
-- -----------------------------------------------------------------------------

CREATE TABLE view_events (
  id          BIGSERIAL PRIMARY KEY,
  book_id     BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
                      -- nullable: anche utenti anonimi vengono tracciati
  session_id  VARCHAR(64),       -- sessione anonima (hash)
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  referrer    VARCHAR(500)
);


-- ---- Tabella SEGNALAZIONI (moderazione) -------------------------------------

CREATE TABLE reports (
  id              BIGSERIAL PRIMARY KEY,
  reporter_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type     VARCHAR(20) NOT NULL CHECK (target_type IN ('book','user','comment')),
  target_id       BIGINT NOT NULL,
  reason          VARCHAR(50) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_review','resolved','dismissed')),
  resolved_by     BIGINT REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- 3. INDICI
-- =============================================================================

-- Indice spaziale: il cuore delle query "libri vicini a me"
CREATE INDEX idx_users_location ON users USING GIST (location);

-- Indici di ricerca testuale (trigram)
CREATE INDEX idx_books_title_trgm   ON books USING GIN (title gin_trgm_ops);
CREATE INDEX idx_books_author_trgm  ON books USING GIN (author gin_trgm_ops);

-- Indici di integrità referenziale
CREATE INDEX idx_books_owner_id     ON books (owner_id);
CREATE INDEX idx_books_category_id  ON books (category_id);
CREATE INDEX idx_books_status       ON books (status) WHERE status = 'active';
CREATE INDEX idx_loan_requests_book ON loan_requests (book_id);
CREATE INDEX idx_loan_requests_req  ON loan_requests (requester_id);
CREATE INDEX idx_view_events_book   ON view_events (book_id);
CREATE INDEX idx_view_events_date   ON view_events (viewed_at);


-- =============================================================================
-- 4. VISTE UTILITÀ
-- =============================================================================

-- Vista pubblica: libri attivi con metadati proprietario (rispetta privacy)
CREATE OR REPLACE VIEW v_public_books AS
SELECT
  b.id, b.uuid, b.title, b.author, b.year, b.language,
  b.description, b.pages, b.condition, b.available,
  b.view_count, b.request_count, b.created_at,
  c.name AS category_name,
  u.display_name  AS owner_name,
  u.city_label    AS owner_city,
  -- Usa posizione "sfocata" se preferenza ≤ 2 (non precisa)
  CASE u.location_precision
    WHEN 3 THEN u.location
    WHEN 2 THEN ST_SnapToGrid(u.location::geometry, 0.002)::geography  -- ~200m
    WHEN 1 THEN ST_SnapToGrid(u.location::geometry, 0.01)::geography   -- ~1km
    ELSE NULL
  END AS display_location
FROM books b
JOIN users u      ON b.owner_id = u.id
JOIN categories c ON b.category_id = c.id
WHERE b.status = 'active'
  AND u.status = 'active'
  AND u.profile_visibility = 'public';

COMMENT ON VIEW v_public_books IS 'Vista pubblica che applica le regole di privacy degli utenti';


-- =============================================================================
-- 5. FUNZIONI DI SUPPORTO
-- =============================================================================

-- Funzione: libri entro raggio (in metri) da un punto
-- Uso: SELECT * FROM find_books_within(40.8358, 14.2488, 5000);
CREATE OR REPLACE FUNCTION find_books_within(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_m INT
)
RETURNS TABLE (
  book_id    BIGINT,
  title      VARCHAR,
  author     VARCHAR,
  distance_m DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id, b.title, b.author,
    ST_Distance(u.location, ST_MakePoint(lng, lat)::geography) AS distance_m
  FROM books b
  JOIN users u ON b.owner_id = u.id
  WHERE b.status = 'active'
    AND u.location IS NOT NULL
    AND ST_DWithin(u.location, ST_MakePoint(lng, lat)::geography, radius_m)
  ORDER BY distance_m;
END;
$$ LANGUAGE plpgsql STABLE;


-- Trigger per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION trg_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER books_update_timestamp
  BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

CREATE TRIGGER users_update_timestamp
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();


-- Trigger: incrementa request_count su nuova richiesta prestito
CREATE OR REPLACE FUNCTION trg_increment_request_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE books SET request_count = request_count + 1 WHERE id = NEW.book_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loan_requests_increment
  AFTER INSERT ON loan_requests
  FOR EACH ROW EXECUTE FUNCTION trg_increment_request_count();


-- =============================================================================
-- TABELLA: PREFERENZE DI PERSONALIZZAZIONE DEL PROFILO (v0.2)
-- =============================================================================
-- Memorizza le scelte estetiche e di visualizzazione che l'utente fa
-- nella pagina dedicata "Personalizza profilo". È in relazione 1:1 con
-- users e separata dalla tabella principale per due motivi:
--
--   1. Le preferenze cambiano molto più spesso dei dati identificativi:
--      tenerle in una tabella distinta riduce il churn della tabella
--      users e mantiene leggeri i log di modifica.
--   2. Sono dati non critici (nessun valore di sicurezza/privacy strutturale)
--      e possono essere reimpostati senza intaccare l'integrità del profilo.
-- =============================================================================

CREATE TABLE user_preferences (
  user_id           BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Modalità di visualizzazione della libreria sul profilo pubblico
  view_mode         VARCHAR(20) NOT NULL DEFAULT 'grid'
                    CHECK (view_mode IN ('grid','list','shelf','timeline')),

  -- Tema cromatico applicato a profilo, avatar, accenti
  theme             VARCHAR(20) NOT NULL DEFAULT 'classic'
                    CHECK (theme IN ('classic','bordeaux','sage','midnight')),

  -- Stile dell'avatar
  avatar_style      VARCHAR(20) NOT NULL DEFAULT 'initials'
                    CHECK (avatar_style IN ('initials','symbol')),
  avatar_symbol     VARCHAR(8),    -- glifo tipografico se avatar_style='symbol'

  -- Motto / citazione personale visibile in cima al profilo
  motto             VARCHAR(120),

  -- Ordinamento predefinito della libreria
  sort_by           VARCHAR(20) NOT NULL DEFAULT 'recent'
                    CHECK (sort_by IN ('recent','title','author','year')),

  -- Mostra l'email pubblicamente (override di users.email_visible)
  show_email        BOOLEAN NOT NULL DEFAULT FALSE,

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE user_preferences IS 'Preferenze estetiche e di visualizzazione del profilo utente';

CREATE TRIGGER user_preferences_update_timestamp
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();


-- ---- Tabella PROFILI DEGLI ENTI ---------------------------------------------
-- Dati specifici delle librerie-organizzazione (associazioni, biblioteche di
-- quartiere, librerie indipendenti, centri culturali, scuole).
-- Relazione 1:1 con users, popolata SOLO quando users.account_type =
-- 'organization'. Separata dalla tabella users per lo stesso principio
-- applicato a user_preferences: non appesantire users con colonne che
-- per la grande maggioranza degli account (le persone) resterebbero NULL.
-- A differenza delle persone, gli enti vogliono essere trovati: l'indirizzo
-- è un dato pubblico per definizione.
-- -----------------------------------------------------------------------------

CREATE TABLE organization_profiles (
  user_id          BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Denominazione ufficiale / ragione sociale (può differire dal display_name)
  legal_name       VARCHAR(200) NOT NULL,

  -- Categoria di ente (enum controllata)
  org_category     VARCHAR(30) NOT NULL DEFAULT 'altro'
                   CHECK (org_category IN (
                     'biblioteca', 'associazione', 'libreria_indipendente',
                     'centro_culturale', 'scuola', 'altro')),

  -- Referente: persona di riferimento dell'ente
  contact_person   VARCHAR(120),

  -- Contatti pubblici
  website          VARCHAR(300),
  public_email     VARCHAR(255),
  public_phone     VARCHAR(30),

  -- Indirizzo pubblico: per gli enti è sempre visibile (vogliono essere
  -- raggiunti). La posizione geospaziale resta in users.location.
  public_address   VARCHAR(200),

  -- Orari di apertura. TEXT in formato leggibile ("Lun–Ven 10:00–18:00…").
  -- In produzione si potrebbe strutturare come JSONB con uno schema
  -- settimanale, ma per il prototipo la forma testuale è adeguata e
  -- rispecchia come i piccoli enti comunicano davvero i propri orari.
  opening_hours    TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE organization_profiles IS 'Dati estesi delle librerie-ente (account_type = organization)';
COMMENT ON COLUMN organization_profiles.public_address IS 'Indirizzo pubblico: per gli enti è sempre visibile';

CREATE TRIGGER organization_profiles_update_timestamp
  BEFORE UPDATE ON organization_profiles
  FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

-- Indice per filtrare/raggruppare gli enti per categoria
CREATE INDEX idx_org_profiles_category ON organization_profiles (org_category);

-- Vincolo di coerenza: garantisce che organization_profiles contenga
-- solo righe il cui utente è effettivamente un'organizzazione.
-- (Implementato come trigger perché un CHECK non può interrogare un'altra tabella.)
CREATE OR REPLACE FUNCTION trg_check_account_is_org()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT account_type FROM users WHERE id = NEW.user_id) <> 'organization' THEN
    RAISE EXCEPTION 'organization_profiles richiede users.account_type = organization (user_id=%)', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organization_profiles_check_type
  BEFORE INSERT OR UPDATE ON organization_profiles
  FOR EACH ROW EXECUTE FUNCTION trg_check_account_is_org();


-- =============================================================================
-- FUNZIONI SOCIALI (v0.8): follow, like, notifiche
-- =============================================================================

-- ---- FOLLOW: un utente segue un'altra libreria (persona o ente) -------------
-- Modello "tante a tante" autoreferenziale su users. Permette di ricevere
-- aggiornamenti quando la libreria seguita pubblica nuovi volumi o aggiorna
-- le proprie informazioni.
CREATE TABLE user_follows (
  follower_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, followed_id),
  -- non ci si può seguire da soli
  CONSTRAINT chk_no_self_follow CHECK (follower_id <> followed_id)
);
COMMENT ON TABLE user_follows IS 'Relazioni di follow fra utenti/librerie (v0.8)';
CREATE INDEX idx_follows_followed ON user_follows (followed_id);   -- per contare i follower
CREATE INDEX idx_follows_follower ON user_follows (follower_id);   -- per il feed di chi seguo

-- ---- LIKE: un utente mette "mi piace" a un volume ---------------------------
-- Permette di salvare i volumi preferiti ed essere avvisati quando un titolo
-- attualmente in prestito torna disponibile.
CREATE TABLE book_likes (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, book_id)
);
COMMENT ON TABLE book_likes IS 'Volumi preferiti ("mi piace") di ciascun utente (v0.8)';
CREATE INDEX idx_likes_book ON book_likes (book_id);   -- per contare i like di un libro

-- ---- NOTIFICHE: eventi destinati a un utente --------------------------------
-- Alimentano la campanella nell'header. Generate quando una libreria seguita
-- pubblica un volume o aggiorna le info, o quando un volume con "like" torna
-- disponibile. In produzione verrebbero create da trigger/job applicativi.
CREATE TABLE notifications (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- destinatario
  type         VARCHAR(20) NOT NULL
               CHECK (type IN ('new_book', 'profile_update', 'book_available')),
  actor_id     BIGINT REFERENCES users(id) ON DELETE CASCADE,            -- chi ha generato l'evento
  book_id      BIGINT REFERENCES books(id) ON DELETE CASCADE,            -- volume coinvolto (se applicabile)
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at      TIMESTAMPTZ                                               -- NULL = non letta
);
COMMENT ON TABLE notifications IS 'Notifiche per la campanella (follow + like) (v0.8)';
-- indice parziale per recuperare velocemente le notifiche non lette di un utente
CREATE INDEX idx_notifications_unread ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);


-- =============================================================================
-- FINE SCHEMA
-- =============================================================================
