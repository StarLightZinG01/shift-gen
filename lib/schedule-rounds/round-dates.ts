const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

export function parseDateInput(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!isValidCalendarDate(year, month, day)) return null;

  return new Date(Date.UTC(year, month - 1, day));
}

export function parseBangkokDateTimeInput(value: string) {
  const match = DATE_TIME_PATTERN.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, msText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? 0);
  const millisecond = Number((msText ?? "0").padEnd(3, "0"));
  if (
    !isValidCalendarDate(year, month, day) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond) -
      BANGKOK_OFFSET_MS,
  );
}

export function toBangkokDateTimeInputValue(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}

export function toBangkokDateKey(date: Date) {
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

export function validateScheduleRoundDateOrder(input: {
  requestOpenDate: Date;
  requestCloseDate: Date;
  dataLockDate: Date;
  dataLockDateInput: string;
  autoGenerateAt: Date;
}) {
  if (input.requestOpenDate > input.requestCloseDate) {
    return {
      path: "requestOpenDate" as const,
      message: "วันที่เปิดรับคำขอต้องไม่เกินวันที่ปิดรับคำขอ",
    };
  }
  if (input.requestCloseDate > input.dataLockDate) {
    return {
      path: "requestCloseDate" as const,
      message: "วันที่ปิดรับคำขอต้องไม่เกินวันที่ล็อกข้อมูล",
    };
  }
  if (input.dataLockDateInput > toBangkokDateKey(input.autoGenerateAt)) {
    return {
      path: "dataLockDate" as const,
      message: "วันที่ล็อกข้อมูลต้องไม่เกินวันที่เริ่มจัดตารางด้วย GA",
    };
  }
  return null;
}

export function isSameScheduleRoundPeriod(
  existing: { year: number; month: number },
  submitted: { year: number; month: number },
) {
  return existing.year === submitted.year && existing.month === submitted.month;
}

function isValidCalendarDate(year: number, month: number, day: number) {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
