import { getCurrentSession } from "@/lib/auth/current-session";
import {
  getCurrentCycle,
  getExternalStaffCandidates,
  getInactiveStaffRequestWarnings,
  getRequestSummaryRows,
  getSchedulePreflightContext,
  getSpecialRuleSettings,
  getStaffingRequirements,
  getStaffRowsForWard,
  getWardContext,
} from "@/lib/schedule-management/queries";

import { ScheduleManagementView } from "@/components/features/schedule-management/ScheduleManagementView";

export default async function ScheduleManagementPage() {
  const session = await getCurrentSession();
  const ward = session ? await getWardContext(session.userId) : null;
  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <section className="mx-auto mt-10 max-w-xl rounded-lg border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">ไม่มีรอบที่ใช้งานอยู่</h1>
        <p className="mt-2 text-sm text-slate-600">
          กรุณาให้ผู้ดูแลระบบสร้างหรือเปิดรอบจัดตารางก่อนเข้ามาจัดการข้อมูลวอร์ด
        </p>
      </section>
    );
  }
  const staffRows = ward ? await getStaffRowsForWard(ward.id, cycle.id) : [];
  const externalStaffCandidates = ward
    ? await getExternalStaffCandidates(ward.id)
    : [];
  const requestRows = ward ? await getRequestSummaryRows(cycle.id, ward.id) : [];
  const staffingRequirements =
    ward && cycle.id ? await getStaffingRequirements(cycle.id, ward.id) : null;
  const preflight = ward
    ? await getSchedulePreflightContext(cycle.id, ward.id)
    : null;
  const specialRuleSettings = ward
    ? await getSpecialRuleSettings(cycle.id, ward.id, ward.code)
    : [];
  const readinessWarnings = ward
    ? await getInactiveStaffRequestWarnings(cycle.id, ward.id)
    : [];

  return (
    <ScheduleManagementView
      cycle={cycle}
      externalStaffCandidates={externalStaffCandidates}
      requestRows={requestRows}
      staffRows={staffRows}
      staffingRequirements={staffingRequirements}
      preflightSettings={preflight?.settings ?? {
        maxShiftsPer7Days: 10,
        maxConsecutiveWorkDays: 7,
        maxTraineePerShift: 1,
        enableMorningEveningDouble: true,
        enableNightEveningDouble: true,
        morningRegularRequired: true,
      }}
      readinessWarnings={readinessWarnings}
      sharedStaffUsage={preflight?.sharedStaffUsage ?? []}
      specialRuleSettings={specialRuleSettings}
      ward={ward}
    />
  );
}
