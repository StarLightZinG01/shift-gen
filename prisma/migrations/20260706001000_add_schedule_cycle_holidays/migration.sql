-- CreateTable
CREATE TABLE "schedule_cycle_holidays" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "holiday_date" DATE NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_cycle_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_cycle_holidays_cycle_id_holiday_date_key" ON "schedule_cycle_holidays"("cycle_id", "holiday_date");

-- CreateIndex
CREATE INDEX "schedule_cycle_holidays_cycle_id_idx" ON "schedule_cycle_holidays"("cycle_id");

-- AddForeignKey
ALTER TABLE "schedule_cycle_holidays" ADD CONSTRAINT "schedule_cycle_holidays_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "schedule_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
