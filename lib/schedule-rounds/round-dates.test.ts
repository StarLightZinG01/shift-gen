import assert from "node:assert/strict";
import test from "node:test";

import {
  isSameScheduleRoundPeriod,
  parseBangkokDateTimeInput,
  parseDateInput,
  toBangkokDateKey,
  toBangkokDateTimeInputValue,
  validateScheduleRoundDateOrder,
} from "./round-dates.ts";

test("rejects normalized and malformed calendar dates", () => {
  assert.equal(parseDateInput("2026-02-29"), null);
  assert.equal(parseDateInput("2026-02-31"), null);
  assert.equal(parseDateInput("2026-13-01"), null);
  assert.equal(parseDateInput("2026-2-01"), null);
  assert.equal(parseDateInput("not-a-date"), null);
});

test("accepts real calendar dates including leap day", () => {
  assert.equal(parseDateInput("2028-02-29")?.toISOString(), "2028-02-29T00:00:00.000Z");
  assert.equal(parseDateInput("2026-09-23")?.toISOString(), "2026-09-23T00:00:00.000Z");
});

test("parses datetime-local as Bangkok time independently of server timezone", () => {
  const date = parseBangkokDateTimeInput("2026-09-25T14:26");
  assert.equal(date?.toISOString(), "2026-09-25T07:26:00.000Z");
  assert.equal(toBangkokDateTimeInputValue(date), "2026-09-25T14:26");
  assert.equal(toBangkokDateKey(date!), "2026-09-25");
});

test("rejects invalid datetime-local values", () => {
  assert.equal(parseBangkokDateTimeInput("2026-02-31T14:26"), null);
  assert.equal(parseBangkokDateTimeInput("2026-09-25T24:00"), null);
  assert.equal(parseBangkokDateTimeInput("2026-09-25T14:60"), null);
  assert.equal(parseBangkokDateTimeInput("2026-09-25"), null);
});

test("validates the schedule date order using the Bangkok GA date", () => {
  const valid = validateScheduleRoundDateOrder({
    requestOpenDate: parseDateInput("2026-08-01")!,
    requestCloseDate: parseDateInput("2026-08-20")!,
    dataLockDate: parseDateInput("2026-08-25")!,
    dataLockDateInput: "2026-08-25",
    autoGenerateAt: parseBangkokDateTimeInput("2026-08-25T00:30")!,
  });
  assert.equal(valid, null);

  const invalid = validateScheduleRoundDateOrder({
    requestOpenDate: parseDateInput("2026-08-20")!,
    requestCloseDate: parseDateInput("2026-08-19")!,
    dataLockDate: parseDateInput("2026-08-25")!,
    dataLockDateInput: "2026-08-25",
    autoGenerateAt: parseBangkokDateTimeInput("2026-08-26T09:00")!,
  });
  assert.equal(invalid?.path, "requestOpenDate");
});

test("keeps the month and year of an existing cycle immutable", () => {
  assert.equal(
    isSameScheduleRoundPeriod({ year: 2569, month: 9 }, { year: 2569, month: 9 }),
    true,
  );
  assert.equal(
    isSameScheduleRoundPeriod({ year: 2569, month: 9 }, { year: 2569, month: 10 }),
    false,
  );
  assert.equal(
    isSameScheduleRoundPeriod({ year: 2569, month: 9 }, { year: 2570, month: 9 }),
    false,
  );
});
