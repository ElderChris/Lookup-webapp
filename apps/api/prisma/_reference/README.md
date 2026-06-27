# Riferimento SQL (legacy)

Questi file SQL provengono dal prototipo `v2.x`. Erano la **proposta di schema**
PostgreSQL + PostGIS scritta a mano, mai eseguita (il prototipo usava solo
localStorage).

In **Fase 1b** questi file diventano il riferimento per definire lo
**schema Prisma** vero (`../schema.prisma`). Lo schema Prisma sarà l'unica
source-of-truth da Fase 1b in poi; questi `.sql` resteranno qui per
confronto storico e come fallback se per qualche ragione vorremo
generare nuovamente lo schema manualmente.

| File | Contenuto |
|---|---|
| `schema.sql` | Definizione tabelle, indici, constraint, trigger |
| `seed_data.sql` | Dati di esempio in SQL (replicano i `SAMPLE_*` del frontend) |

**Non vengono eseguiti** automaticamente dal docker compose.
L'inizializzazione del DB live in `infra/postgres/init.sql` (PostGIS extensions),
le tabelle vere arrivano da Prisma migration.
