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
               organization_profiles, user_preferences, categories,
               reports, users RESTART IDENTITY CASCADE;


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
  account_type, location, location_precision, profile_visibility,
  email_visible, consent_tos, consent_privacy, consent_newsletter,
  role, status, email_verified, created_at
) VALUES
  ('chiara.morandi', 'c.morandi@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Chiara Morandi',
    'Appassionata di letteratura italiana del Novecento e di saggistica filosofica.',
    'Napoli, Chiaia', 'person',
    ST_SetSRID(ST_MakePoint(14.2351, 40.8358), 4326)::geography,
    2, 'public', FALSE,
    '2024-03-12 10:00:00+01', '2024-03-12 10:00:00+01', '2024-03-12 10:00:00+01',
    'user', 'active', TRUE, '2024-03-12 10:00:00+01'),

  ('marco.devito', 'm.devito@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Marco De Vito',
    'Collezionista di gialli e noir, con particolare attenzione agli autori scandinavi.',
    'Napoli, Vomero', 'person',
    ST_SetSRID(ST_MakePoint(14.2295, 40.8488), 4326)::geography,
    2, 'public', FALSE,
    '2024-01-22 09:15:00+01', '2024-01-22 09:15:00+01', NULL,
    'user', 'active', TRUE, '2024-01-22 09:15:00+01'),

  ('anna.russo', 'a.russo@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Anna Russo',
    'Biblioteca di famiglia con edizioni ottocentesche di classici.',
    'Napoli, Posillipo', 'person',
    ST_SetSRID(ST_MakePoint(14.2055, 40.8145), 4326)::geography,
    1, 'public', FALSE,  -- Anna preferisce mostrare solo la città
    '2023-11-05 18:30:00+01', '2023-11-05 18:30:00+01', '2023-11-05 18:30:00+01',
    'user', 'active', TRUE, '2023-11-05 18:30:00+01'),

  ('luca.esposito', 'l.esposito@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Luca Esposito',
    'Saggi di storia locale e tradizioni campane.',
    'Napoli, Centro Storico', 'person',
    ST_SetSRID(ST_MakePoint(14.2681, 40.8518), 4326)::geography,
    2, 'public', FALSE,
    '2024-05-08 14:00:00+02', '2024-05-08 14:00:00+02', NULL,
    'user', 'active', TRUE, '2024-05-08 14:00:00+02'),

  ('giulia.ferrari', 'g.ferrari@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Giulia Ferrari',
    'Poesia contemporanea italiana e traduzioni dal tedesco.',
    'Portici', 'person',
    ST_SetSRID(ST_MakePoint(14.3417, 40.8147), 4326)::geography,
    2, 'public', FALSE,
    '2024-02-18 11:45:00+01', '2024-02-18 11:45:00+01', '2024-02-18 11:45:00+01',
    'user', 'active', TRUE, '2024-02-18 11:45:00+01'),

  ('roberto.mazzone', 'r.mazzone@mail.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Roberto Mazzone',
    'Fantascienza classica e distopie.',
    'Pozzuoli', 'person',
    ST_SetSRID(ST_MakePoint(14.1204, 40.8240), 4326)::geography,
    3, 'public', FALSE,  -- Roberto accetta la posizione precisa
    '2024-04-01 16:20:00+02', '2024-04-01 16:20:00+02', NULL,
    'user', 'active', TRUE, '2024-04-01 16:20:00+02'),

  -- Librerie-ente: account di tipo 'organization'. L'indirizzo è
  -- pubblico (location_precision = 3) e l'email è visibile: gli enti
  -- vogliono essere trovati e contattati.
  ('biblioteca.sanita', 'info@bibliosanita.org',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Biblioteca di Comunità Rione Sanità',
    'Biblioteca di comunità nata dal basso: un presidio culturale aperto nel cuore del Rione Sanità, con un fondo dedicato alla storia e alle voci del quartiere.',
    'Napoli, Rione Sanità', 'organization',
    ST_SetSRID(ST_MakePoint(14.2515, 40.8585), 4326)::geography,
    3, 'public', TRUE,
    '2023-09-20 09:00:00+02', '2023-09-20 09:00:00+02', '2023-09-20 09:00:00+02',
    'user', 'active', TRUE, '2023-09-20 09:00:00+02'),

  ('lettori.erranti', 'contatti@lettorierranti.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Associazione I Lettori Erranti',
    'Associazione culturale che promuove la lettura condivisa attraverso circoli, presentazioni e una biblioteca circolante di narrativa e saggistica contemporanea.',
    'Napoli, Fuorigrotta', 'organization',
    ST_SetSRID(ST_MakePoint(14.1920, 40.8270), 4326)::geography,
    3, 'public', TRUE,
    '2024-01-10 10:00:00+01', '2024-01-10 10:00:00+01', NULL,
    'user', 'active', TRUE, '2024-01-10 10:00:00+01'),

  -- Account amministratore per la dashboard di moderazione
  ('admin', 'admin@libreriadiffusa.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Amministratore',
    'Account di sistema per la moderazione della piattaforma.',
    'Napoli', 'person',
    ST_SetSRID(ST_MakePoint(14.2681, 40.8518), 4326)::geography,
    0, 'private', FALSE,
    '2023-09-01 00:00:00+02', '2023-09-01 00:00:00+02', NULL,
    'admin', 'active', TRUE, '2023-09-01 00:00:00+02');


-- =============================================================================
-- 2-bis. PROFILI DEGLI ENTI
-- =============================================================================
-- Dati estesi delle due librerie-organizzazione. Collegati a users tramite
-- JOIN ON username per restare indipendenti dagli ID di sequenza.
-- =============================================================================

INSERT INTO organization_profiles (
  user_id, legal_name, org_category, contact_person,
  website, public_email, public_phone, public_address, opening_hours
)
SELECT u.id, v.legal_name, v.org_category, v.contact_person,
       v.website, v.public_email, v.public_phone, v.public_address, v.opening_hours
FROM (VALUES
  ('biblioteca.sanita',
    'Associazione Biblioteca di Comunità Rione Sanità APS',
    'biblioteca',
    'Dott.ssa Federica Improta',
    'https://www.bibliosanita.org',
    'info@bibliosanita.org',
    '+39 081 555 0142',
    'Via della Sanità 124, 80136 Napoli',
    'Lun–Ven 10:00–13:00 e 15:00–19:00 · Sab 10:00–13:00 · Dom chiuso'),

  ('lettori.erranti',
    'I Lettori Erranti — Associazione di Promozione Sociale',
    'associazione',
    'Salvatore Acanfora',
    'https://www.lettorierranti.it',
    'contatti@lettorierranti.it',
    '+39 081 555 0987',
    'Piazzale Tecchio 8, 80125 Napoli',
    'Mar e Gio 16:00–20:00 · Sab 10:00–18:00 · prestito su appuntamento')
) AS v(username, legal_name, org_category, contact_person,
       website, public_email, public_phone, public_address, opening_hours)
JOIN users u ON u.username = v.username;


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
    'discrete', TRUE, 178, 5, '2024-05-28 20:00:00+02'),

  -- Volumi delle librerie-ente
  ('biblioteca.sanita', 'Classici',
    'La pelle', 'Curzio Malaparte', 1949, '9788845292378', 360,
    'Romanzo crudo e visionario su Napoli durante la Seconda guerra mondiale, tra le rovine e la sopravvivenza.',
    'buone condizioni', TRUE, 198, 6, '2024-06-10 11:00:00+02'),

  ('biblioteca.sanita', 'Saggistica',
    'Il ventre di Napoli', 'Matilde Serao', 1884, '9788877104983', 180,
    'Inchiesta giornalistica sulle condizioni dei quartieri popolari napoletani di fine Ottocento.',
    'discrete', TRUE, 156, 4, '2024-04-22 10:30:00+02'),

  ('biblioteca.sanita', 'Narrativa contemporanea',
    'Montedidio', 'Erri De Luca', 2001, '9788807813764', 180,
    'Un ragazzo, una lingua che si fa adulta e un quartiere di Napoli che diventa mondo.',
    'come nuovo', FALSE, 134, 3, '2024-05-30 09:15:00+02'),

  ('lettori.erranti', 'Narrativa contemporanea',
    'Le otto montagne', 'Paolo Cognetti', 2016, '9788806232801', 199,
    'L''amicizia tra due uomini e il loro rapporto con la montagna, lungo l''arco di una vita.',
    'ottime condizioni', TRUE, 221, 9, '2024-06-05 14:00:00+02'),

  ('lettori.erranti', 'Classici',
    'La Storia', 'Elsa Morante', 1974, '9788806219660', 656,
    'Un grande romanzo corale sulla Seconda guerra mondiale vista dagli ultimi.',
    'buone condizioni', TRUE, 187, 7, '2024-03-18 16:00:00+01'),

  ('lettori.erranti', 'Classici',
    'Il barone rampante', 'Italo Calvino', 1957, '9788804668374', 264,
    'Cosimo decide di vivere sugli alberi e non scenderne mai più: una favola sulla libertà.',
    'buone condizioni', TRUE, 165, 5, '2024-05-12 11:30:00+02')
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


-- =============================================================================
-- 7. PREFERENZE DI PERSONALIZZAZIONE (v0.2)
-- =============================================================================
-- Inseriamo preferenze di esempio per gli utenti, scegliendo modalità di
-- visualizzazione e temi diversi per illustrare la varietà offerta dalla
-- piattaforma. Gli utenti senza riga in user_preferences ricadranno sui
-- valori di default definiti nello schema.
-- =============================================================================

INSERT INTO user_preferences (user_id, view_mode, theme, avatar_style, avatar_symbol, motto, sort_by, show_email)
SELECT u.id, v.view_mode, v.theme, v.avatar_style, v.avatar_symbol, v.motto, v.sort_by, v.show_email
FROM (VALUES
  ('chiara.morandi',  'grid',     'classic',  'initials', NULL, 'Un libro è un sogno che tieni in mano', 'recent', FALSE),
  ('marco.devito',    'shelf',    'midnight', 'symbol',   '§',  'Il delitto perfetto è ancora da scrivere', 'author', FALSE),
  ('anna.russo',      'timeline', 'bordeaux', 'initials', NULL, 'Le edizioni antiche meritano rispetto', 'year', FALSE),
  ('luca.esposito',   'list',     'sage',     'symbol',   '❦',  'La storia di Napoli scritta dai suoi libri', 'title', FALSE),
  ('giulia.ferrari',  'grid',     'sage',     'symbol',   '❧',  'Tradurre è abitare due lingue', 'recent', FALSE),
  ('roberto.mazzone', 'shelf',    'midnight', 'symbol',   '✦',  'Il futuro lo immaginiamo prima di costruirlo', 'year', FALSE),
  -- Le librerie-ente mostrano l'email pubblicamente: vogliono essere contattate
  ('biblioteca.sanita', 'list',   'bordeaux', 'symbol',   '❦',  'La cultura è un bene comune', 'title', TRUE),
  ('lettori.erranti',   'grid',   'classic',  'symbol',   '❧',  'Leggere insieme, camminare lontano', 'recent', TRUE)
) AS v(username, view_mode, theme, avatar_style, avatar_symbol, motto, sort_by, show_email)
JOIN users u ON u.username = v.username;


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
--   SELECT COUNT(*) FROM user_preferences;  -- attesi: 6
--
--   -- Test della ricerca spaziale: libri entro 3 km da Piazza del Plebiscito
--   SELECT * FROM find_books_within(40.8358, 14.2488, 3000);
--
-- =============================================================================
