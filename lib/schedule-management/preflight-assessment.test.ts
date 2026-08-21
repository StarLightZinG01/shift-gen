import assert from "node:assert/strict";
import test from "node:test";

import { assessSchedulePreflight } from "./preflight-assessment.ts";
import type {
  CycleContext,
  PreflightSettings,
  StaffRow,
} from "./types.ts";

const cycle: CycleContext = {
  id: "cycle",
  month: 8,
  year: 2569,
  status: "preparing",
  requestOpenDate: null,
  requestCloseDate: null,
  dataLockDate: null,
  autoGenerateAt: null,
  holidays: [{ date: new Date("2026-08-12T00:00:00.000Z"), label: "วันแม่" }],
};

const settings: PreflightSettings = {
  maxShiftsPer7Days: 10,
  maxConsecutiveWorkDays: 7,
  maxTraineePerShift: 1,
  enableMorningEveningDouble: true,
  enableNightEveningDouble: true,
  morningRegularRequired: true,
};

test("returns no risk block for a comfortably staffed ward", () => {
  const risks = assessSchedulePreflight({
    cycle,
    staffRows: buildStaff(20),
    staffingRequirements: {
      morning: { min: 3, max: 3 },
      afternoon: { min: 2, max: 2 },
      night: { min: 2, max: 2 },
    },
    settings,
    sharedStaffUsage: [],
  });

  assert.deepEqual(risks, []);
});

test("detects daily and weekly capacity shortages", () => {
  const staffRows = buildStaff(5).map((row, index) => ({
    ...row,
    off: index < 2 ? "1,2,3,4,5,6,7" : "0",
  }));
  const risks = assessSchedulePreflight({
    cycle,
    staffRows,
    staffingRequirements: {
      morning: { min: 6, max: 6 },
      afternoon: { min: 2, max: 2 },
      night: { min: 2, max: 2 },
    },
    settings,
    sharedStaffUsage: [],
  });
  const ids = new Set(risks.map((risk) => risk.id));

  assert.equal(ids.has("daily-staff-shortage"), true);
  assert.equal(ids.has("weekly-shift-capacity"), true);
});

test("detects conflicting and forbidden preferred-shift requests", () => {
  const staffRows = buildStaff(12);
  staffRows[1] = {
    ...staffRows[1],
    off: "5",
    preferredShifts: "5:ช, 6:บ, 7:ด",
  };
  const risks = assessSchedulePreflight({
    cycle,
    staffRows,
    staffingRequirements: {
      morning: { min: 4, max: 6 },
      afternoon: { min: 2, max: 3 },
      night: { min: 2, max: 3 },
    },
    settings,
    sharedStaffUsage: [],
  });
  const ids = new Set(risks.map((risk) => risk.id));

  assert.equal(ids.has("request-conflict"), true);
  assert.equal(ids.has("preferred-forbidden-sequence"), true);
});

function buildStaff(count: number): StaffRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index + 1}`,
    staffId: `staff-${index + 1}`,
    rowType: "home" as const,
    code: `N${String(index + 1).padStart(2, "0")}`,
    fullName: `พยาบาล ${index + 1}`,
    homeWard: "TEST",
    allowedWards: ["TEST"],
    payPosition: "RN",
    otRate: "800",
    shiftPayRate: "360",
    off: "0",
    vacation: "0",
    leave: "0",
    academic: "0",
    preferredShifts: "0",
    isHead: index === 0,
    isTrainee: false,
  }));
}
