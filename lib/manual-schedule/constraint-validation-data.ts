import { mergeStoredSpecialRuleSettings } from "@/lib/schedule-management/special-rules";

import {
  buildManualConstraintPolicy,
  validateManualScheduleConstraints,
  type ManualConstraintValidationInput,
} from "./constraint-validation";
import type { ManualScheduleTransactionClient } from "./versioning";

export async function validateStoredManualSchedule(
  tx: ManualScheduleTransactionClient,
  versionId: string,
  wardId: string,
) {
  const version = await tx.scheduleVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      cycleId: true,
      cycle: {
        select: {
          year: true,
          month: true,
          holidays: { select: { holidayDate: true } },
          availabilityRequests: {
            select: {
              staffId: true,
              requestDate: true,
              requestType: true,
              preferredShift: true,
            },
          },
        },
      },
      wardVersions: {
        where: { wardId },
        select: { ward: { select: { id: true, code: true, name: true } } },
        take: 1,
      },
      assignments: {
        select: {
          staffId: true,
          wardId: true,
          workDate: true,
          shiftCode: true,
          otShifts: true,
          staff: {
            select: {
              fullName: true,
              staffCode: true,
              staffCategory: true,
              position: true,
              payPosition: true,
              isHead: true,
              isTrainee: true,
              isNewNurse: true,
              canBeInCharge: true,
              homeWardId: true,
              wardPermissions: { select: { wardId: true } },
              externalSelections: {
                select: { cycleId: true, wardId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!version) {
    throw new Error("ไม่พบ version ตารางเวร");
  }

  const ward = version.wardVersions[0]?.ward;
  if (!ward) {
    throw new Error("ไม่พบ version ตารางเวรของวอร์ดนี้");
  }

  const preparation = await tx.wardCyclePreparation.findUnique({
    where: { cycleId_wardId: { cycleId: version.cycleId, wardId } },
    select: {
      staffingRequirements: {
        select: {
          shiftCode: true,
          rnRequired: true,
          pnNaRequired: true,
          requiresIncharge: true,
          holidayRnRequired: true,
          holidayPnNaRequired: true,
          holidayRequiresIncharge: true,
        },
      },
      specialRuleSettings: {
        select: { ruleKey: true, enabled: true, parameters: true },
      },
    },
  });
  const gaSettings = await tx.gaSetting.findFirst({
    where: { isActive: true },
    select: {
      enableMorningEveningDouble: true,
      enableNightEveningDouble: true,
      maxConsecutiveWorkDays: true,
      maxConsecutiveNights: true,
      maxTraineePerShift: true,
      maxShiftsPer7Days: true,
      morningRegularRequired: true,
    },
  });

  const input: ManualConstraintValidationInput = {
    wardId,
    wardLabel: `${ward.code} - ${ward.name}`,
    year: normalizeYear(version.cycle.year),
    month: version.cycle.month,
    daysInMonth: new Date(
      normalizeYear(version.cycle.year),
      version.cycle.month,
      0,
    ).getDate(),
    holidayDays: version.cycle.holidays.map((item) => item.holidayDate.getUTCDate()),
    assignments: version.assignments.map((assignment) => ({
      staffId: assignment.staffId,
      staffCode: assignment.staff.staffCode,
      staffLabel: assignment.staff.fullName || assignment.staff.staffCode,
      wardId: assignment.wardId,
      day: assignment.workDate.getUTCDate(),
      shiftCode: assignment.shiftCode,
      otShifts: assignment.otShifts,
      staffCategory: assignment.staff.staffCategory,
      position: assignment.staff.position,
      payPosition: assignment.staff.payPosition,
      isHead: assignment.staff.isHead,
      isTrainee: assignment.staff.isTrainee,
      isNewNurse: assignment.staff.isNewNurse,
      canBeInCharge: assignment.staff.canBeInCharge,
      allowedWardIds: Array.from(new Set([
        assignment.staff.homeWardId,
        ...assignment.staff.wardPermissions.map((permission) => permission.wardId),
        ...assignment.staff.externalSelections
          .filter((selection) => selection.cycleId === version.cycleId)
          .map((selection) => selection.wardId),
      ])),
    })),
    requirements: preparation?.staffingRequirements ?? [],
    specialRules: mergeStoredSpecialRuleSettings(
      ward.code,
      preparation?.specialRuleSettings ?? [],
    ),
    requests: version.cycle.availabilityRequests.map((request) => ({
      staffId: request.staffId,
      day: request.requestDate.getUTCDate(),
      requestType: request.requestType,
      preferredShift: request.preferredShift,
    })),
    policy: buildManualConstraintPolicy(gaSettings),
  };

  return validateManualScheduleConstraints(input);
}

function normalizeYear(year: number) {
  return year > 2400 ? year - 543 : year;
}
