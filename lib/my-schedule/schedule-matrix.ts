import type {
  MyScheduleAssignment,
  MyScheduleStaff,
  MyScheduleStaffRow,
} from "@/lib/my-schedule/types";

export function buildScheduleMatrix({
  assignments,
  staff,
  daysInMonth,
}: {
  assignments: MyScheduleAssignment[];
  staff: MyScheduleStaff[];
  daysInMonth: number;
}): MyScheduleStaffRow[] {
  const rows = new Map<string, MyScheduleStaffRow>();

  for (const staffMember of staff) {
    rows.set(staffMember.id, {
      ...staffMember,
      shiftsByDay: buildEmptyDayMap(daysInMonth, "0"),
      otByDay: buildEmptyDayMap(daysInMonth, false),
      otShiftsByDay: buildEmptyDayMap<string | null>(daysInMonth, null),
    });
  }

  for (const assignment of assignments) {
    const row = rows.get(assignment.staffId);
    if (!row) {
      rows.set(assignment.staffId, {
        id: assignment.staffId,
        staffCode: assignment.staffCode,
        fullName: assignment.fullName,
        isHead: assignment.isHead,
        payPosition: assignment.payPosition,
        otRate: assignment.otRate,
        shiftPayRate: assignment.shiftPayRate,
        isCurrentUser: false,
        shiftsByDay: buildEmptyDayMap(daysInMonth, "0"),
        otByDay: buildEmptyDayMap(daysInMonth, false),
        otShiftsByDay: buildEmptyDayMap<string | null>(daysInMonth, null),
      });
    }

    const targetRow = rows.get(assignment.staffId);
    if (!targetRow) {
      continue;
    }

    const normalized = normalizeOtAssignment(
      assignment.shiftCode,
      assignment.isOt,
      assignment.otShifts,
    );
    targetRow.shiftsByDay[assignment.day] = normalized.shiftCode;
    targetRow.otByDay[assignment.day] = normalized.isOt;
    targetRow.otShiftsByDay[assignment.day] = normalized.otShifts;
  }

  return Array.from(rows.values()).sort(compareStaffRows);
}

function compareStaffRows(a: MyScheduleStaffRow, b: MyScheduleStaffRow) {
  if (a.isHead !== b.isHead) {
    return a.isHead ? -1 : 1;
  }

  return a.staffCode.localeCompare(b.staffCode);
}

function buildEmptyDayMap<T>(daysInMonth: number, value: T): Record<number, T> {
  return Array.from({ length: daysInMonth }, (_, index) => index + 1).reduce(
    (result, day) => {
      result[day] = value;
      return result;
    },
    {} as Record<number, T>,
  );
}

function normalizeOtAssignment(
  shiftCode: string,
  isOt: boolean,
  otShifts: string | null,
) {
  const inlineOtShifts = extractInlineOtShifts(shiftCode);
  const normalizedOtShifts = otShifts ?? inlineOtShifts;

  return {
    shiftCode: stripInlineOt(shiftCode),
    isOt: isOt || Boolean(normalizedOtShifts),
    otShifts: normalizedOtShifts,
  };
}

function stripInlineOt(value: string) {
  return (value || "0").replace(/OT/gi, "");
}

function extractInlineOtShifts(value: string) {
  const matches = Array.from((value || "").matchAll(/([^\s/]+?)OT/gi))
    .map((match) => stripInlineOt(match[1]))
    .filter(Boolean);

  if (matches.length === 0) {
    return null;
  }

  return matches.join("/");
}
