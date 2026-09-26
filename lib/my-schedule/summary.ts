type SummaryAssignment = {
  workDate: Date;
  shiftCode: string;
};

type SummaryRequest = {
  requestDate: Date;
  requestType: string;
};

export function calculateActualScheduleSummary({
  assignments,
  requests,
  daysInMonth,
}: {
  assignments: SummaryAssignment[];
  requests: SummaryRequest[];
  daysInMonth: number;
}) {
  const workedDays = new Set<number>();
  let shiftCount = 0;

  for (const assignment of assignments) {
    const workUnits = countScheduleWorkUnits(assignment.shiftCode);
    shiftCount += workUnits;

    if (workUnits > 0) {
      workedDays.add(assignment.workDate.getUTCDate());
    }
  }

  const vacationDays = requestDays(requests, "v", workedDays, daysInMonth);
  const leaveDays = requestDays(requests, "ล", workedDays, daysInMonth);
  const nonOffDays = new Set([...workedDays, ...vacationDays, ...leaveDays]);

  return {
    shiftCount,
    offCount: Math.max(daysInMonth - nonOffDays.size, 0),
    vacationCount: vacationDays.size,
    leaveCount: leaveDays.size,
  };
}

export function countScheduleWorkUnits(value: string) {
  const normalized = value.trim().replace(/\s|OT/gi, "");

  if (!normalized || normalized === "0" || normalized === "V" || normalized === "ล") {
    return 0;
  }

  const parts = normalized.includes("/")
    ? normalized.split("/").filter(Boolean)
    : normalized === "ชบ"
      ? ["ช", "บ"]
      : normalized === "ดบ"
        ? ["ด", "บ"]
        : [normalized];

  return parts.filter((part) => ["ช", "บ", "ด", "ว"].includes(part)).length;
}

function requestDays(
  requests: SummaryRequest[],
  type: string,
  workedDays: Set<number>,
  daysInMonth: number,
) {
  return new Set(
    requests
      .filter((request) => request.requestType.trim().toLowerCase() === type)
      .map((request) => request.requestDate.getUTCDate())
      .filter(
        (day) => day >= 1 && day <= daysInMonth && !workedDays.has(day),
      ),
  );
}
