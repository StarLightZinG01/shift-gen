-- Add scheduling qualifications that are independent from payroll position labels.
CREATE TYPE "StaffCategory" AS ENUM ('RN', 'PN', 'NA', 'OTHER');

ALTER TABLE "staff"
ADD COLUMN "staff_category" "StaffCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "is_new_nurse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "can_be_in_charge" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ward_staff_snapshots"
ADD COLUMN "staff_category" "StaffCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "is_new_nurse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "can_be_in_charge" BOOLEAN NOT NULL DEFAULT false;

-- Preserve useful category information until the development roster is replaced.
UPDATE "staff"
SET "staff_category" = CASE
  WHEN UPPER(COALESCE("pay_position", '')) LIKE 'RN%' THEN 'RN'::"StaffCategory"
  WHEN UPPER(COALESCE("pay_position", '')) = 'PN' THEN 'PN'::"StaffCategory"
  WHEN UPPER(COALESCE("pay_position", '')) = 'NA' THEN 'NA'::"StaffCategory"
  ELSE 'OTHER'::"StaffCategory"
END;

UPDATE "ward_staff_snapshots"
SET "staff_category" = CASE
  WHEN UPPER(COALESCE("pay_position", '')) LIKE 'RN%' THEN 'RN'::"StaffCategory"
  WHEN UPPER(COALESCE("pay_position", '')) = 'PN' THEN 'PN'::"StaffCategory"
  WHEN UPPER(COALESCE("pay_position", '')) = 'NA' THEN 'NA'::"StaffCategory"
  ELSE 'OTHER'::"StaffCategory"
END;
