-- Tipi di notifica fino a 40 caratteri: quelli dei job dei prestiti
-- (loan_overdue_borrower, loan_deadline_upcoming_borrower, ...) superavano
-- i 20 della colonna e l'inserimento falliva.
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE VARCHAR(40);

-- Prestito coinvolto: la notifica porta direttamente al prestito
ALTER TABLE "notifications" ADD COLUMN "loan_id" INTEGER;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_loan_id_fkey" FOREIGN KEY ("loan_id")
  REFERENCES "loan_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
