import { buildReadinessChecks } from "@/lib/schedule-management/readiness";
import type {
  StaffingRequirements,
  StaffRow,
} from "@/lib/schedule-management/types";

type ReadinessCheckCardProps = {
  staffRows: StaffRow[];
  staffingRequirements: StaffingRequirements | null;
};

export function ReadinessCheckCard({
  staffRows,
  staffingRequirements,
}: ReadinessCheckCardProps) {
  const checks = buildReadinessChecks({
    staffRows,
    staffingRequirements,
  });

  return (
    <section className="h-full rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="font-semibold">5. ตรวจสอบความพร้อมของข้อมูล</h2>

      <div className="mt-5 space-y-3">
        {checks.map((check) => (
          <div
            key={check.id}
            className="flex items-center gap-3 rounded-xl border border-[#E4EEF1] bg-[#F8FDFE] px-4 py-3"
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
