-- Data e ora in cui l'utente ha accettato termini e privacy all'iscrizione
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMPTZ;
