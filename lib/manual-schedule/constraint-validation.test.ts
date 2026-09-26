import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCoverageWarningsFromViolations,
  validateManualScheduleConstraints,
  type ManualConstraintAssignment,
  type ManualConstraintValidationInput,
} from "./constraint-validation.ts";

const staff = {
  rn1: assignment("rn1", "RN 1", "RN"),
  rn2: assignment("rn2", "RN 2", "RN"),
  pn1: assignment("pn1", "PN 1", "PN"),
  pn2: assignment("pn2", "PN 2", "PN"),
  na1: assignment("na1", "NA 1", "NA"),
};

test("recalculates total and category coverage from the current assignments", () => {
  const violations = validateManualScheduleConstraints(
    input({
      assignments: [staff.rn1, staff.pn1],
      rnRequired: 2,
      pnNaRequired: 2,
    }),
  );

  assert.deepEqual(
    violations.map((item) => item.constraintCode).sort(),
    ["coverage_under", "pn_na_coverage_under", "rn_coverage_under"],
  );
  const warnings = buildCoverageWarningsFromViolations(violations);
  assert.equal(warnings.length, 3);
  assert.equal(new Set(warnings.map((warning) => warning.id)).size, 3);
});

test("reports over coverage and accepts an exact staffing composition", () => {
  const exact = validateManualScheduleConstraints(
    input({
      assignments: [staff.rn1, staff.rn2, staff.pn1, staff.na1],
      rnRequired: 2,
      pnNaRequired: 2,
    }),
  );
  assert.equal(exact.length, 0);

  const over = validateManualScheduleConstraints(
    input({
      assignments: [
        staff.rn1,
        staff.rn2,
        staff.pn1,
        staff.na1,
        assignment("rn3", "RN 3", "RN"),
      ],
      rnRequired: 2,
      pnNaRequired: 2,
    }),
  );
  assert.equal(over.some((item) => item.constraintCode === "coverage_over"), true);
});

test("uses holiday staffing on Saturday and Sunday", () => {
  const value = baseInput();
  value.year = 2026;
  value.month = 8;
  value.assignments = [staff.rn1];
  value.requirements = [{
    ...requirement("ช", 1, 0),
    holidayRnRequired: 2,
  }];

  const violations = validateManualScheduleConstraints(value);
  assert.equal(
    violations.some(
      (item) => item.constraintCode === "rn_coverage_under" && item.message.includes("2 คน"),
    ),
    true,
  );
});

test("counts double shifts and OT in every shift that the person covers", () => {
  const doubleShift = { ...staff.rn1, shiftCode: "ช/บ" };
  const otShift = { ...staff.pn1, shiftCode: "ช/บ", otShifts: "บ" };
  const value = baseInput();
  value.assignments = [doubleShift, otShift];
  value.requirements = [
    requirement("ช", 1, 1),
    requirement("บ", 1, 1),
  ];
  value.policy = { allowedDoubleShiftCodes: ["ช/บ"] };

  assert.equal(validateManualScheduleConstraints(value).length, 0);
});

test("reports and highlights the five staff-level hard constraints requested by the UI", () => {
  const value = baseInput();
  value.daysInMonth = 8;
  value.policy = {
    allowedDoubleShiftCodes: ["ด/บ"],
    forbiddenSequences: [["บ", "ด"]],
    maxConsecutiveWorkDays: 2,
    maxConsecutiveNights: 2,
    traineeRuleEnabled: true,
    maxTraineePerShift: 1,
    morningRegularRequired: false,
  };
  value.assignments = [
    { ...assignment("trainee1", "Trainee 1", "RN"), isTrainee: true },
    { ...assignment("trainee2", "Trainee 2", "RN"), isNewNurse: true },
    { ...assignment("sequence", "Sequence", "RN"), day: 1, shiftCode: "บ" },
    { ...assignment("sequence", "Sequence", "RN"), day: 2, shiftCode: "ด" },
    { ...assignment("worker", "Worker", "RN"), day: 1, shiftCode: "ช" },
    { ...assignment("worker", "Worker", "RN"), day: 2, shiftCode: "ช" },
    { ...assignment("worker", "Worker", "RN"), day: 3, shiftCode: "ช" },
    { ...assignment("head", "Head", "RN"), isHead: true, shiftCode: "ด" },
    { ...assignment("night", "Night", "RN"), day: 1, shiftCode: "ด" },
    { ...assignment("night", "Night", "RN"), day: 2, shiftCode: "ด" },
    { ...assignment("night", "Night", "RN"), day: 3, shiftCode: "ด" },
  ];

  const expected = new Set([
    "trainee_per_shift",
    "forbidden_sequence",
    "max_consecutive_work_days",
    "head_invalid_assignment",
    "consecutive_night",
  ]);
  const relevant = validateManualScheduleConstraints(value)
    .filter((violation) => expected.has(violation.constraintCode));

  assert.deepEqual(new Set(relevant.map((violation) => violation.constraintCode)), expected);
  assert.equal(relevant.every((violation) => violation.highlightCell !== false), true);
  assert.equal(relevant.every((violation) => violation.staffId && violation.day), true);
});

test("reports other hard constraints without highlighting schedule cells", () => {
  const value = baseInput();
  value.daysInMonth = 7;
  value.policy = {
    allowedDoubleShiftCodes: [],
    maxShiftsPer7Days: 2,
    traineeRuleEnabled: false,
    morningRegularRequired: true,
  };
  value.assignments = [
    {
      ...assignment("invalid", "Invalid", "RN"),
      day: 1,
      shiftCode: "ช/บ",
      otShifts: "ช/ช/ด",
      allowedWardIds: ["another-ward"],
    },
    { ...assignment("invalid", "Invalid", "RN"), day: 2, shiftCode: "บ" },
  ];

  const expected = new Set([
    "one_shift_per_day",
    "invalid_ward_assignment",
    "weekly_max_shifts",
    "morning_regular_required",
    "ot_shift_must_be_assigned",
    "no_duplicate_regular_ot",
  ]);
  const relevant = validateManualScheduleConstraints(value)
    .filter((violation) => expected.has(violation.constraintCode));

  assert.deepEqual(new Set(relevant.map((violation) => violation.constraintCode)), expected);
  assert.equal(relevant.every((violation) => violation.highlightCell === false), true);
});

test("checks incharge and the PN/NA pair rule", () => {
  const value = input({
    assignments: [staff.rn1, staff.pn1],
    rnRequired: 1,
    pnNaRequired: 1,
  });
  value.requirements[0].requiresIncharge = true;
  value.specialRules = [
    { ruleKey: "pn_na_equal_per_shift", enabled: true, parameters: { minEach: 1 } },
  ];

  const codes = validateManualScheduleConstraints(value).map((item) => item.constraintCode);
  assert.equal(codes.includes("incharge_missing"), true);
  assert.equal(codes.includes("pn_na_equal_per_shift"), true);
});

test("marks the affected staff when ICU and new nurses share a shift", () => {
  const icu = { ...staff.rn1, payPosition: "RNSuC" };
  const newNurse = { ...staff.rn2, isNewNurse: true };
  const value = input({ assignments: [icu, newNurse], rnRequired: 2, pnNaRequired: 0 });
  value.specialRules = [
    { ruleKey: "icu_new_not_together", enabled: true, parameters: {} },
  ];

  const violations = validateManualScheduleConstraints(value).filter(
    (item) => item.constraintCode === "icu_new_not_together",
  );
  assert.deepEqual(violations.map((item) => item.staffId).sort(), ["rn1", "rn2"]);
});

test("treats weekday morning PN as an exact count rather than a minimum", () => {
  const value = input({
    assignments: [staff.rn1, staff.pn1, staff.pn2],
    rnRequired: 1,
    pnNaRequired: 2,
  });
  value.specialRules = [
    { ruleKey: "weekday_morning_pn_exact", enabled: true, parameters: { exactCount: 1 } },
  ];

  const violations = validateManualScheduleConstraints(value).filter(
    (item) => item.constraintCode === "weekday_morning_pn_exact",
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /เท่ากับ 1 คน/);
});

test("checks off and preferred-shift requests against the edited version", () => {
  const value = input({ assignments: [staff.rn1, staff.rn2], rnRequired: 2, pnNaRequired: 0 });
  value.requests = [
    { staffId: "rn1", day: 1, requestType: "Off" },
    { staffId: "rn2", day: 1, requestType: "PreferredShift", preferredShift: "บ" },
  ];

  const violations = validateManualScheduleConstraints(value).filter(
    (item) => item.constraintCode === "requested_off_assignment",
  );
  assert.equal(violations.length, 2);
  assert.deepEqual(violations.map((item) => item.staffId).sort(), ["rn1", "rn2"]);
});

function assignment(
  staffId: string,
  staffLabel: string,
  staffCategory: string,
): ManualConstraintAssignment {
  return {
    staffId,
    staffLabel,
    day: 1,
    shiftCode: "ช",
    otShifts: null,
    staffCategory,
    payPosition: staffCategory,
    isHead: false,
    isTrainee: false,
    isNewNurse: false,
    canBeInCharge: false,
  };
}

function input({
  assignments,
  rnRequired,
  pnNaRequired,
}: {
  assignments: ManualConstraintAssignment[];
  rnRequired: number;
  pnNaRequired: number;
}) {
  const value = baseInput();
  value.assignments = assignments;
  value.requirements = [requirement("ช", rnRequired, pnNaRequired)];
  return value;
}

function baseInput(): ManualConstraintValidationInput {
  return {
    wardId: "ward-1",
    wardLabel: "TEST - Test",
    year: 2026,
    month: 9,
    daysInMonth: 1,
    holidayDays: [],
    assignments: [],
    requirements: [],
    specialRules: [],
    requests: [],
  };
}

function requirement(shiftCode: string, rnRequired: number, pnNaRequired: number) {
  return {
    shiftCode,
    rnRequired,
    pnNaRequired,
    requiresIncharge: false,
    holidayRnRequired: rnRequired,
    holidayPnNaRequired: pnNaRequired,
    holidayRequiresIncharge: false,
  };
}
