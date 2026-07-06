-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "employee_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "staff_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "home_ward_id" UUID NOT NULL,
    "position" TEXT,
    "pay_position" TEXT,
    "ot_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shift_pay_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_head" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_ward_permissions" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "ward_id" UUID NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_ward_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_cycles" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preparing',
    "request_open_date" DATE,
    "request_close_date" DATE,
    "data_lock_date" DATE,
    "auto_generate_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_cycle_preparations" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "ward_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_by" UUID,
    "submitted_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ward_cycle_preparations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_requirements" (
    "id" UUID NOT NULL,
    "ward_cycle_id" UUID NOT NULL,
    "shift_code" TEXT NOT NULL,
    "min_staff" INTEGER NOT NULL,
    "max_staff" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_cycle_external_staff" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "ward_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "selected_by" UUID,
    "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_cycle_external_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_staff_snapshots" (
    "id" UUID NOT NULL,
    "ward_cycle_id" UUID NOT NULL,
    "staff_id" UUID,
    "staff_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "home_ward_name" TEXT NOT NULL,
    "allowed_wards_text" TEXT NOT NULL,
    "position" TEXT,
    "pay_position" TEXT,
    "ot_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shift_pay_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_head" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_staff_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_requests" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "request_date" DATE NOT NULL,
    "request_type" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ga_runs" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "generation_count" INTEGER,
    "objective" DECIMAL(20,4),
    "fitness" DECIMAL(20,10),
    "input_snapshot" JSONB,
    "settings_snapshot" JSONB,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ga_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_versions" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "ga_run_id" UUID,
    "parent_version_id" UUID,
    "version_no" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "schedule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_assignments" (
    "id" UUID NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "ward_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "shift_code" TEXT NOT NULL,
    "is_ot" BOOLEAN NOT NULL DEFAULT false,
    "ot_shifts" TEXT,
    "pay_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_manual_changes" (
    "id" UUID NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "assignment_id" UUID,
    "action_type" TEXT NOT NULL,
    "old_staff_id" UUID,
    "new_staff_id" UUID,
    "old_ward_id" UUID,
    "new_ward_id" UUID,
    "old_work_date" DATE,
    "new_work_date" DATE,
    "old_shift_code" TEXT,
    "new_shift_code" TEXT,
    "reason" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_manual_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_compensation_summaries" (
    "id" UUID NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "ward_id" UUID NOT NULL,
    "total_ot_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_regular_shift_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_compensation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_summary_items" (
    "id" UUID NOT NULL,
    "summary_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "staff_type" TEXT,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "compensation_summary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ga_violations" (
    "id" UUID NOT NULL,
    "ga_run_id" UUID NOT NULL,
    "staff_id" UUID,
    "ward_id" UUID,
    "violation_date" DATE,
    "constraint_code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "penalty" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ga_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_code_key" ON "users"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "wards_code_key" ON "wards"("code");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_staff_code_key" ON "staff"("staff_code");

-- CreateIndex
CREATE INDEX "staff_home_ward_id_idx" ON "staff"("home_ward_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_ward_permissions_staff_id_ward_id_key" ON "staff_ward_permissions"("staff_id", "ward_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_cycles_year_month_key" ON "schedule_cycles"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ward_cycle_preparations_cycle_id_ward_id_key" ON "ward_cycle_preparations"("cycle_id", "ward_id");

-- CreateIndex
CREATE UNIQUE INDEX "staffing_requirements_ward_cycle_id_shift_code_key" ON "staffing_requirements"("ward_cycle_id", "shift_code");

-- CreateIndex
CREATE UNIQUE INDEX "ward_cycle_external_staff_cycle_id_ward_id_staff_id_key" ON "ward_cycle_external_staff"("cycle_id", "ward_id", "staff_id");

-- CreateIndex
CREATE INDEX "ward_staff_snapshots_ward_cycle_id_idx" ON "ward_staff_snapshots"("ward_cycle_id");

-- CreateIndex
CREATE INDEX "availability_requests_cycle_id_staff_id_idx" ON "availability_requests"("cycle_id", "staff_id");

-- CreateIndex
CREATE INDEX "ga_runs_cycle_id_status_idx" ON "ga_runs"("cycle_id", "status");

-- CreateIndex
CREATE INDEX "schedule_versions_cycle_id_status_idx" ON "schedule_versions"("cycle_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_versions_cycle_id_version_no_key" ON "schedule_versions"("cycle_id", "version_no");

-- CreateIndex
CREATE INDEX "schedule_assignments_schedule_version_id_ward_id_work_date_idx" ON "schedule_assignments"("schedule_version_id", "ward_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_assignments_schedule_version_id_staff_id_work_date_key" ON "schedule_assignments"("schedule_version_id", "staff_id", "work_date");

-- CreateIndex
CREATE INDEX "schedule_manual_changes_schedule_version_id_idx" ON "schedule_manual_changes"("schedule_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "ward_compensation_summaries_schedule_version_id_ward_id_key" ON "ward_compensation_summaries"("schedule_version_id", "ward_id");

-- CreateIndex
CREATE INDEX "compensation_summary_items_summary_id_category_idx" ON "compensation_summary_items"("summary_id", "category");

-- CreateIndex
CREATE INDEX "ga_violations_ga_run_id_severity_idx" ON "ga_violations"("ga_run_id", "severity");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_home_ward_id_fkey" FOREIGN KEY ("home_ward_id") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_ward_permissions" ADD CONSTRAINT "staff_ward_permissions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_ward_permissions" ADD CONSTRAINT "staff_ward_permissions_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_ward_permissions" ADD CONSTRAINT "staff_ward_permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_cycle_preparations" ADD CONSTRAINT "ward_cycle_preparations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "schedule_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_cycle_preparations" ADD CONSTRAINT "ward_cycle_preparations_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_cycle_preparations" ADD CONSTRAINT "ward_cycle_preparations_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_requirements" ADD CONSTRAINT "staffing_requirements_ward_cycle_id_fkey" FOREIGN KEY ("ward_cycle_id") REFERENCES "ward_cycle_preparations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_cycle_external_staff" ADD CONSTRAINT "ward_cycle_external_staff_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "schedule_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_cycle_external_staff" ADD CONSTRAINT "ward_cycle_external_staff_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_cycle_external_staff" ADD CONSTRAINT "ward_cycle_external_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_cycle_external_staff" ADD CONSTRAINT "ward_cycle_external_staff_selected_by_fkey" FOREIGN KEY ("selected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_staff_snapshots" ADD CONSTRAINT "ward_staff_snapshots_ward_cycle_id_fkey" FOREIGN KEY ("ward_cycle_id") REFERENCES "ward_cycle_preparations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_staff_snapshots" ADD CONSTRAINT "ward_staff_snapshots_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_requests" ADD CONSTRAINT "availability_requests_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "schedule_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_requests" ADD CONSTRAINT "availability_requests_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ga_runs" ADD CONSTRAINT "ga_runs_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "schedule_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "schedule_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_ga_run_id_fkey" FOREIGN KEY ("ga_run_id") REFERENCES "ga_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "schedule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_schedule_version_id_fkey" FOREIGN KEY ("schedule_version_id") REFERENCES "schedule_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_manual_changes" ADD CONSTRAINT "schedule_manual_changes_schedule_version_id_fkey" FOREIGN KEY ("schedule_version_id") REFERENCES "schedule_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_manual_changes" ADD CONSTRAINT "schedule_manual_changes_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "schedule_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_manual_changes" ADD CONSTRAINT "schedule_manual_changes_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_compensation_summaries" ADD CONSTRAINT "ward_compensation_summaries_schedule_version_id_fkey" FOREIGN KEY ("schedule_version_id") REFERENCES "schedule_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_compensation_summaries" ADD CONSTRAINT "ward_compensation_summaries_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_summary_items" ADD CONSTRAINT "compensation_summary_items_summary_id_fkey" FOREIGN KEY ("summary_id") REFERENCES "ward_compensation_summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ga_violations" ADD CONSTRAINT "ga_violations_ga_run_id_fkey" FOREIGN KEY ("ga_run_id") REFERENCES "ga_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ga_violations" ADD CONSTRAINT "ga_violations_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ga_violations" ADD CONSTRAINT "ga_violations_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
