import { getCurrentSession } from "@/lib/auth/session";
import {
  getCurrentCycle,
  getExternalStaffCandidates,
  getRequestSummaryRows,
  getSchedulePreflightContext,
  getStaffingRequirements,
  getStaffRowsForWard,
  getWardContext,
} from "@/lib/schedule-management/queries";

import { ScheduleManagementView } from "@/components/features/schedule-management/ScheduleManagementView";

export default async function ScheduleManagementPage() {
  const session = await getCurrentSession();
  const ward = session ? await getWardContext(session.userId) : null;
  const cycle = await getCurrentCycle();
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
      sharedStaffUsage={preflight?.sharedStaffUsage ?? []}
      ward={ward}
    />
  );
}
