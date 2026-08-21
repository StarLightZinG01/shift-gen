UPDATE "ga_settings"
SET "max_consecutive_nights" = 2
WHERE "max_consecutive_nights" <> 2;

ALTER TABLE "ga_settings"
DROP CONSTRAINT IF EXISTS "ga_settings_max_consecutive_nights_check";

ALTER TABLE "ga_settings"
ADD CONSTRAINT "ga_settings_max_consecutive_nights_check"
CHECK ("max_consecutive_nights" = 2);
