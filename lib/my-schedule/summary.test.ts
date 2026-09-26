import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateActualScheduleSummary,
  countScheduleWorkUnits,
} from "./summary.ts";

function date(day: number) {
  return new Date(Date.UTC(2026, 8, day));
}

test("counts unassigned calendar days as actual off days", () => {
  const assignments = Array.from({ length: 22 }, (_, index) => ({
    workDate: date(index + 1),
    shiftCode: "ช",
  }));

  assert.deepEqual(
    calculateActualScheduleSummary({ assignments, requests: [], daysInMonth: 30 }),
    { shiftCount: 22, offCount: 8, vacationCount: 0, leaveCount: 0 },
  );
});

test("counts double shifts as two shifts but one worked calendar day", () => {
  assert.deepEqual(
    calculateActualScheduleSummary({
      assignments: [{ workDate: date(1), shiftCode: "ช/บ" }],
      requests: [],
      daysInMonth: 3,
    }),
    { shiftCount: 2, offCount: 2, vacationCount: 0, leaveCount: 0 },
  );
});

test("counts the published CARDIO shift pattern as 25 shifts", () => {
  const shiftCodes = [
    "ด/บ", "ชOT", "ด", "ชOT", "ด/บ", "ช", "ด/บ", "ชOT", "ช", "ด/บ",
    "บ", "ช", "ด", "ช", "ด", "ด/บ", "ช", "ช", "ช", "ด",
  ];

  assert.equal(
    shiftCodes.reduce((total, shiftCode) => total + countScheduleWorkUnits(shiftCode), 0),
    25,
  );
});

test("separates vacation and leave from actual off days", () => {
  assert.deepEqual(
    calculateActualScheduleSummary({
      assignments: [{ workDate: date(1), shiftCode: "ด" }],
      requests: [
        { requestDate: date(2), requestType: "V" },
        { requestDate: date(3), requestType: "ล" },
        { requestDate: date(1), requestType: "V" },
      ],
      daysInMonth: 4,
    }),
    { shiftCount: 1, offCount: 1, vacationCount: 1, leaveCount: 1 },
  );
});
