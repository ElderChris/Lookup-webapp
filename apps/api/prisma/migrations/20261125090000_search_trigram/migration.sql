-- Ricerca dei volumi tollerante agli errori di battitura (word_similarity).
-- L'estensione e' gia' creata da infra/postgres/init.sql al primo avvio del
-- container; qui per le installazioni con un database preparato a mano.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
