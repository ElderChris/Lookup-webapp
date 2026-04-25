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
-- FINE SCHEMA
-- =============================================================================
