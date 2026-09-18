ALTER TABLE "staffing_requirements"
ADD COLUMN "rn_required" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pn_na_required" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "requires_incharge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "holiday_min_staff" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "holiday_max_staff" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "holiday_rn_required" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "holiday_pn_na_required" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "holiday_requires_incharge" BOOLEAN NOT NULL DEFAULT false;

UPDATE "staffing_requirements"
SET "holiday_min_staff" = "min_staff",
    "holiday_max_staff" = "max_staff";
