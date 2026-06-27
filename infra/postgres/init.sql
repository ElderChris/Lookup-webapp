-- =============================================================================
-- init.sql — Inizializzazione database Lookup
-- =============================================================================
-- Eseguito automaticamente al primo avvio del container postgres tramite
-- volume mount su /docker-entrypoint-initdb.d/. Non viene rieseguito sui
-- restart successivi (Postgres riconosce che il DB è già inizializzato).
--
-- Le tabelle vere arrivano via Prisma migration in Fase 1b. Qui prepariamo
-- solo le extension che serviranno (PostGIS per geo, pg_trgm per ricerca
-- testuale fuzzy nei titoli dei libri).
-- =============================================================================

-- PostGIS: tipi geometrici + funzioni spaziali (ST_DistanceSphere, etc.)
-- Necessario per il calcolo "librerie vicino a te" senza haversine manuale.
CREATE EXTENSION IF NOT EXISTS postgis;

-- pg_trgm: trigram similarity per ricerca fuzzy.
-- Utile per "trova libri con titolo simile a 'gomora'" che ritorni 'Gomorra'.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- citext: case-insensitive text (per username, email).
-- Evita di dover fare LOWER() ovunque negli indici unici.
CREATE EXTENSION IF NOT EXISTS citext;

-- Verifica al log: stampa le versioni installate
DO $$
BEGIN
    RAISE NOTICE 'PostGIS:  %', (SELECT PostGIS_Version());
    RAISE NOTICE 'pg_trgm:  installato';
    RAISE NOTICE 'citext:   installato';
END $$;
