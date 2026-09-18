export type TimelineCycleStatus = "preparing" | "open" | "locked";

type CycleStatusDates = {
  requestOpenDate: Date | null;
  dataLockDate: Date | null;
};

export function resolveScheduledCycleStatus(
  cycle: CycleStatusDates,
  now = new Date(),
): TimelineCycleStatus {
  const today = bangkokDateKey(now);
  const lockDate = utcDateKey(cycle.dataLockDate);
  const openDate = utcDateKey(cycle.requestOpenDate);

  if (lockDate && today >= lockDate) return "locked";
  if (openDate && today >= openDate) return "open";
  return "preparing";
}

export function resolveCycleStatus(
  cycle: CycleStatusDates & { status: string },
  now = new Date(),
) {
  if (cycle.status === "generating" || cycle.status === "published") {
    return cycle.status;
  }

  return resolveScheduledCycleStatus(cycle, now);
}

function utcDateKey(date: Date | null) {
  return date?.toISOString().slice(0, 10) ?? null;
}

function bangkokDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
