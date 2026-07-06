ALTER TABLE "staff"
ADD COLUMN "is_trainee" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ward_staff_snapshots"
ADD COLUMN "is_trainee" BOOLEAN NOT NULL DEFAULT false;
