-- =============================================================================
-- Lookup — Dati di popolamento (seed data)
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
--   psql -U <user> -d lookup -f seed_data.sql
--
-- =============================================================================

BEGIN;

-- Pulizia preventiva (comoda in fase di sviluppo; commentare in produzione)
TRUNCATE TABLE view_events, loan_requests, book_images, books,
               notifications, book_likes, user_follows, book_categories,
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

-- ---- v1.0: sotto-categorie BISAC referenziate dai nuovi libri.
-- Vengono inserite separatamente per poter agganciarle al parent
-- tramite UPDATE successivo (richiede gli id già assegnati).
INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Teatro contemporaneo',  'teatro-contemporaneo',  'Drammaturgia dal Novecento ad oggi',  20),
  ('Poesia italiana',       'poesia-italiana',       'Versi della tradizione poetica italiana', 21),
  ('Narrativa storica',     'narrativa-storica',     'Romanzi ambientati in epoche storiche', 22),
  ('Racconti',              'racconti',              'Forme brevi della narrativa', 23),
  ('Biografie storiche',    'biografie-storiche',    'Vite di personaggi storici', 24),
  ('Saggistica generale',   'saggistica-generale',   'Saggi non-fiction generalisti', 25),
  ('Letteratura di viaggio','letteratura-viaggio',   'Reportage e narrativa di viaggio', 26),
  ('Antropologia',          'antropologia',          'Studi di antropologia culturale', 27),
  ('Diari di viaggio',      'diari-viaggio',         'Diari personali e taccuini di viaggio', 28),
  ('Sociologia',            'sociologia',            'Studi sociologici e culturali', 29);

-- ---- Linka le sotto-categorie alle macro-aree BISAC corrispondenti.
UPDATE categories c SET parent_id = m.id
FROM (VALUES
  ('Teatro contemporaneo',  'Teatro'),
  ('Poesia italiana',       'Poesia'),
  ('Narrativa storica',     'Narrativa contemporanea'),    -- macro narrativa più vicina
  ('Racconti',              'Narrativa contemporanea'),
  ('Biografie storiche',    'Biografie'),
  ('Saggistica generale',   'Saggistica'),
  ('Letteratura di viaggio','Saggistica'),
  ('Antropologia',          'Saggistica'),
  ('Diari di viaggio',      'Saggistica'),
  ('Sociologia',            'Saggistica')
) AS rel(child, parent)
JOIN categories m ON m.name = rel.parent
WHERE c.name = rel.child;


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

  -- v1.0: due nuovi enti per arricchire la sezione "Librerie vicine" della homepage
  ('libreria.spaccanapoli', 'ciao@libreriaspaccanapoli.it',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Libreria Indipendente Spaccanapoli',
    'Libreria indipendente del centro storico, specializzata in editoria meridionale, poesia e piccoli editori. Mette in prestito una selezione del proprio fondo storico.',
    'Napoli, Spaccanapoli', 'organization',
    ST_SetSRID(ST_MakePoint(14.2570, 40.8497), 4326)::geography,
    3, 'public', TRUE,
    '2023-06-14 09:00:00+02', '2023-06-14 09:00:00+02', NULL,
    'user', 'active', TRUE, '2023-06-14 09:00:00+02'),

  ('centro.mezzogiorno', 'info@centromezzogiorno.org',
    '$2b$12$PlAcEhOlDeRhAsHbCrYpTfOrDeMoPuRpOsEsOnLyXxXxXxXxXxXxX',
    'Centro Culturale Mezzogiorno',
    'Centro culturale di quartiere con sala lettura, gruppi di studio sulla storia del Mezzogiorno e una biblioteca tematica aperta ai soci e al pubblico.',
    'Napoli, Vomero', 'organization',
    ST_SetSRID(ST_MakePoint(14.2270, 40.8438), 4326)::geography,
    3, 'public', TRUE,
    '2024-02-28 09:00:00+01', '2024-02-28 09:00:00+01', NULL,
    'user', 'active', TRUE, '2024-02-28 09:00:00+01'),

  -- Account amministratore per la dashboard di moderazione
  ('admin', 'admin@lookup.local',
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
    'Mar e Gio 16:00–20:00 · Sab 10:00–18:00 · prestito su appuntamento'),

  -- v1.0: profili dei due nuovi enti
  ('libreria.spaccanapoli',
    'Libreria Spaccanapoli S.r.l.',
    'libreria_indipendente',
    'Giuseppe Capuano',
    'https://www.libreriaspaccanapoli.it',
    'ciao@libreriaspaccanapoli.it',
    '+39 081 555 0211',
    'Via San Biagio dei Librai 32, 80138 Napoli',
    'Lun–Sab 9:30–19:30 · Dom 10:00–13:00'),

  ('centro.mezzogiorno',
    'Centro Culturale Mezzogiorno ETS',
    'centro_culturale',
    'Dott. Antonio Iervolino',
    'https://www.centromezzogiorno.org',
    'info@centromezzogiorno.org',
    '+39 081 555 0388',
    'Via Luca Giordano 21, 80127 Napoli',
    'Lun–Ven 16:00–20:00 · Sab 10:00–13:00 · iscritti e ospiti')
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
    'Se questo è un uomo', 'Primo Levi', 1947, '', 216,
    'Testimonianza della prigionia di Primo Levi ad Auschwitz. Una delle opere fondamentali della letteratura del Novecento italiano.',
    'buone condizioni', TRUE, 342, 12, '2024-03-15 10:30:00+01'),

  ('chiara.morandi', 'Narrativa contemporanea',
    'Le città invisibili', 'Italo Calvino', 1972, '', 173,
    'Dialogo immaginario tra Marco Polo e Kublai Khan sulle città visitate dal mercante veneziano, metafore delle città della memoria, del desiderio, dei segni.',
    'ottime condizioni', TRUE, 278, 8, '2024-03-20 15:45:00+01'),

  ('marco.devito', 'Gialli e noir',
    'Uomini che odiano le donne', 'Stieg Larsson', 2005, '', 678,
    'Primo capitolo della trilogia Millennium. Un giornalista investigativo e una hacker indagano su un caso di scomparsa irrisolto da quarant''anni.',
    'buone condizioni', TRUE, 189, 5, '2024-02-10 09:00:00+01'),

  ('anna.russo', 'Classici',
    'Il nome della rosa', 'Umberto Eco', 1980, '', 512,
    'Romanzo storico ambientato in un''abbazia benedettina del XIV secolo. Un maestro francescano indaga su una serie di morti misteriose.',
    'ottime condizioni', FALSE, 456, 18, '2024-01-08 11:00:00+01'),

  ('anna.russo', 'Poesia',
    'Canti', 'Giacomo Leopardi', 1835, '', 280,
    'Raccolta completa dei componimenti poetici di Leopardi. Edizione ottocentesca con note critiche originali.',
    'come nuovo', TRUE, 512, 3, '2023-12-15 14:20:00+01'),

  ('luca.esposito', 'Storia',
    'Storia di Napoli', 'Benedetto Croce', 1925, '', 720,
    'Opera monumentale di Croce sulla storia della città di Napoli dall''antichità fino al Risorgimento.',
    'buone condizioni', TRUE, 298, 9, '2024-05-12 17:10:00+02'),

  ('giulia.ferrari', 'Classici',
    'La coscienza di Zeno', 'Italo Svevo', 1923, '', 480,
    'Memoriale autobiografico di Zeno Cosini, scritto per il suo psicoanalista. Capolavoro del romanzo italiano del Novecento.',
    'ottime condizioni', TRUE, 234, 6, '2024-02-22 19:30:00+01'),

  ('roberto.mazzone', 'Fantascienza',
    'Dune', 'Frank Herbert', 1965, '', 820,
    'Epopea fantascientifica ambientata sul pianeta desertico Arrakis. Considerato uno dei capolavori assoluti della SF.',
    'buone condizioni', TRUE, 412, 15, '2024-04-05 13:00:00+02'),

  ('giulia.ferrari', 'Narrativa contemporanea',
    'L''amica geniale', 'Elena Ferrante', 2011, '9788866324119', 400,
    'Primo volume della quadrilogia napoletana. L''amicizia tra Lila ed Elena in un rione di Napoli degli anni ''50.',
    'come nuovo', TRUE, 389, 22, '2024-03-28 10:15:00+01'),

  ('chiara.morandi', 'Saggistica',
    'Il sistema periodico', 'Primo Levi', 1975, '', 240,
    'Autobiografia strutturata sugli elementi chimici. Un dialogo tra la vita e la scienza.',
    'ottime condizioni', TRUE, 156, 4, '2024-04-18 16:40:00+02'),

  ('luca.esposito', 'Saggistica',
    'Gomorra', 'Roberto Saviano', 2006, '', 331,
    'Inchiesta sulla camorra campana. Un viaggio nelle dinamiche del potere criminale contemporaneo.',
    'buone condizioni', TRUE, 267, 7, '2024-05-20 12:25:00+02'),

  ('roberto.mazzone', 'Fantascienza',
    'Neuromante', 'William Gibson', 1984, '', 288,
    'Romanzo seminale del cyberpunk. La storia di Case, hacker-mercenario, in un futuro distopico dominato dalle corporazioni.',
    'discrete', TRUE, 178, 5, '2024-05-28 20:00:00+02'),

  -- Volumi delle librerie-ente
  ('biblioteca.sanita', 'Classici',
    'La pelle', 'Curzio Malaparte', 1949, '', 360,
    'Romanzo crudo e visionario su Napoli durante la Seconda guerra mondiale, tra le rovine e la sopravvivenza.',
    'buone condizioni', TRUE, 198, 6, '2024-06-10 11:00:00+02'),

  ('biblioteca.sanita', 'Saggistica',
    'Il ventre di Napoli', 'Matilde Serao', 1884, '', 180,
    'Inchiesta giornalistica sulle condizioni dei quartieri popolari napoletani di fine Ottocento.',
    'discrete', TRUE, 156, 4, '2024-04-22 10:30:00+02'),

  ('biblioteca.sanita', 'Narrativa contemporanea',
    'Montedidio', 'Erri De Luca', 2001, '', 180,
    'Un ragazzo, una lingua che si fa adulta e un quartiere di Napoli che diventa mondo.',
    'come nuovo', FALSE, 134, 3, '2024-05-30 09:15:00+02'),

  ('lettori.erranti', 'Narrativa contemporanea',
    'Le otto montagne', 'Paolo Cognetti', 2016, '', 199,
    'L''amicizia tra due uomini e il loro rapporto con la montagna, lungo l''arco di una vita.',
    'ottime condizioni', TRUE, 221, 9, '2024-06-05 14:00:00+02'),

  ('lettori.erranti', 'Classici',
    'La Storia', 'Elsa Morante', 1974, '', 656,
    'Un grande romanzo corale sulla Seconda guerra mondiale vista dagli ultimi.',
    'buone condizioni', TRUE, 187, 7, '2024-03-18 16:00:00+01'),

  ('lettori.erranti', 'Classici',
    'Il barone rampante', 'Italo Calvino', 1957, '', 264,
    'Cosimo decide di vivere sugli alberi e non scenderne mai più: una favola sulla libertà.',
    'buone condizioni', TRUE, 165, 5, '2024-05-12 11:30:00+02'),

  -- v1.0: libri della Libreria Indipendente Spaccanapoli (id 9)
  ('libreria.spaccanapoli', 'Teatro contemporaneo',
    'Napoli milionaria!', 'Eduardo De Filippo', 1945, '9788806065850', 96,
    'Commedia in tre atti ambientata nella Napoli del dopoguerra: il dramma della sopravvivenza e della dignità in una città devastata.',
    'buone condizioni', TRUE, 142, 4, '2024-06-08 10:00:00+02'),
  ('libreria.spaccanapoli', 'Poesia italiana',
    'Vesuviana', 'Erri De Luca', 2009, '', 112,
    'Raccolta poetica dedicata al vulcano e al paesaggio campano: voci, fatiche e bellezze del territorio.',
    'ottime condizioni', TRUE, 96, 2, '2024-07-21 12:00:00+02'),
  ('libreria.spaccanapoli', 'Narrativa storica',
    'Il resto di niente', 'Enzo Striano', 1986, '', 442,
    'La storia di Eleonora Pimentel Fonseca e della Repubblica Napoletana del 1799: una donna, un''idea di libertà, una città.',
    'buone condizioni', FALSE, 211, 8, '2024-04-30 09:30:00+02'),

  -- v1.0: libri del Centro Culturale Mezzogiorno (id 10)
  ('centro.mezzogiorno', 'Racconti',
    'L''oro di Napoli', 'Giuseppe Marotta', 1947, '9788817010917', 286,
    'Raccolta di racconti che fotografano la Napoli del dopoguerra con tenerezza e ironia: ritratti popolari di una città stratificata.',
    'buone condizioni', TRUE, 178, 6, '2024-08-04 11:00:00+02'),
  ('centro.mezzogiorno', 'Storia',
    'Storia del Mezzogiorno', 'Giuseppe Galasso', 1992, '', 720,
    'Sintesi monumentale della storia meridionale dall''antichità all''età contemporanea: una lettura strutturale del Sud Italia.',
    'ottime condizioni', TRUE, 134, 3, '2024-09-15 10:00:00+02'),
  ('centro.mezzogiorno', 'Letteratura di viaggio',
    'Le vie dei canti', 'Bruce Chatwin', 1987, '9788845911415', 312,
    'L''Australia degli aborigeni come mappa di canti: un viaggio fra etnografia e narrativa, fra il visibile e l''invisibile.',
    'discrete', TRUE, 188, 5, '2024-10-02 15:00:00+02')
) AS v(
  owner_username, category_name, title, author, year, isbn, pages,
  description, condition, available, view_count, request_count, created_at
)
JOIN users u       ON u.username = v.owner_username
JOIN categories c  ON c.name     = v.category_name;


-- ---- v1.0: multi-tag BISAC (book_categories) ----
-- Ogni libro è agganciato a tutti i suoi tag BISAC; uno solo è "primary"
-- (mostrato come categoria principale nelle card compatte).
-- Lo stesso modello vale per i libri preesistenti: ad esempio
-- "Le città invisibili" può portare insieme "Narrativa contemporanea" e
-- "Narrativa letteraria". Qui agganciamo i tag dei nuovi 6 libri e
-- aggiungiamo qualche tag aggiuntivo a libri storici per dimostrare il
-- modello molti-a-molti.
INSERT INTO book_categories (book_id, category_id, is_primary)
SELECT b.id, c.id, v.is_primary
FROM (VALUES
  -- nuovi libri di Spaccanapoli
  ('Napoli milionaria!',      'Teatro contemporaneo',  TRUE ),
  ('Napoli milionaria!',      'Classici',              FALSE),
  ('Napoli milionaria!',      'Narrativa storica',     FALSE),
  ('Vesuviana',               'Poesia italiana',       TRUE ),
  ('Vesuviana',               'Poesia',                FALSE),
  ('Il resto di niente',      'Narrativa storica',     TRUE ),
  ('Il resto di niente',      'Biografie storiche',    FALSE),
  -- nuovi libri del Centro Mezzogiorno
  ('L''oro di Napoli',        'Racconti',              TRUE ),
  ('L''oro di Napoli',        'Classici',              FALSE),
  ('L''oro di Napoli',        'Narrativa storica',     FALSE),
  ('Storia del Mezzogiorno',  'Storia',                TRUE ),
  ('Storia del Mezzogiorno',  'Saggistica generale',   FALSE),
  ('Storia del Mezzogiorno',  'Sociologia',            FALSE),
  ('Le vie dei canti',        'Letteratura di viaggio',TRUE ),
  ('Le vie dei canti',        'Antropologia',          FALSE),
  ('Le vie dei canti',        'Diari di viaggio',      FALSE),
  -- alcuni tag aggiuntivi sui libri storici (dimostrazione del modello)
  ('Le città invisibili',     'Narrativa contemporanea', TRUE ),
  ('Il barone rampante',      'Classici',              TRUE ),
  ('Se questo è un uomo',     'Classici',              TRUE )
) AS v(title, category, is_primary)
JOIN books b      ON b.title = v.title
JOIN categories c ON c.name  = v.category;


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
  ('lettori.erranti',   'grid',   'classic',  'symbol',   '❧',  'Leggere insieme, camminare lontano', 'recent', TRUE),
  -- v1.0: preferenze dei due nuovi enti
  ('libreria.spaccanapoli', 'shelf', 'bordeaux', 'symbol', '⌘',  'Editoria meridionale e piccoli editori', 'recent', TRUE),
  ('centro.mezzogiorno',    'list',  'sage',     'symbol', '✦',  'Il Sud che legge se stesso',           'title',  TRUE)
) AS v(username, view_mode, theme, avatar_style, avatar_symbol, motto, sort_by, show_email)
JOIN users u ON u.username = v.username;


-- =============================================================================
-- DATI SOCIALI (v0.8): follow, like, notifiche
-- =============================================================================

-- ---- FOLLOW: Chiara segue due enti e una lettrice -----------------------
INSERT INTO user_follows (follower_id, followed_id)
SELECT f.id, t.id
FROM (VALUES
  ('chiara.morandi', 'biblioteca.sanita'),
  ('chiara.morandi', 'lettori.erranti'),
  ('chiara.morandi', 'anna.russo')
) AS rel(follower, followed)
JOIN users f ON f.username = rel.follower
JOIN users t ON t.username = rel.followed;

-- ---- LIKE: i volumi preferiti di Chiara ---------------------------------
-- (un titolo in prestito + due disponibili, per mostrare entrambi gli stati)
INSERT INTO book_likes (user_id, book_id)
SELECT u.id, b.id
FROM (VALUES
  ('chiara.morandi', 'Montedidio'),
  ('chiara.morandi', 'Le città invisibili'),
  ('chiara.morandi', 'La Storia')
) AS rel(username, title)
JOIN users u ON u.username = rel.username
JOIN books b ON b.title = rel.title;

-- ---- NOTIFICHE: eventi mostrati nella campanella di Chiara --------------
-- Esempi dei tre tipi. read_at NULL = non letta. actor_id = libreria d'origine.
INSERT INTO notifications (user_id, type, actor_id, book_id, message, created_at, read_at)
SELECT dest.id, n.type, act.id, bk.id, n.message,
       CURRENT_TIMESTAMP - (n.age_hours || ' hours')::interval,
       CASE WHEN n.is_read THEN CURRENT_TIMESTAMP - INTERVAL '1 hour' ELSE NULL END
FROM (VALUES
  -- (destinatario, tipo, attore, titolo libro o NULL, messaggio, ore fa, letta)
  ('chiara.morandi', 'book_available', 'luca.esposito',     'Montedidio',
     'Il volume «Montedidio», fra i tuoi preferiti, è di nuovo disponibile per il prestito', 4, FALSE),
  ('chiara.morandi', 'profile_update', 'lettori.erranti',   NULL,
     'Associazione I Lettori Erranti ha aggiornato le informazioni della libreria', 48, FALSE),
  ('chiara.morandi', 'profile_update', 'biblioteca.sanita', NULL,
     'Biblioteca di Comunità Rione Sanità ha aggiornato le informazioni della libreria', 50, FALSE),
  ('chiara.morandi', 'new_book',       'biblioteca.sanita', 'La pelle',
     'Biblioteca di Comunità Rione Sanità ha pubblicato «La pelle»', 240, TRUE),
  ('chiara.morandi', 'new_book',       'lettori.erranti',   'Le otto montagne',
     'Associazione I Lettori Erranti ha pubblicato «Le otto montagne»', 360, TRUE)
) AS n(dest_user, type, actor_user, book_title, message, age_hours, is_read)
JOIN users dest ON dest.username = n.dest_user
JOIN users act  ON act.username  = n.actor_user
LEFT JOIN books bk ON bk.title = n.book_title;


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


-- =============================================================================
-- RECENSIONI E VALUTAZIONI (v1.4)
-- =============================================================================
-- 45 recensioni di esempio: ~5 per ciascuna delle 10 librerie campione.
-- Voti distribuiti fra 4 e 5 con qualche 3, contenuti realistici sia per
-- librerie personali sia per enti (toni differenti).
INSERT INTO reviews (id, target_user_id, reviewer_id, rating, text, created_at) VALUES
  (1, 1, 2, 5, 'Chiara è una lettrice attentissima: mi ha consigliato un Calvino che non avevo mai considerato e mi ha prestato il volume con cura. Da rifare assolutamente.', '2025-09-14'),
  (2, 1, 4, 5, 'Selezione curatissima. Le sue edizioni del Novecento sono in condizioni perfette e si percepisce l''''amore per i libri. Restituzione e prestito gestiti con grande precisione.', '2025-08-22'),
  (3, 1, 6, 4, 'Esperienza piacevole, mi sono trovato benissimo con la consegna a Chiaia. Toglierei una stellina solo perché orari un po'''' rigidi, ma comprensibili.', '2025-07-03'),
  (4, 1, 8, 5, 'Una libreria personale di rara qualità per chi cerca saggistica filosofica. Chiara ha collaborato volentieri con noi su un ciclo di letture: persona seria e competente.', '2025-06-15'),
  (5, 1, 3, 5, 'Volume restituito in tempo, conversazioni interessanti al passaggio. Una di quelle persone che ti fa amare di più Lookup.', '2025-10-01'),
  (6, 2, 1, 5, 'Marco è un vero appassionato del genere: mi ha procurato un Mankell che cercavo da anni. Libri ben tenuti, consegna puntuale.', '2025-09-08'),
  (7, 2, 5, 4, 'Ottima collezione di noir, qualche edizione un po'''' usurata ma niente di problematico. Comunicazione rapida e cordiale.', '2025-08-19'),
  (8, 2, 3, 5, 'Se cercate gialli scandinavi siete nel posto giusto. Marco sa di che parla e mi ha fatto scoprire Indriðason. Affidabile al 100%.', '2025-07-25'),
  (9, 2, 7, 4, 'Abbiamo richiesto in prestito due titoli per una serata tematica del Rione Sanità: disponibilità totale e libri restituiti in ottimo stato.', '2025-06-02'),
  (10, 3, 1, 5, 'Anna conserva una biblioteca di famiglia con edizioni storiche di altissimo pregio. Mi ha prestato una rilegatura ottocentesca con la stessa fiducia che si dà a un amico. Grazie davvero.', '2025-09-20'),
  (11, 3, 6, 5, 'Esperienza memorabile. Le edizioni che tiene sono pezzi rari, e lei è molto generosa nel condividerle previa cura. Cinque stelle senza esitazione.', '2025-08-11'),
  (12, 3, 9, 4, 'Volume cinquecentesco prestato per una nostra mostra: ottima collaborazione, qualche difficoltà negli orari ma legittima viste le edizioni in gioco.', '2025-07-14'),
  (13, 3, 4, 5, 'Affidabile, gentile, conoscitrice profonda dei classici. Una libreria privata che vale una visita in biblioteca civica.', '2025-06-28'),
  (14, 3, 10, 5, 'Collaborazione preziosa per il nostro progetto sulla letteratura meridionale. Anna è una risorsa per tutta la comunità.', '2025-05-30'),
  (15, 4, 1, 4, 'Catalogo interessante e ben organizzato. Luca risponde rapidamente. Solo da migliorare la disponibilità nel weekend.', '2025-09-25'),
  (16, 4, 2, 5, 'Sempre cortese, sempre disponibile. Mi ha prestato tre libri e la consegna è stata impeccabile.', '2025-08-30'),
  (17, 4, 6, 4, 'Buona esperienza, libri in condizioni dignitose. Mi ha consigliato anche altri titoli simili a quello che cercavo.', '2025-07-19'),
  (18, 4, 5, 5, 'Lettore appassionato e curatore generoso. Niente da eccepire, lo consiglio.', '2025-06-09'),
  (19, 5, 1, 5, 'Selezione di poesia contemporanea che difficilmente trovi altrove. Giulia è una compagnia preziosa per chi ama la lettura ad alta voce.', '2025-09-16'),
  (20, 5, 4, 4, 'Mi sono trovato bene. Solo qualche libro un po'''' segnato dal tempo, ma niente che ne comprometta la lettura.', '2025-08-04'),
  (21, 5, 8, 5, 'Collaborazione su un nostro reading: Giulia ha portato libri e un''''energia rara. Persona di fiducia totale.', '2025-07-22'),
  (22, 5, 3, 5, 'Tre prestiti, tre esperienze ottime. Restituzioni gestite via app senza intoppi.', '2025-06-11'),
  (23, 6, 2, 4, 'Roberto cura una raccolta di saggistica storica molto interessante. Comunicazione un po'''' essenziale ma sempre puntuale.', '2025-09-12'),
  (24, 6, 4, 5, 'Persona di sostanza. Mi ha aiutato a recuperare un volume fuori catalogo da decenni. Mille grazie.', '2025-08-26'),
  (25, 6, 7, 5, 'Collaboratore prezioso per le nostre attività di studio. Roberto è un lettore serio e affidabile.', '2025-07-08'),
  (26, 6, 1, 4, 'Catalogo di nicchia ma di alta qualità. Esperienza positiva.', '2025-06-30'),
  (27, 7, 1, 5, 'Una realtà preziosa per il quartiere. Il personale è cortese, gli spazi accoglienti e il catalogo dedicato alla storia del Rione Sanità è ricchissimo. Da visitare.', '2025-09-18'),
  (28, 7, 2, 5, 'Biblioteca di comunità nel senso pieno della parola: aperta, partecipata, attenta. Ho preso in prestito tre volumi senza alcuna difficoltà.', '2025-08-15'),
  (29, 7, 5, 5, 'Tengono incontri settimanali sulla letteratura napoletana che sono veri gioielli. Cinque stelle alla cura con cui gestiscono il fondo storico.', '2025-07-29'),
  (30, 7, 3, 4, 'Esperienza ottima nel complesso. Tolgo solo una stella perché in alcune fasce orarie c''''è poca disponibilità di volontari, ma è comprensibile.', '2025-06-20'),
  (31, 7, 9, 5, 'Collaboriamo da anni: una realtà di riferimento per il presidio culturale dei quartieri di Napoli. Affidabilissimi.', '2025-05-12'),
  (32, 8, 1, 5, 'Un''''associazione vivace, organizza giri di lettura itineranti per la città che sono un''''esperienza unica. Catalogo eterogeneo e accessibile.', '2025-09-22'),
  (33, 8, 4, 5, 'Lettori Erranti è quanto di più bello possa esistere per un appassionato. Eventi gratuiti, prestiti facili, persone gentilissime.', '2025-08-08'),
  (34, 8, 6, 4, 'Mi sono iscritto all''''associazione e ho già preso in prestito quattro libri. Tutto bene, qualche piccola lentezza nella restituzione ma niente di grave.', '2025-07-17'),
  (35, 8, 2, 5, 'Una realtà che dà senso all''''idea di "lettori in cammino". Bravi davvero.', '2025-06-05'),
  (36, 9, 1, 4, 'Libreria indipendente nel cuore della città, selezione curata di narrativa contemporanea. I libri prestati erano in ottime condizioni.', '2025-09-30'),
  (37, 9, 3, 5, 'Punto di riferimento per chi cerca pubblicazioni di piccoli editori. Personale appassionato e competente.', '2025-08-23'),
  (38, 9, 7, 5, 'Una libreria che fa la differenza nel quartiere. Collaborazioni sempre fruttuose, edizioni interessanti, prestiti gestiti con professionalità.', '2025-07-11'),
  (39, 9, 5, 4, 'Bella esperienza, mi ha consigliato due titoli che non conoscevo. Un po'''' caotici negli orari di chiusura ma è la vita di una libreria indipendente.', '2025-06-18'),
  (40, 9, 8, 5, 'Una libreria coraggiosa, di quelle che resistono al tempo della grande distribuzione. La sosteniamo con convinzione.', '2025-05-25'),
  (41, 10, 2, 5, 'Il fondo dedicato alla questione meridionale è uno dei più ricchi della città. Personale preparato, ambienti raccolti.', '2025-09-05'),
  (42, 10, 6, 5, 'Un centro di ricerca prezioso. Le pubblicazioni della loro biblioteca sono insostituibili per chi studia il Sud.', '2025-08-29'),
  (43, 10, 1, 4, 'Catalogo di valore, però la procedura di prestito è un po'''' più lenta che altrove. Comprensibile dato il valore delle edizioni.', '2025-07-26'),
  (44, 10, 4, 5, 'Un''''istituzione culturale che vale dieci stelle. Persone serie, biblioteca eccellente, ambiente di studio impeccabile.', '2025-06-13'),
  (45, 10, 9, 4, 'Buona collaborazione: hanno ospitato presso di noi alcuni loro volumi per una rassegna. Affidabili.', '2025-05-08');

-- Allinea la sequenza alla max(id)
SELECT setval('reviews_id_seq', (SELECT MAX(id) FROM reviews));
