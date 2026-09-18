"use client";

import { useScheduleManagementLiveData } from "@/components/features/schedule-management/ScheduleManagementForm";
import { buildWardSummary } from "@/lib/schedule-management/ward-summary";
import type { ShiftRequirementSummary } from "@/lib/schedule-management/ward-summary";
import type { CycleContext, WardContext } from "@/lib/schedule-management/types";

type WardSummaryCardProps = {
  cycle: CycleContext;
  ward: WardContext | null;
};

const SHIFT_ROWS = [
  { key: "night", label: "ดึก" },
  { key: "morning", label: "เช้า" },
  { key: "afternoon", label: "บ่าย" },
] as const;

export function WardSummaryCard({ cycle, ward }: WardSummaryCardProps) {
  const liveData = useScheduleManagementLiveData();
  const summary = buildWardSummary({
    wardCode: ward?.code,
    staffRows: liveData.staffRows,
    staffingRequirements: liveData.staffingRequirements,
    specialRuleSettings: liveData.specialRuleSettings,
    cycle,
    ward,
  });

  return (
    <section className="h-full rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">7. สรุปข้อมูลวอร์ด</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ข้อมูลสำคัญก่อนนำไปจัดตารางเวร
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            summary.readinessStatus === "ready"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {summary.readinessStatusLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <SummaryStat label="บุคลากรทั้งหมด" value={`${summary.totalStaff} คน`} />
        <SummaryStat label="RN" value={`${summary.rnCount} คน`} />
        <SummaryStat label="PN/NA" value={`${summary.pnCount + summary.naCount} คน`} />
        <SummaryStat label="Incharge" value={`${summary.inchargeCount} คน`} />
      </div>

      <div className="mt-5 border-t pt-4">
        <p className="mb-3 text-sm font-semibold">กำลังคนรวมต่อกะ</p>
        <div className="grid grid-cols-[2.5rem_1fr_1fr] text-xs">
          <div />
          <div className="pb-2 text-center font-medium text-muted-foreground">
            วันราชการ
          </div>
          <div className="pb-2 text-center font-medium text-muted-foreground">
            วันหยุด
          </div>
          {SHIFT_ROWS.map((shift) => (
            <div key={shift.key} className="contents">
              <div className="border-t py-2.5 font-medium">{shift.label}</div>
              <ShiftTotal value={summary.shiftRequirements.regular[shift.key]} />
              <ShiftTotal value={summary.shiftRequirements.holiday[shift.key]} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-sm">
        <p className="text-muted-foreground">
          กฎเฉพาะที่เปิด <strong className="text-foreground">{summary.enabledSpecialRules.length} กฎ</strong>
        </p>
        <p className="text-muted-foreground">
          คำขอทั้งหมด <strong className="text-foreground">{summary.requestCounts.total} รายการ</strong>
        </p>
      </div>
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function ShiftTotal({ value }: { value: ShiftRequirementSummary }) {
  return (
    <div className="border-t py-2.5 text-center font-semibold">
      {value.total === null ? "-" : `${value.total} คน`}
    </div>
  );
}
