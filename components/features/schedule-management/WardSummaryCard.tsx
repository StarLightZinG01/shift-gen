import { buildWardSummary } from "@/lib/schedule-management/ward-summary";
import type { ReactNode } from "react";
import type {
  RequestSummaryRow,
  StaffingRequirements,
  StaffRow,
  WardContext,
} from "@/lib/schedule-management/types";

type WardSummaryCardProps = {
  ward: WardContext | null;
  staffRows: StaffRow[];
  requestRows: RequestSummaryRow[];
  staffingRequirements: StaffingRequirements | null;
};

export function WardSummaryCard({
  ward,
  staffRows,
  requestRows,
  staffingRequirements,
}: WardSummaryCardProps) {
  const summary = buildWardSummary({
    wardCode: ward?.code,
    staffRows,
    requestRows,
    staffingRequirements,
  });

  return (
    <section className="flex h-full max-h-[410px] min-h-0 flex-col rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">6. สรุปข้อมูลวอร์ด</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ภาพรวมข้อมูลก่อนนำไปจัดตารางเวร
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

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-4">
          <SummaryGroup>
            <SummaryRow label="บุคลากรทั้งหมด" value={`${summary.totalStaff} คน`} />
            <SummaryRow label="หัวหน้าวอร์ด" value={`${summary.headCount} คน`} />
            <SummaryRow
              label="พยาบาลฝึกหัด"
              value={`${summary.traineeCount} คน`}
            />
            <SummaryRow
              label="บุคลากรช่วยวอร์ดนี้"
              value={`${summary.externalStaffCount} คน`}
            />
          </SummaryGroup>

          <SummaryGroup title="กำลังคนต่อกะ">
            <SummaryRow label="เช้า" value={summary.shiftRequirements.morning} />
            <SummaryRow label="บ่าย" value={summary.shiftRequirements.afternoon} />
            <SummaryRow label="ดึก" value={summary.shiftRequirements.night} />
          </SummaryGroup>

          <SummaryGroup>
            <SummaryRow
              label="คำขอวันลา/ไม่สะดวก"
              value={`${summary.requestCount} รายการ`}
            />
            <SummaryRow label="สถานะข้อมูล" value={summary.readinessStatusLabel} />
          </SummaryGroup>
        </div>
      </div>
    </section>
  );
}

function SummaryGroup({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-[#E4EEF1] bg-[#F8FDFE] p-4">
      {title ? (
        <p className="mb-3 text-sm font-semibold text-[#0F172A]">{title}</p>
      ) : null}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold text-[#0F172A]">{value}</span>
    </div>
  );
}
