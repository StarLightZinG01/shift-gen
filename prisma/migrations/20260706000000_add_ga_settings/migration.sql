-- CreateTable
CREATE TABLE "ga_settings" (
    "id" UUID NOT NULL,
    "profile_key" TEXT NOT NULL,
    "profile_name" TEXT NOT NULL,
    "population_size" INTEGER NOT NULL,
    "generations" INTEGER NOT NULL,
    "patience" INTEGER NOT NULL,
    "elite_size" INTEGER NOT NULL,
    "tournament_size" INTEGER NOT NULL,
    "crossover_rate" DECIMAL(8,4) NOT NULL,
    "mutation_rate" DECIMAL(8,6) NOT NULL,
    "random_seed" INTEGER,
    "max_seconds" INTEGER NOT NULL,
    "max_shifts_per_7_days" INTEGER NOT NULL,
    "weekly_min_days_off" INTEGER NOT NULL,
    "max_consecutive_nights" INTEGER NOT NULL,
    "max_consecutive_work_days" INTEGER NOT NULL,
    "max_trainee_per_shift" INTEGER NOT NULL,
    "min_rest_hours" INTEGER NOT NULL,
    "workload_balance_max_diff" INTEGER NOT NULL,
    "shift_count_balance_max_diff" INTEGER NOT NULL,
    "shift_type_balance_max_diff" INTEGER NOT NULL,
    "target_off_days_per_staff" INTEGER,
    "enable_morning_evening_double" BOOLEAN NOT NULL DEFAULT false,
    "enable_night_evening_double" BOOLEAN NOT NULL DEFAULT false,
    "prefer_morning_ot" BOOLEAN NOT NULL DEFAULT true,
    "morning_regular_required" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ga_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ga_settings_profile_key_key" ON "ga_settings"("profile_key");
