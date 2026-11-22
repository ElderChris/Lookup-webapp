-- Temi delle preferenze allineati ai valori dell'interfaccia
UPDATE "user_preferences" SET "theme" = 'sage' WHERE "theme" = 'verde';
UPDATE "user_preferences" SET "theme" = 'midnight' WHERE "theme" = 'notturno';

-- Foto profilo salvate nel database: servite da /api/users/:id/avatar
UPDATE "users"
SET "avatar_url" = '/api/users/' || "id" || '/avatar?v=1'
WHERE "avatar_data_url" IS NOT NULL AND "avatar_url" IS NULL;
