CREATE TABLE "ga_run_batches" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "target_ward_ids" JSONB NOT NULL,
    "group_count" INTEGER NOT NULL,
    "completed_group_count" INTEGER NOT NULL DEFAULT 0,
    "failed_group_count" INTEGER NOT NULL DEFAULT 0,
    "hard_score" DECIMAL(20,4),
    "soft_score" DECIMAL(20,4),
    "objective" DECIMAL(20,4),
    "fitness" DECIMAL(20,10),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ga_run_batches_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ga_runs"
ADD COLUMN "batch_id" UUID,
ADD COLUMN "group_index" INTEGER;

CREATE UNIQUE INDEX "ga_run_batches_schedule_version_id_key"
ON "ga_run_batches"("schedule_version_id");

CREATE INDEX "ga_run_batches_cycle_id_status_idx"
ON "ga_run_batches"("cycle_id", "status");

CREATE INDEX "ga_runs_batch_id_status_idx"
ON "ga_runs"("batch_id", "status");

CREATE UNIQUE INDEX "ga_runs_batch_id_group_index_key"
ON "ga_runs"("batch_id", "group_index");

ALTER TABLE "ga_run_batches"
ADD CONSTRAINT "ga_run_batches_cycle_id_fkey"
FOREIGN KEY ("cycle_id") REFERENCES "schedule_cycles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ga_run_batches"
ADD CONSTRAINT "ga_run_batches_schedule_version_id_fkey"
FOREIGN KEY ("schedule_version_id") REFERENCES "schedule_versions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ga_runs"
ADD CONSTRAINT "ga_runs_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "ga_run_batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
