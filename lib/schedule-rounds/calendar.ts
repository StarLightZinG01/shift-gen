export function isScheduleHoliday(
  year: number,
  month: number,
  day: number,
  officialHolidayDays: ReadonlySet<number>,
) {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6 || officialHolidayDays.has(day);
}
