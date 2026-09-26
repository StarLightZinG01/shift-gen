import assert from "node:assert/strict";
import test from "node:test";

import { isScheduleHoliday } from "./calendar.ts";

test("treats Saturday and Sunday as schedule holidays", () => {
  const officialHolidays = new Set<number>();

  assert.equal(isScheduleHoliday(2026, 9, 19, officialHolidays), true);
  assert.equal(isScheduleHoliday(2026, 9, 20, officialHolidays), true);
  assert.equal(isScheduleHoliday(2026, 9, 21, officialHolidays), false);
});

test("treats configured public holidays as schedule holidays", () => {
  assert.equal(isScheduleHoliday(2026, 9, 23, new Set([23])), true);
});
