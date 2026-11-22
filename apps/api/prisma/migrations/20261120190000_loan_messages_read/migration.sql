-- Ultima lettura della chat di un prestito, per partecipante: serve a
-- calcolare i messaggi non letti.
ALTER TABLE "loan_requests" ADD COLUMN "requester_last_read_at" TIMESTAMPTZ,
ADD COLUMN "lender_last_read_at" TIMESTAMPTZ;
