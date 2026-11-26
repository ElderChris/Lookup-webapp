-- "Accetto richieste di prestito" (impostazioni del profilo): se disattivata,
-- i volumi spariscono da ricerche, mappa ed elenchi e non si possono chiedere
-- in prestito; restano visibili nella pagina della libreria.
ALTER TABLE "users" ADD COLUMN "accepts_loans" BOOLEAN NOT NULL DEFAULT true;

-- "Email visibile sul profilo": salvata ma mai mostrata, tolta (l'email
-- resta privata come dice l'informativa)
ALTER TABLE "user_preferences" DROP COLUMN "show_email";

-- Categorie degli enti fuori dall'elenco ammesso (dati di prova delle prime
-- versioni): ricondotte alle categorie dell'elenco
UPDATE "organization_profiles" SET "org_category" = CASE "org_category"
    WHEN 'biblioteca' THEN 'biblioteca_comunita'
    WHEN 'associazione' THEN 'associazione_culturale'
    WHEN 'centro_culturale' THEN 'associazione_culturale'
    ELSE 'altro'
  END
WHERE "org_category" NOT IN ('biblioteca_pubblica', 'biblioteca_comunita', 'libreria_indipendente',
  'associazione_culturale', 'centro_studi', 'scuola', 'altro');
