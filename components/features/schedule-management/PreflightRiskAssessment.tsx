"use client";

import { Alert02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { useScheduleManagementLiveData } from "@/components/features/schedule-management/ScheduleManagementForm";
import { assessSchedulePreflight } from "@/lib/schedule-management/preflight-assessment";
import type {
  CycleContext,
  PreflightSettings,
  SharedStaffUsage,
} from "@/lib/schedule-management/types";

type PreflightRiskAssessmentProps = {
  cycle: CycleContext;
  settings: PreflightSettings;
  sharedStaffUsage: SharedStaffUsage[];
};

export function PreflightRiskAssessment({
  cycle,
  settings,
  sharedStaffUsage,
}: PreflightRiskAssessmentProps) {
  const liveData = useScheduleManagementLiveData();
  const risks = assessSchedulePreflight({
    cycle,
    staffRows: liveData.staffRows,
    staffingRequirements: liveData.staffingRequirements,
    settings,
    sharedStaffUsage,
  });

  if (risks.length === 0) {
    return null;
  }

  const criticalCount = risks.filter((risk) => risk.severity === "critical").length;
  const warningCount = risks.length - criticalCount;

  return (
    <section
      aria-live="polite"
      className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-amber-100 bg-amber-50/70 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <HugeiconsIcon icon={Alert02Icon} size={19} strokeWidth={2} />
          </span>
          <div>
            <h2 className="font-semibold text-amber-950">
              ประเมินความเสี่ยงก่อนจัดตาราง
            </h2>
            <p className="mt-1 text-sm text-amber-900/75">
              เป็นการประเมินเบื้องต้นจากข้อมูลปัจจุบัน ผลจริงขึ้นอยู่กับการค้นหาคำตอบของ GA
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {criticalCount > 0 ? (
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
              มีแนวโน้มจัดไม่ได้ {criticalCount} รายการ
            </span>
          ) : null}
          {warningCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              ควรตรวจสอบ {warningCount} รายการ
            </span>
          ) : null}
        </div>
      </div>

      <div className="max-h-[520px] divide-y overflow-y-auto">
        {risks.map((risk) => {
          const critical = risk.severity === "critical";
          return (
            <article
              key={risk.id}
              className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(320px,1.3fr)]"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full ${
                    critical
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <HugeiconsIcon
                    icon={critical ? Alert02Icon : InformationCircleIcon}
                    size={15}
                    strokeWidth={2}
                  />
                </span>
                <div>
                  <span
                    className={`text-xs font-semibold ${
                      critical ? "text-red-700" : "text-amber-700"
                    }`}
                  >
                    {critical ? "มีแนวโน้มจัดไม่ได้" : "ควรตรวจสอบ"}
                  </span>
                  <h3 className="mt-0.5 text-sm font-semibold text-[#0F172A]">
                    {risk.title}
                  </h3>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="leading-6 text-muted-foreground">{risk.message}</p>
                <div className="rounded-lg bg-[#F3FAFB] px-3 py-2.5 leading-6 text-[#164E52]">
                  <span className="font-semibold">คำแนะนำ: </span>
                  {risk.recommendation}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
