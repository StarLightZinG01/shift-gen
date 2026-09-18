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
      morning: requirement(3, 3),
      afternoon: requirement(2, 2),
      night: requirement(2, 2),
      holidayMorning: requirement(3, 3),
      holidayAfternoon: requirement(2, 2),
      holidayNight: requirement(2, 2),
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
      morning: requirement(6, 6),
      afternoon: requirement(2, 2),
      night: requirement(2, 2),
      holidayMorning: requirement(6, 6),
      holidayAfternoon: requirement(2, 2),
      holidayNight: requirement(2, 2),
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
      morning: requirement(4, 6),
      afternoon: requirement(2, 3),
      night: requirement(2, 3),
      holidayMorning: requirement(4, 6),
      holidayAfternoon: requirement(2, 3),
      holidayNight: requirement(2, 3),
    },
    settings,
    sharedStaffUsage: [],
  });
  const ids = new Set(risks.map((risk) => risk.id));

  assert.equal(ids.has("request-conflict"), true);
  assert.equal(ids.has("preferred-forbidden-sequence"), true);
});

test("detects daily RN and PN/NA capacity shortages by category", () => {
  const staffRows = buildStaff(8).map((row, index) => ({
    ...row,
    staffCategory: (index < 5 ? "RN" : "PN") as StaffRow["staffCategory"],
    off: index < 2 || index === 5 ? "1" : "0",
  }));
  const exact = {
    min: 6,
    max: 6,
    rnRequired: 4,
    pnNaRequired: 2,
    requiresIncharge: false,
  };
  const risks = assessSchedulePreflight({
    cycle,
    staffRows,
    staffingRequirements: {
      morning: exact,
      afternoon: exact,
      night: exact,
      holidayMorning: exact,
      holidayAfternoon: exact,
      holidayNight: exact,
    },
    settings,
    sharedStaffUsage: [],
  });
  const ids = new Set(risks.map((risk) => risk.id));

  assert.equal(ids.has("daily-rn-capacity"), true);
  assert.equal(ids.has("daily-pn-na-capacity"), true);
});

test("detects an odd PN/NA target when pair rule is enabled", () => {
  const staffRows = buildStaff(12).map((row, index) => ({
    ...row,
    staffCategory: (index < 6 ? "RN" : index < 9 ? "PN" : "NA") as StaffRow["staffCategory"],
  }));
  const exact = {
    min: 7,
    max: 7,
    rnRequired: 4,
    pnNaRequired: 3,
    requiresIncharge: false,
  };
  const risks = assessSchedulePreflight({
    cycle,
    staffRows,
    staffingRequirements: {
      morning: exact,
      afternoon: exact,
      night: exact,
      holidayMorning: exact,
      holidayAfternoon: exact,
      holidayNight: exact,
    },
    settings,
    sharedStaffUsage: [],
    specialRuleSettings: [{
      ruleKey: "pn_na_equal_per_shift",
      enabled: true,
      parameters: { minEach: 1 },
    }],
  });

  assert.equal(
    risks.some((risk) => risk.id === "special-pn-na-pair-count-conflict"),
    true,
  );
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
    staffCategory: "RN",
    isNewNurse: false,
    canBeInCharge: index === 0,
  }));
}

function requirement(min: number, max: number) {
  return {
    min,
    max,
    rnRequired: 0,
    pnNaRequired: 0,
    requiresIncharge: false,
  };
}
