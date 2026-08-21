ALTER TABLE "ga_settings"
  DROP COLUMN IF EXISTS "workload_balance_max_diff",
  DROP COLUMN IF EXISTS "shift_count_balance_max_diff",
  DROP COLUMN IF EXISTS "shift_type_balance_max_diff";
