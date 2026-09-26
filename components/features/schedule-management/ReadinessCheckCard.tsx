"use client";

import { useScheduleManagementLiveData } from "@/components/features/schedule-management/ScheduleManagementForm";
import { buildReadinessChecks } from "@/lib/schedule-management/readiness";
import type { CycleContext, WardContext } from "@/lib/schedule-management/types";

export function ReadinessCheckCard({
  cycle,
  ward,
  readinessWarnings,
}: {
  cycle: CycleContext;
  ward: WardContext | null;
  readinessWarnings: string[];
}) {
  const liveData = useScheduleManagementLiveData();
  const checks = buildReadinessChecks({
    ...liveData,
    cycle,
    ward,
    externalWarnings: readinessWarnings,
  });

  return (
    <section className="flex h-full max-h-[520px] min-h-0 flex-col rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-semibold">6. ตรวจสอบความพร้อมของข้อมูล</h2>

      <div className="mt-4 min-h-0 space-y-2 overflow-y-auto pr-1">
        {checks.map((check) => (
          <div
            key={check.id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
              check.status === "passed"
                ? "border-[#E4EEF1] bg-[#F8FDFE]"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <span
              className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                check.status === "passed"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {check.status === "passed" ? "✓" : "!"}
            </span>
            <span
              className={`text-sm font-medium ${
                check.status === "passed"
                  ? "text-[#0F172A]"
                  : "text-amber-900"
              }`}
            >
              {check.message}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
