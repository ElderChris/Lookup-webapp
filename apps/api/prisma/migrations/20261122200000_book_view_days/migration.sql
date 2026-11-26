-- Visualizzazioni dei libri per giorno, anonime (nessun dato su chi guarda).
-- Lo storico parte da questa migrazione; il totale resta in books.view_count.
CREATE TABLE "book_view_days" (
    "book_id" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "book_view_days_pkey" PRIMARY KEY ("book_id","day")
);

ALTER TABLE "book_view_days" ADD CONSTRAINT "book_view_days_book_id_fkey"
  FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
