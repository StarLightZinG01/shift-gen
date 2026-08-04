ALTER TABLE "ga_settings"
ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ga_settings"
SET "is_active" = true
WHERE "profile_key" = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM "ga_settings" AS active_settings
    WHERE active_settings."is_active" = true
  );

UPDATE "ga_settings"
SET "is_active" = true
WHERE "id" = (
  SELECT "id"
  FROM "ga_settings"
  ORDER BY "updated_at" DESC
  LIMIT 1
)
  AND NOT EXISTS (
    SELECT 1
    FROM "ga_settings" AS active_settings
    WHERE active_settings."is_active" = true
  );
