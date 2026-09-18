CREATE TABLE "schedule_ward_versions" (
    "id" UUID NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "ward_id" UUID NOT NULL,
    "parent_ward_version_id" UUID,
    "version_no" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "schedule_ward_versions_pkey" PRIMARY KEY ("id")
);

WITH version_wards AS (
    SELECT DISTINCT
        sv.id AS schedule_version_id,
        sv.cycle_id,
        sa.ward_id,
        sv.source,
        sv.status,
        sv.created_by,
        sv.created_at,
        sv.published_at,
        sv.version_no AS legacy_version_no
    FROM "schedule_versions" sv
    JOIN "schedule_assignments" sa ON sa.schedule_version_id = sv.id

    UNION

    SELECT DISTINCT
        sv.id AS schedule_version_id,
        sv.cycle_id,
        target_ward.value::uuid AS ward_id,
        sv.source,
        sv.status,
        sv.created_by,
        sv.created_at,
        sv.published_at,
        sv.version_no AS legacy_version_no
    FROM "schedule_versions" sv
    JOIN "ga_run_batches" batch ON batch.schedule_version_id = sv.id
    CROSS JOIN LATERAL jsonb_array_elements_text(batch.target_ward_ids) AS target_ward(value)
), numbered AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY cycle_id, ward_id
            ORDER BY legacy_version_no, created_at, schedule_version_id
        )::integer AS ward_version_no
    FROM version_wards
)
INSERT INTO "schedule_ward_versions" (
    "id",
    "schedule_version_id",
    "cycle_id",
    "ward_id",
    "version_no",
    "source",
    "status",
    "created_by",
    "created_at",
    "published_at"
)
SELECT
    md5(schedule_version_id::text || ':' || ward_id::text)::uuid,
    schedule_version_id,
    cycle_id,
    ward_id,
    ward_version_no,
    source,
    status,
    created_by,
    created_at,
    published_at
FROM numbered;

CREATE UNIQUE INDEX "schedule_ward_versions_cycle_id_ward_id_version_no_key"
ON "schedule_ward_versions"("cycle_id", "ward_id", "version_no");

CREATE UNIQUE INDEX "schedule_ward_versions_schedule_version_id_ward_id_key"
ON "schedule_ward_versions"("schedule_version_id", "ward_id");

CREATE INDEX "schedule_ward_versions_cycle_id_ward_id_status_idx"
ON "schedule_ward_versions"("cycle_id", "ward_id", "status");

ALTER TABLE "schedule_ward_versions"
ADD CONSTRAINT "schedule_ward_versions_schedule_version_id_fkey"
FOREIGN KEY ("schedule_version_id") REFERENCES "schedule_versions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_ward_versions"
ADD CONSTRAINT "schedule_ward_versions_cycle_id_fkey"
FOREIGN KEY ("cycle_id") REFERENCES "schedule_cycles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_ward_versions"
ADD CONSTRAINT "schedule_ward_versions_ward_id_fkey"
FOREIGN KEY ("ward_id") REFERENCES "wards"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_ward_versions"
ADD CONSTRAINT "schedule_ward_versions_parent_ward_version_id_fkey"
FOREIGN KEY ("parent_ward_version_id") REFERENCES "schedule_ward_versions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "schedule_ward_versions"
ADD CONSTRAINT "schedule_ward_versions_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
