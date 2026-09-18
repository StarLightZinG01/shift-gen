CREATE TABLE "ward_special_rule_settings" (
    "id" UUID NOT NULL,
    "ward_cycle_id" UUID NOT NULL,
    "rule_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ward_special_rule_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ward_special_rule_settings_ward_cycle_id_rule_key_key"
ON "ward_special_rule_settings"("ward_cycle_id", "rule_key");

CREATE INDEX "ward_special_rule_settings_ward_cycle_id_idx"
ON "ward_special_rule_settings"("ward_cycle_id");

ALTER TABLE "ward_special_rule_settings"
ADD CONSTRAINT "ward_special_rule_settings_ward_cycle_id_fkey"
FOREIGN KEY ("ward_cycle_id") REFERENCES "ward_cycle_preparations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
