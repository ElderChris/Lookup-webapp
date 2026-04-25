-- =============================================================================
-- Libreria Diffusa — Dati di popolamento (seed data)
-- =============================================================================
--
-- Questo script popola il database con dati di esempio coerenti con i mock
-- dati presenti nel prototipo front-end (js/app.js). È pensato per ambienti
-- di sviluppo e demo: NON contiene password reali (gli hash sono placeholder
-- bcrypt che rappresentano la password fittizia "demo1234").
--
-- Prerequisiti:
--   1. Eseguire prima schema.sql per creare la struttura.
--   2. L'estensione pgcrypto deve essere attiva (per gen_random_uuid).
--
-- Esecuzione:
--   psql -U <user> -d libreria_diffusa -f seed_data.sql
--
-- =============================================================================

BEGIN;

-- Pulizia preventiva (comoda in fase di sviluppo; commentare in produzione)
TRUNCATE TABLE view_events, loan_requests, book_images, books,
               categories, reports, users RESTART IDENTITY CASCADE;


-- =============================================================================
-- 1. CATEGORIE (tassonomia letteraria)
-- =============================================================================

INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Narrativa contemporanea', 'narrativa-contemporanea',
    'Romanzi e racconti dagli anni ''80 in poi', 1),
  ('Classici', 'classici',
    'Opere letterarie canonizzate dalla tradizione critica', 2),
  ('Poesia', 'poesia',
    'Raccolte poetiche, antologie e opere in versi', 3),
  ('Saggistica', 'saggistica',
    'Saggi, inchieste, scritti divulgativi non-fiction', 4),
  ('Storia', 'storia',
    'Studi storici, memorialistica, storia locale e globale', 5),
  ('Filosofia', 'filosofia',
    'Testi filosofici, trattati, pensiero critico', 6),
  ('Gialli e noir', 'gialli-noir',
    'Letteratura poliziesca, thriller, noir', 7),
  ('Fantascienza', 'fantascienza',
    'Science fiction, distopie, speculative fiction', 8),
  ('Biografie', 'biografie',
    'Biografie, autobiografie, memorie', 9),
  ('Arte', 'arte',
    'Libri d''arte, cataloghi, critica, storia dell''arte', 10),
  ('Teatro', 'teatro',
    'Testi teatrali, drammaturgia, studi sullo spettacolo', 11),
  ('Letteratura per ragazzi', 'letteratura-ragazzi',
    'Narrativa per infanzia e giovani adulti', 12);


-- =============================================================================
-- 2. UTENTI
-- =============================================================================
--
-- Gli hash bcrypt di esempio rappresentano la password "demo1234".
-- I consensi sono datati per coerenza con la data di iscrizione.
-- La posizione geografica è inserita come GEOGRAPHY(POINT, 4326) — WGS84.
-- =============================================================================

INSERT INTO users (
  username, email, password_hash, display_name, bio, city_label,
  location, location_precision, profile_visibility,
  consent_tos, consent_privacy, consent_newsletter,
  role, status, email_verified, created_at
) VALUES
  ('chiara.morandi', 'c.morandi@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Chiara Morandi',
    'Appassionata di letteratura italiana del Novecento e di saggistica filosofica.',
    'Napoli, Chiaia',
    ST_SetSRID(ST_MakePoint(14.2351, 40.8358), 4326)::geography,
    2, 'public',
    '2024-03-12 10:00:00+01', '2024-03-12 10:00:00+01', '2024-03-12 10:00:00+01',
    'user', 'active', TRUE, '2024-03-12 10:00:00+01'),

  ('marco.devito', 'm.devito@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Marco De Vito',
    'Collezionista di gialli e noir, con particolare attenzione agli autori scandinavi.',
    'Napoli, Vomero',
    ST_SetSRID(ST_MakePoint(14.2295, 40.8488), 4326)::geography,
    2, 'public',
    '2024-01-22 09:15:00+01', '2024-01-22 09:15:00+01', NULL,
    'user', 'active', TRUE, '2024-01-22 09:15:00+01'),

  ('anna.russo', 'a.russo@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Anna Russo',
    'Biblioteca di famiglia con edizioni ottocentesche di classici.',
    'Napoli, Posillipo',
    ST_SetSRID(ST_MakePoint(14.2055, 40.8145), 4326)::geography,
    1, 'public',  -- Anna preferisce mostrare solo la città
    '2023-11-05 18:30:00+01', '2023-11-05 18:30:00+01', '2023-11-05 18:30:00+01',
    'user', 'active', TRUE, '2023-11-05 18:30:00+01'),

  ('luca.esposito', 'l.esposito@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Luca Esposito',
    'Saggi di storia locale e tradizioni campane.',
    'Napoli, Centro Storico',
    ST_SetSRID(ST_MakePoint(14.2681, 40.8518), 4326)::geography,
    2, 'public',
    '2024-05-08 14:00:00+02', '2024-05-08 14:00:00+02', NULL,
    'user', 'active', TRUE, '2024-05-08 14:00:00+02'),

  ('giulia.ferrari', 'g.ferrari@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Giulia Ferrari',
    'Poesia contemporanea italiana e traduzioni dal tedesco.',
    'Portici',
    ST_SetSRID(ST_MakePoint(14.3417, 40.8147), 4326)::geography,
    2, 'public',
    '2024-02-18 11:45:00+01', '2024-02-18 11:45:00+01', '2024-02-18 11:45:00+01',
    'user', 'active', TRUE, '2024-02-18 11:45:00+01'),

  ('roberto.mazzone', 'r.mazzone@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Roberto Mazzone',
    'Fantascienza classica e distopie.',
    'Pozzuoli',
    ST_SetSRID(ST_MakePoint(14.1204, 40.8240), 4326)::geography,
    3, 'public',  -- Roberto accetta la posizione precisa
    '2024-04-01 16:20:00+02', '2024-04-01 16:20:00+02', NULL,
    'user', 'active', TRUE, '2024-04-01 16:20:00+02'),

  -- Account amministratore per la dashboard di moderazione
  ('admin', 'admin@libreriadiffusa.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Amministratore',
    'Account di sistema per la moderazione della piattaforma.',
    'Napoli',
    ST_SetSRID(ST_MakePoint(14.2681, 40.8518), 4326)::geography,
    0, 'private',
    '2023-09-01 00:00:00+02', '2023-09-01 00:00:00+02', NULL,
    'admin', 'active', TRUE, '2023-09-01 00:00:00+02');


-- =============================================================================
-- 3. LIBRI
-- =============================================================================
--
-- Ogni libro è legato al proprietario (users.id) e alla categoria (categories.id)
-- tramite JOIN ON name per mantenere lo script leggibile e indipendente dagli
-- ID assegnati dalle sequenze (che, dopo TRUNCATE ... RESTART IDENTITY,
-- partono comunque da 1).
-- =============================================================================

INSERT INTO books (
  owner_id, category_id, title, author, year, language, isbn,
  pages, description, condition, available,
  view_count, request_count, status, created_at
)
SELECT
  u.id, c.id, v.title, v.author, v.year, 'Italiano', v.isbn,
  v.pages, v.description, v.condition, v.available,
  v.view_count, v.request_count, 'active', v.created_at::timestamptz
FROM (VALUES
  ('chiara.morandi', 'Classici',
    'Se questo è un uomo', 'Primo Levi', 1947, '9788806217778', 216,
    'Testimonianza della prigionia di Primo Levi ad Auschwitz. Una delle opere fondamentali della letteratura del Novecento italiano.',
    'buone condizioni', TRUE, 342, 12, '2024-03-15 10:30:00+01'),

  ('chiara.morandi', 'Narrativa contemporanea',
    'Le città invisibili', 'Italo Calvino', 1972, '9788804668237', 173,
    'Dialogo immaginario tra Marco Polo e Kublai Khan sulle città visitate dal mercante veneziano, metafore delle città della memoria, del desiderio, dei segni.',
    'ottime condizioni', TRUE, 278, 8, '2024-03-20 15:45:00+01'),

  ('marco.devito', 'Gialli e noir',
    'Uomini che odiano le donne', 'Stieg Larsson', 2005, '9788831714082', 678,
    'Primo capitolo della trilogia Millennium. Un giornalista investigativo e una hacker indagano su un caso di scomparsa irrisolto da quarant''anni.',
    'buone condizioni', TRUE, 189, 5, '2024-02-10 09:00:00+01'),

  ('anna.russo', 'Classici',
    'Il nome della rosa', 'Umberto Eco', 1980, '9788845292613', 512,
    'Romanzo storico ambientato in un''abbazia benedettina del XIV secolo. Un maestro francescano indaga su una serie di morti misteriose.',
    'ottime condizioni', FALSE, 456, 18, '2024-01-08 11:00:00+01'),

  ('anna.russo', 'Poesia',
    'Canti', 'Giacomo Leopardi', 1835, '9788807900587', 280,
    'Raccolta completa dei componimenti poetici di Leopardi. Edizione ottocentesca con note critiche originali.',
    'come nuovo', TRUE, 512, 3, '2023-12-15 14:20:00+01'),

  ('luca.esposito', 'Storia',
    'Storia di Napoli', 'Benedetto Croce', 1925, '9788843057047', 720,
    'Opera monumentale di Croce sulla storia della città di Napoli dall''antichità fino al Risorgimento.',
    'buone condizioni', TRUE, 298, 9, '2024-05-12 17:10:00+02'),

  ('giulia.ferrari', 'Classici',
    'La coscienza di Zeno', 'Italo Svevo', 1923, '9788858410356', 480,
    'Memoriale autobiografico di Zeno Cosini, scritto per il suo psicoanalista. Capolavoro del romanzo italiano del Novecento.',
    'ottime condizioni', TRUE, 234, 6, '2024-02-22 19:30:00+01'),

  ('roberto.mazzone', 'Fantascienza',
    'Dune', 'Frank Herbert', 1965, '9788834727607', 820,
    'Epopea fantascientifica ambientata sul pianeta desertico Arrakis. Considerato uno dei capolavori assoluti della SF.',
    'buone condizioni', TRUE, 412, 15, '2024-04-05 13:00:00+02'),

  ('giulia.ferrari', 'Narrativa contemporanea',
    'L''amica geniale', 'Elena Ferrante', 2011, '9788866324119', 400,
    'Primo volume della quadrilogia napoletana. L''amicizia tra Lila ed Elena in un rione di Napoli degli anni ''50.',
    'come nuovo', TRUE, 389, 22, '2024-03-28 10:15:00+01'),

  ('chiara.morandi', 'Saggistica',
    'Il sistema periodico', 'Primo Levi', 1975, '9788806174149', 240,
    'Autobiografia strutturata sugli elementi chimici. Un dialogo tra la vita e la scienza.',
    'ottime condizioni', TRUE, 156, 4, '2024-04-18 16:40:00+02'),

  ('luca.esposito', 'Saggistica',
    'Gomorra', 'Roberto Saviano', 2006, '9788804627005', 331,
    'Inchiesta sulla camorra campana. Un viaggio nelle dinamiche del potere criminale contemporaneo.',
    'buone condizioni', TRUE, 267, 7, '2024-05-20 12:25:00+02'),

  ('roberto.mazzone', 'Fantascienza',
    'Neuromante', 'William Gibson', 1984, '9788834715567', 288,
    'Romanzo seminale del cyberpunk. La storia di Case, hacker-mercenario, in un futuro distopico dominato dalle corporazioni.',
    'discrete', TRUE, 178, 5, '2024-05-28 20:00:00+02')
) AS v(
  owner_username, category_name, title, author, year, isbn, pages,
  description, condition, available, view_count, request_count, created_at
)
JOIN users u       ON u.username = v.owner_username
JOIN categories c  ON c.name     = v.category_name;


-- =============================================================================
-- 4. IMMAGINI (record placeholder — in produzione popolati dall'upload)
-- =============================================================================
-- Inseriamo una sola riga "thumb" placeholder per ciascun libro; in produzione
-- il pipeline di upload (Sharp/ImageMagick) crea original/large/medium/thumb.
-- =============================================================================

INSERT INTO book_images (book_id, variant, url, width, height, mime_type, is_primary)
SELECT
  b.id,
  'thumb',
  '/assets/covers/placeholder-' || b.id || '.webp',
  160, 240, 'image/webp', TRUE
FROM books b;


-- =============================================================================
-- 5. RICHIESTE DI PRESTITO (esempi)
-- =============================================================================

INSERT INTO loan_requests (book_id, requester_id, owner_id, message, status, requested_at, responded_at)
SELECT
  b.id,
  req.id,
  own.id,
  v.message,
  v.status,
  v.requested_at::timestamptz,
  v.responded_at::timestamptz
FROM (VALUES
  ('Il nome della rosa', 'marco.devito', 'anna.russo',
    'Buongiorno Anna, sarei molto interessato a consultare la sua edizione del 1980. Sono disponibile per un incontro in settimana.',
    'accepted', '2024-06-02 10:00:00+02', '2024-06-02 18:30:00+02'),

  ('L''amica geniale', 'chiara.morandi', 'giulia.ferrari',
    'Ciao Giulia, sto preparando un ciclo di letture sulla Ferrante. Potrei averlo in prestito per due settimane?',
    'pending', '2024-06-15 14:20:00+02', NULL),

  ('Dune', 'luca.esposito', 'roberto.mazzone',
    'Salve Roberto, non l''ho mai letto e sono molto curioso. Grazie!',
    'accepted', '2024-05-30 20:15:00+02', '2024-05-31 09:00:00+02'),

  ('Se questo è un uomo', 'anna.russo', 'chiara.morandi',
    'Buonasera, per un gruppo di lettura. Grazie in anticipo.',
    'completed', '2024-04-10 11:00:00+02', '2024-04-10 15:30:00+02'),

  ('Gomorra', 'giulia.ferrari', 'luca.esposito',
    'Ciao Luca, lo sto cercando da tempo. Disponibile per ritiro a Portici o centro.',
    'pending', '2024-06-20 09:45:00+02', NULL),

  ('Canti', 'giulia.ferrari', 'anna.russo',
    'Gentile Anna, sarei onorata di poter consultare l''edizione ottocentesca, anche solo in loco se preferisce.',
    'accepted', '2024-06-08 16:00:00+02', '2024-06-09 10:15:00+02')
) AS v(book_title, requester_username, owner_username, message, status, requested_at, responded_at)
JOIN books b  ON b.title     = v.book_title
JOIN users req ON req.username = v.requester_username
JOIN users own ON own.username = v.owner_username;


-- =============================================================================
-- 6. EVENTI DI VISUALIZZAZIONE (log anonimizzati, estratto significativo)
-- =============================================================================
-- In produzione, questi record crescono molto rapidamente; qui ne inseriamo
-- un piccolo campione per popolare le statistiche della dashboard.
-- =============================================================================

INSERT INTO view_events (book_id, user_id, session_id, viewed_at)
SELECT
  b.id,
  CASE WHEN random() < 0.6 THEN (SELECT id FROM users ORDER BY random() LIMIT 1) ELSE NULL END,
  md5(random()::text),
  CURRENT_TIMESTAMP - (random() * INTERVAL '180 days')
FROM books b, generate_series(1, 15);  -- 15 eventi per libro = 180 totali


COMMIT;


-- =============================================================================
-- Verifica rapida
-- =============================================================================
-- Esegui queste query dopo il seed per controllare il popolamento:
--
--   SELECT COUNT(*) FROM users;             -- attesi: 7
--   SELECT COUNT(*) FROM categories;        -- attesi: 12
--   SELECT COUNT(*) FROM books;             -- attesi: 12
--   SELECT COUNT(*) FROM loan_requests;     -- attesi: 6
--   SELECT COUNT(*) FROM view_events;       -- attesi: 180
--
--   -- Test della ricerca spaziale: libri entro 3 km da Piazza del Plebiscito
--   SELECT * FROM find_books_within(40.8358, 14.2488, 3000);
--
-- =============================================================================
