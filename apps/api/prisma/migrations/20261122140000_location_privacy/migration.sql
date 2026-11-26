-- =============================================================================
-- Privacy della posizione
-- =============================================================================
-- location_precision: 0 nascosta, 1 citta', 2 zona (~200 m), 3 esatta.
-- public_city / public_lat / public_lng / public_location: cio' che vedono
-- gli altri utenti, calcolato dal trigger a ogni modifica. Le risposte
-- pubbliche e le ricerche per distanza usano solo queste colonne.
-- =============================================================================

ALTER TABLE "users"
  ADD COLUMN "location_precision" SMALLINT,
  ADD COLUMN "public_city" VARCHAR(150),
  ADD COLUMN "public_lat" DOUBLE PRECISION,
  ADD COLUMN "public_lng" DOUBLE PRECISION,
  ADD COLUMN "public_location" geography(Point, 4326);

-- Stessa funzione del trigger esistente, estesa ai campi pubblici
CREATE OR REPLACE FUNCTION sync_user_location_from_latlng()
RETURNS TRIGGER AS $$
DECLARE
  step_lng DOUBLE PRECISION;
BEGIN
  -- Predefinito: persone "zona", enti "esatta" (luoghi pubblici)
  IF NEW.location_precision IS NULL THEN
    NEW.location_precision := CASE WHEN NEW.account_type = 'organization' THEN 3 ELSE 2 END;
  END IF;

  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;

  -- Citta' visibile agli altri salvo posizione nascosta
  NEW.public_city := CASE WHEN NEW.location_precision = 0 THEN NULL ELSE NEW.city END;

  IF NEW.location IS NULL OR NEW.location_precision < 2 THEN
    NEW.public_lat := NULL;
    NEW.public_lng := NULL;
  ELSIF NEW.location_precision = 2 THEN
    -- Zona: centro di una cella di circa 220 m di lato (0,002 gradi di
    -- latitudine; in longitudine lo stesso passo in metri). Punto fisso per
    -- cella: richieste ripetute non permettono di ricostruire la posizione.
    NEW.public_lat := (floor(NEW.lat / 0.002) + 0.5) * 0.002;
    step_lng := 0.002 / GREATEST(cos(radians(NEW.public_lat)), 0.01);
    NEW.public_lng := LEAST(180, GREATEST(-180, (floor(NEW.lng / step_lng) + 0.5) * step_lng));
  ELSE
    NEW.public_lat := NEW.lat;
    NEW.public_lng := NEW.lng;
  END IF;

  IF NEW.public_lat IS NULL THEN
    NEW.public_location := NULL;
  ELSE
    NEW.public_location := ST_SetSRID(ST_MakePoint(NEW.public_lng, NEW.public_lat), 4326)::geography;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_user_location_trigger ON "users";
CREATE TRIGGER sync_user_location_trigger
BEFORE INSERT OR UPDATE OF lat, lng, city, account_type, location_precision ON "users"
FOR EACH ROW EXECUTE FUNCTION sync_user_location_from_latlng();

CREATE INDEX IF NOT EXISTS "users_public_location_gist" ON "users" USING GIST ("public_location");

-- Utenti esistenti: il trigger assegna il predefinito e calcola i campi pubblici
UPDATE "users" SET "location_precision" = NULL;
