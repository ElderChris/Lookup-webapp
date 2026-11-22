-- Generi dei libri: tassonomia completa (macro-aree e sottogeneri della
-- versione prototipo). Idempotente: aggiunge solo i generi mancanti, per slug.
-- Stessi dati di prisma/taxonomy.mjs (usato dal seed).

-- Macro-aree
INSERT INTO "categories" ("name", "slug", "bisac_code", "sort_order", "parent_id") VALUES
  ('Biografie', 'biografie', 'BIO000000', 5, NULL),
  ('Teatro', 'teatro', 'DRA000000', 6, NULL),
  ('Arte e fotografia', 'arte-e-fotografia', 'ART000000', 7, NULL),
  ('Fumetti e graphic novel', 'fumetti-e-graphic-novel', 'CGN000000', 8, NULL),
  ('Cucina e casa', 'cucina-e-casa', NULL, 9, NULL),
  ('Viaggi', 'viaggi', 'TRV000000', 10, NULL),
  ('Salute e benessere', 'salute-e-benessere', 'HEA000000', 11, NULL)
ON CONFLICT ("slug") DO NOTHING;

-- Sottogeneri (genitore per slug)
INSERT INTO "categories" ("name", "slug", "bisac_code", "sort_order", "parent_id")
SELECT v.name, v.slug, v.bisac_code, v.sort_order, p.id
FROM (VALUES
  ('Narrativa contemporanea', 'narrativa-contemporanea', NULL, 6, 'narrativa'),
  ('Narrativa letteraria', 'narrativa-letteraria', NULL, 7, 'narrativa'),
  ('Narrativa storica', 'narrativa-storica', 'FIC014000', 8, 'narrativa'),
  ('Thriller', 'thriller', 'FIC031000', 9, 'narrativa'),
  ('Fantasy', 'fantasy', 'FIC009000', 10, 'narrativa'),
  ('Romanzo rosa', 'romanzo-rosa', 'FIC027000', 11, 'narrativa'),
  ('Avventura', 'avventura', 'FIC002000', 12, 'narrativa'),
  ('Racconti', 'racconti', 'FIC029000', 13, 'narrativa'),
  ('Distopia', 'distopia', NULL, 14, 'narrativa'),
  ('Romanzo di formazione', 'romanzo-di-formazione', NULL, 15, 'narrativa'),
  ('Satira e umorismo', 'satira-e-umorismo', 'FIC016000', 16, 'narrativa'),
  ('Saggistica generale', 'saggistica-generale', NULL, 5, 'saggistica'),
  ('Economia', 'economia', 'BUS069000', 6, 'saggistica'),
  ('Sociologia', 'sociologia', 'SOC000000', 7, 'saggistica'),
  ('Antropologia', 'antropologia', 'SOC002000', 8, 'saggistica'),
  ('Scienze', 'scienze', 'SCI000000', 9, 'saggistica'),
  ('Tecnologia', 'tecnologia', 'TEC000000', 10, 'saggistica'),
  ('Critica letteraria', 'critica-letteraria', 'LIT000000', 11, 'saggistica'),
  ('Religione e spiritualità', 'religione-e-spiritualita', 'REL000000', 12, 'saggistica'),
  ('Psicologia', 'psicologia', 'PSY000000', 13, 'saggistica'),
  ('Educazione', 'educazione', 'EDU000000', 14, 'saggistica'),
  ('Biografie storiche', 'biografie-storiche', NULL, 1, 'biografie'),
  ('Autobiografie', 'autobiografie', NULL, 2, 'biografie'),
  ('Memorie', 'memorie', 'BIO026000', 3, 'biografie'),
  ('Personaggi politici', 'personaggi-politici', NULL, 4, 'biografie'),
  ('Artisti e scrittori', 'artisti-e-scrittori', NULL, 5, 'biografie'),
  ('Sportivi e musicisti', 'sportivi-e-musicisti', NULL, 6, 'biografie'),
  ('Poesia contemporanea', 'poesia-contemporanea', NULL, 3, 'poesia'),
  ('Poesia classica', 'poesia-classica', NULL, 4, 'poesia'),
  ('Teatro classico', 'teatro-classico', NULL, 1, 'teatro'),
  ('Teatro contemporaneo', 'teatro-contemporaneo', NULL, 2, 'teatro'),
  ('Sceneggiature', 'sceneggiature', NULL, 3, 'teatro'),
  ('Pittura', 'pittura', NULL, 1, 'arte-e-fotografia'),
  ('Scultura', 'scultura', NULL, 2, 'arte-e-fotografia'),
  ('Architettura', 'architettura', 'ARC000000', 3, 'arte-e-fotografia'),
  ('Fotografia', 'fotografia', 'PHO000000', 4, 'arte-e-fotografia'),
  ('Design', 'design', 'DES000000', 5, 'arte-e-fotografia'),
  ('Storia dell''arte', 'storia-dell-arte', 'ART015000', 6, 'arte-e-fotografia'),
  ('Cataloghi di mostre', 'cataloghi-di-mostre', NULL, 7, 'arte-e-fotografia'),
  ('Graphic novel', 'graphic-novel', NULL, 1, 'fumetti-e-graphic-novel'),
  ('Manga', 'manga', NULL, 2, 'fumetti-e-graphic-novel'),
  ('Fumetto franco-belga', 'fumetto-franco-belga', NULL, 3, 'fumetti-e-graphic-novel'),
  ('Fumetto italiano', 'fumetto-italiano', NULL, 4, 'fumetti-e-graphic-novel'),
  ('Supereroi', 'supereroi', NULL, 5, 'fumetti-e-graphic-novel'),
  ('Albi illustrati', 'albi-illustrati', NULL, 1, 'ragazzi'),
  ('Narrativa per ragazzi', 'narrativa-per-ragazzi', NULL, 2, 'ragazzi'),
  ('Young adult', 'young-adult', 'YAF000000', 3, 'ragazzi'),
  ('Educativi per bambini', 'educativi-per-bambini', NULL, 4, 'ragazzi'),
  ('Cucina', 'cucina', 'CKB000000', 1, 'cucina-e-casa'),
  ('Giardinaggio', 'giardinaggio', 'GAR000000', 2, 'cucina-e-casa'),
  ('Fai-da-te', 'fai-da-te', NULL, 3, 'cucina-e-casa'),
  ('Decorazione d''interni', 'decorazione-d-interni', NULL, 4, 'cucina-e-casa'),
  ('Guide di viaggio', 'guide-di-viaggio', NULL, 1, 'viaggi'),
  ('Letteratura di viaggio', 'letteratura-di-viaggio', NULL, 2, 'viaggi'),
  ('Diari di viaggio', 'diari-di-viaggio', NULL, 3, 'viaggi'),
  ('Salute', 'salute', NULL, 1, 'salute-e-benessere'),
  ('Alimentazione', 'alimentazione', NULL, 2, 'salute-e-benessere'),
  ('Sport e fitness', 'sport-e-fitness', NULL, 3, 'salute-e-benessere'),
  ('Mindfulness', 'mindfulness', NULL, 4, 'salute-e-benessere')
) AS v(name, slug, bisac_code, sort_order, parent_slug)
JOIN "categories" p ON p.slug = v.parent_slug
ON CONFLICT ("slug") DO NOTHING;
