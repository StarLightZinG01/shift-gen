import assert from "node:assert/strict";
import test from "node:test";

import { buildReadinessChecks } from "./readiness.ts";
import type { SpecialRuleSetting } from "./special-rules.ts";
import type {
  CycleContext,
  ShiftStaffingRequirement,
  StaffRow,
  WardContext,
} from "./types.ts";

const cycle: CycleContext = {
  id: "cycle-1",
  month: 9,
  year: 2569,
  status: "preparing",
  requestOpenDate: null,
  requestCloseDate: null,
  dataLockDate: null,
  autoGenerateAt: null,
  holidays: [],
};

const ward: WardContext = {
  id: "ward-1",
  code: "TEST",
  name: "Test ward",
  isHead: true,
};

function staff(
  id: string,
  code: string,
  category: StaffRow["staffCategory"],
  overrides: Partial<StaffRow> = {},
): StaffRow {
  return {
    id,
    staffId: id,
    rowType: "home",
    code,
    fullName: `Staff ${id}`,
    homeWard: "TEST",
    allowedWards: ["TEST"],
    payPosition: category,
    otRate: "800",
    shiftPayRate: "360",
    off: "0",
    vacation: "0",
    leave: "0",
    academic: "0",
    preferredShifts: "0",
    isHead: false,
    isTrainee: false,
    staffCategory: category,
    isNewNurse: false,
    canBeInCharge: false,
    ...overrides,
  };
}

function requirement(rnRequired: number, pnNaRequired: number): ShiftStaffingRequirement {
  const total = rnRequired + pnNaRequired;
  return {
    min: total,
    max: total,
    rnRequired,
    pnNaRequired,
    requiresIncharge: false,
  };
}

function allRequirements(rnRequired: number, pnNaRequired: number) {
  const value = requirement(rnRequired, pnNaRequired);
  return {
    night: value,
    morning: value,
    afternoon: value,
    holidayNight: value,
    holidayMorning: value,
    holidayAfternoon: value,
  };
}

test("readiness places every warning before passed checks", () => {
  const rows = [
    staff("1", "DUP", "RN", {
      isHead: true,
      off: "5",
      preferredShifts: "5:ช",
    }),
    staff("2", "dup", "PN"),
    staff("3", "NA-1", "NA"),
  ];
  const rules: SpecialRuleSetting[] = [
    {
      ruleKey: "incharge_min_per_shift",
      enabled: true,
      parameters: { minCount: 1 },
    },
  ];

  const checks = buildReadinessChecks({
    staffRows: rows,
    staffingRequirements: allRequirements(4, 1),
    specialRuleSettings: rules,
    cycle,
    ward,
  });
  const warningIds = checks
    .filter((check) => check.status === "warning")
    .map((check) => check.id);
  const firstPassed = checks.findIndex((check) => check.status === "passed");

  assert.ok(warningIds.includes("duplicate-staff-code"));
  assert.ok(warningIds.includes("total-capacity"));
  assert.ok(warningIds.includes("rn-capacity"));
  assert.ok(warningIds.includes("special-rules"));
  assert.ok(warningIds.includes("staff-requests"));
  assert.ok(firstPassed > 0);
  assert.ok(checks.slice(0, firstPassed).every((check) => check.status === "warning"));
  assert.ok(checks.slice(firstPassed).every((check) => check.status === "passed"));
});

test("readiness accepts complete staffing and valid requests", () => {
  const checks = buildReadinessChecks({
    staffRows: [
      staff("1", "RN-1", "RN", { isHead: true, canBeInCharge: true }),
      staff("2", "PN-1", "PN"),
      staff("3", "NA-1", "NA"),
    ],
    staffingRequirements: allRequirements(1, 1),
    specialRuleSettings: [],
    cycle,
    ward,
  });

  assert.ok(checks.every((check) => check.status === "passed"));
});
