-- =============================================================================
-- PostGIS per users.location: funzione + trigger + indice GIST + backfill
-- =============================================================================
-- Fino a questa migrazione questi oggetti venivano creati da prisma/seed.mjs:
-- un database creato con le sole migrazioni (produzione) aveva la colonna
-- users.location sempre NULL e la ricerca dei libri vicini senza risultati.
--
-- Idempotente: si applica anche ai database in cui il seed li aveva gia'
-- creati.
--
-- Prerequisito: estensione postgis (creata da infra/postgres/init.sql
-- all'inizializzazione del container; serve gia' alla migrazione 0_init per
-- il tipo geography).
-- =============================================================================

-- Calcola location da lat/lng a ogni inserimento o modifica delle coordinate
CREATE OR REPLACE FUNCTION sync_user_location_from_latlng()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_user_location_trigger ON "users";
CREATE TRIGGER sync_user_location_trigger
BEFORE INSERT OR UPDATE OF lat, lng ON "users"
FOR EACH ROW EXECUTE FUNCTION sync_user_location_from_latlng();

-- Indice per ST_DWithin / ST_Distance (dichiarato anche in schema.prisma)
CREATE INDEX IF NOT EXISTS "users_location_gist" ON "users" USING GIST ("location");

-- Utenti gia' presenti con coordinate
UPDATE "users"
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL
  AND (location IS NULL OR ST_X(location::geometry) <> lng OR ST_Y(location::geometry) <> lat);
