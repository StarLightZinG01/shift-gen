import type {
  CoverageWarning,
  ManualScheduleViolation,
} from "./types";

const WORK_SHIFTS = ["ช", "บ", "ด"] as const;
type WorkShift = (typeof WORK_SHIFTS)[number];

export type ManualConstraintAssignment = {
  staffId: string;
  staffCode?: string;
  staffLabel: string;
  wardId?: string;
  day: number;
  shiftCode: string;
  otShifts?: string | null;
  staffCategory: string;
  position?: string | null;
  payPosition?: string | null;
  isHead?: boolean;
  isTrainee?: boolean;
  isNewNurse: boolean;
  canBeInCharge: boolean;
  allowedWardIds?: string[];
};

export type ManualConstraintRequirement = {
  shiftCode: string;
  rnRequired: number;
  pnNaRequired: number;
  requiresIncharge: boolean;
  holidayRnRequired: number;
  holidayPnNaRequired: number;
  holidayRequiresIncharge: boolean;
};

export type ManualConstraintSpecialRule = {
  ruleKey: string;
  enabled: boolean;
  parameters: unknown;
};

export type ManualConstraintRequest = {
  staffId: string;
  day: number;
  requestType: string;
  preferredShift?: string | null;
};

export type ManualConstraintPolicy = {
  allowedDoubleShiftCodes?: string[];
  forbiddenSequences?: Array<[string, string]>;
  maxConsecutiveWorkDays?: number;
  maxConsecutiveNights?: number;
  traineeRuleEnabled?: boolean;
  maxTraineePerShift?: number;
  maxShiftsPer7Days?: number;
  morningRegularRequired?: boolean;
};

export type ManualConstraintValidationInput = {
  wardId: string;
  wardLabel: string;
  year: number;
  month: number;
  daysInMonth: number;
  holidayDays: number[];
  assignments: ManualConstraintAssignment[];
  requirements: ManualConstraintRequirement[];
  specialRules: ManualConstraintSpecialRule[];
  requests: ManualConstraintRequest[];
  policy?: ManualConstraintPolicy;
};

export function buildManualConstraintPolicy(settings: {
  enableMorningEveningDouble: boolean;
  enableNightEveningDouble: boolean;
  maxConsecutiveWorkDays: number;
  maxConsecutiveNights: number;
  maxTraineePerShift: number;
  maxShiftsPer7Days: number;
  morningRegularRequired: boolean;
} | null | undefined): ManualConstraintPolicy {
  return {
    allowedDoubleShiftCodes: [
      ...(settings?.enableMorningEveningDouble ? ["ช/บ"] : []),
      ...(settings?.enableNightEveningDouble ? ["ด/บ"] : []),
    ],
    forbiddenSequences: [["บ", "ด"]],
    maxConsecutiveWorkDays: settings?.maxConsecutiveWorkDays ?? 7,
    maxConsecutiveNights: settings?.maxConsecutiveNights ?? 2,
    traineeRuleEnabled: true,
    maxTraineePerShift: settings?.maxTraineePerShift ?? 1,
    maxShiftsPer7Days: settings?.maxShiftsPer7Days ?? 10,
    morningRegularRequired: settings?.morningRegularRequired ?? true,
  };
}

export function validateManualScheduleConstraints(
  input: ManualConstraintValidationInput,
): ManualScheduleViolation[] {
  const violations: ManualScheduleViolation[] = [];
  const holidayDays = new Set(input.holidayDays);
  const requirementByShift = new Map(
    input.requirements.map((requirement) => [
      normalizeRequirementShift(requirement.shiftCode),
      requirement,
    ]),
  );
  const activeRules = new Map(
    input.specialRules
      .filter((rule) => rule.enabled)
      .map((rule) => [rule.ruleKey, rule]),
  );
  const wardAssignments = input.assignments.filter(
    (assignment) => (assignment.wardId ?? input.wardId) === input.wardId,
  );
  const assignmentsByDayShift = indexAssignmentsByDayShift(wardAssignments);

  for (let day = 1; day <= input.daysInMonth; day += 1) {
    const isHoliday = isHolidayDay(input.year, input.month, day, holidayDays);

    for (const shiftCode of WORK_SHIFTS) {
      const shiftAssignments = assignmentsByDayShift.get(`${day}:${shiftCode}`) ?? [];
      const requirement = requirementByShift.get(shiftCode);

      if (requirement) {
        const rnRequired = isHoliday
          ? requirement.holidayRnRequired
          : requirement.rnRequired;
        const pnNaRequired = isHoliday
          ? requirement.holidayPnNaRequired
          : requirement.pnNaRequired;
        const totalRequired = rnRequired + pnNaRequired;
        const rnCount = countCategory(shiftAssignments, "RN");
        const pnNaCount =
          countCategory(shiftAssignments, "PN") + countCategory(shiftAssignments, "NA");

        if (shiftAssignments.length < totalRequired) {
          violations.push(
            wardViolation(
              input,
              day,
              "coverage_under",
              `วันที่ ${day} เวร ${shiftCode} มีกำลังคน ${shiftAssignments.length} คน ต่ำกว่าที่กำหนด ${totalRequired} คน`,
              shiftCode,
            ),
          );
        } else if (shiftAssignments.length > totalRequired) {
          violations.push(
            wardViolation(
              input,
              day,
              "coverage_over",
              `วันที่ ${day} เวร ${shiftCode} มีกำลังคน ${shiftAssignments.length} คน เกินกว่าที่กำหนด ${totalRequired} คน`,
              shiftCode,
            ),
          );
        }

        if (rnCount < rnRequired) {
          violations.push(
            wardViolation(
              input,
              day,
              "rn_coverage_under",
              `วันที่ ${day} เวร ${shiftCode} มี RN ${rnCount} คน ต่ำกว่าที่กำหนด ${rnRequired} คน`,
              shiftCode,
            ),
          );
        }

        if (pnNaCount < pnNaRequired) {
          violations.push(
            wardViolation(
              input,
              day,
              "pn_na_coverage_under",
              `วันที่ ${day} เวร ${shiftCode} มี PN/NA ${pnNaCount} คน ต่ำกว่าที่กำหนด ${pnNaRequired} คน`,
              shiftCode,
            ),
          );
        }

        const requiresIncharge = isHoliday
          ? requirement.holidayRequiresIncharge
          : requirement.requiresIncharge;
        if (requiresIncharge && !shiftAssignments.some((item) => item.canBeInCharge)) {
          violations.push(
            wardViolation(
              input,
              day,
              "incharge_missing",
              `วันที่ ${day} เวร ${shiftCode} ไม่มีบุคลากรที่เป็น Incharge`,
              shiftCode,
            ),
          );
        }
      }

      validateSpecialRulesForShift({
        input,
        activeRules,
        day,
        shiftCode,
        shiftAssignments,
        isHoliday,
        violations,
      });
    }
  }

  validateRequests(input, violations);
  validateRemainingHardConstraints(input, violations);

  return violations.sort(compareViolations);
}

export function buildCoverageWarningsFromViolations(
  violations: ManualScheduleViolation[],
): CoverageWarning[] {
  const coverageCodes = new Set([
    "coverage_under",
    "coverage_over",
    "rn_coverage_under",
    "pn_na_coverage_under",
  ]);
  const warnings = new Map<string, CoverageWarning>();

  for (const violation of violations) {
    if (!violation.day || !coverageCodes.has(violation.constraintCode)) continue;
    const shiftCode = readShiftFromViolationId(violation.id);
    if (!shiftCode) continue;
    warnings.set(`${violation.day}:${shiftCode}:${violation.constraintCode}`, {
      id: `coverage:${violation.day}:${shiftCode}:${violation.constraintCode}`,
      day: violation.day,
      shiftCode,
      message: violation.message,
    });
  }

  return [...warnings.values()].sort(
    (a, b) => a.day - b.day || WORK_SHIFTS.indexOf(a.shiftCode as WorkShift) - WORK_SHIFTS.indexOf(b.shiftCode as WorkShift),
  );
}

export function formatManualConstraintLabel(code: string) {
  const labels: Record<string, string> = {
    coverage_under: "กำลังคนต่ำกว่าที่กำหนด",
    coverage_over: "กำลังคนเกินที่กำหนด",
    rn_coverage_under: "จำนวน RN ต่ำกว่าที่กำหนด",
    pn_na_coverage_under: "จำนวน PN/NA ต่ำกว่าที่กำหนด",
    incharge_missing: "ไม่มี Incharge ประจำกะ",
    incharge_min_per_shift: "ทุกกะต้องมี RN.Incharge",
    icu_new_not_together: "RN ICU/RNSuC และ RN new ไม่ขึ้นเวรด้วยกัน",
    sunday_morning_rn_exact: "วันอาทิตย์เวรเช้า ต้องมี RN ตามจำนวนที่กำหนด",
    morning_rn_by_day: "RN เวรเช้า แยกจำนวนตามวันราชการและวันหยุด",
    weekday_morning_pn_exact: "วันราชการเวรเช้าต้องมี PN ตามจำนวนที่กำหนด",
    pn_na_equal_per_shift: "แต่ละเวรต้องมี PN และ NA คู่กันในจำนวนเท่ากัน",
    requested_off_assignment: "จัดเวรไม่ตรงตามคำขอ",
    one_shift_per_day: "รูปแบบเวรควบไม่ถูกต้อง",
    invalid_ward_assignment: "จัดบุคลากรไปวอร์ดที่ไม่ได้รับอนุญาต",
    weekly_max_shifts: "จำนวนกะในช่วง 7 วันเกินกำหนด",
    trainee_per_shift: "พยาบาลใหม่/ฝึกหัดในกะเกินกำหนด",
    forbidden_sequence: "ลำดับเวรต้องห้าม",
    max_consecutive_work_days: "ทำงานติดต่อกันเกินกำหนด",
    head_invalid_assignment: "การจัดเวรหัวหน้าวอร์ดไม่ถูกต้อง",
    morning_regular_required: "เวรเช้าวันราชการไม่มีเวรปกติ",
    ot_shift_must_be_assigned: "ระบุ OT ในกะที่ไม่ได้ขึ้นเวร",
    no_duplicate_regular_ot: "กะเดียวกันซ้ำเป็นเวรปกติและ OT",
    consecutive_night: "เวรดึกติดต่อกันเกินกำหนด",
  };

  return labels[code] ?? code;
}

function validateSpecialRulesForShift({
  input,
  activeRules,
  day,
  shiftCode,
  shiftAssignments,
  isHoliday,
  violations,
}: {
  input: ManualConstraintValidationInput;
  activeRules: Map<string, ManualConstraintSpecialRule>;
  day: number;
  shiftCode: WorkShift;
  shiftAssignments: ManualConstraintAssignment[];
  isHoliday: boolean;
  violations: ManualScheduleViolation[];
}) {
  const inchargeRule = activeRules.get("incharge_min_per_shift");
  if (inchargeRule) {
    const minimum = readRuleNumber(inchargeRule.parameters, "minCount", 1);
    const count = shiftAssignments.filter((item) => item.canBeInCharge).length;
    if (count < minimum) {
      violations.push(
        wardViolation(
          input,
          day,
          "incharge_min_per_shift",
          `วันที่ ${day} เวร ${shiftCode} มี Incharge ${count} คน ต่ำกว่าที่กำหนด ${minimum} คน`,
          shiftCode,
        ),
      );
    }
  }

  if (activeRules.has("icu_new_not_together")) {
    const icuStaff = shiftAssignments.filter(isIcuStaff);
    const newNurses = shiftAssignments.filter((item) => item.isNewNurse);
    if (icuStaff.length > 0 && newNurses.length > 0) {
      for (const assignment of uniqueAssignments([...icuStaff, ...newNurses])) {
        violations.push(
          staffViolation(
            input,
            assignment,
            day,
            "icu_new_not_together",
            `วันที่ ${day} เวร ${shiftCode} มี RN ICU/RNSuC และ RN new ขึ้นเวรร่วมกัน`,
            shiftCode,
          ),
        );
      }
    }
  }

  const weekday = new Date(Date.UTC(normalizeYear(input.year), input.month - 1, day)).getUTCDay();
  const rnCount = countCategory(shiftAssignments, "RN");

  const sundayRule = activeRules.get("sunday_morning_rn_exact");
  if (sundayRule && weekday === 0 && shiftCode === "ช") {
    const exact = readRuleNumber(sundayRule.parameters, "exactCount", 4);
    if (rnCount !== exact) {
      violations.push(
        wardViolation(
          input,
          day,
          "sunday_morning_rn_exact",
          `วันที่ ${day} เวรเช้ามี RN ${rnCount} คน ต้องจัดให้เท่ากับ ${exact} คน`,
          shiftCode,
        ),
      );
    }
  }

  const morningRnRule = activeRules.get("morning_rn_by_day");
  if (morningRnRule && shiftCode === "ช") {
    let exact: number | null = null;
    if (isHoliday) {
      exact = readRuleNumber(morningRnRule.parameters, "holiday", 4);
    } else if (weekday === 1 || weekday === 3) {
      exact = readRuleNumber(morningRnRule.parameters, "mondayWednesday", 7);
    } else if (weekday === 2 || weekday === 4 || weekday === 5) {
      exact = readRuleNumber(morningRnRule.parameters, "tuesdayThursdayFriday", 6);
    }
    if (exact !== null && rnCount !== exact) {
      violations.push(
        wardViolation(
          input,
          day,
          "morning_rn_by_day",
          `วันที่ ${day} เวรเช้ามี RN ${rnCount} คน ต้องจัดให้เท่ากับ ${exact} คน`,
          shiftCode,
        ),
      );
    }
  }

  const weekdayPnRule = activeRules.get("weekday_morning_pn_exact");
  if (weekdayPnRule && !isHoliday && shiftCode === "ช") {
    const exact = readRuleNumber(weekdayPnRule.parameters, "exactCount", 1);
    const pnCount = countCategory(shiftAssignments, "PN");
    if (pnCount !== exact) {
      violations.push(
        wardViolation(
          input,
          day,
          "weekday_morning_pn_exact",
          `วันที่ ${day} เวรเช้ามี PN ${pnCount} คน ต้องจัดให้เท่ากับ ${exact} คน`,
          shiftCode,
        ),
      );
    }
  }

  const pairRule = activeRules.get("pn_na_equal_per_shift");
  if (pairRule) {
    const minimum = readRuleNumber(pairRule.parameters, "minEach", 1);
    const pnCount = countCategory(shiftAssignments, "PN");
    const naCount = countCategory(shiftAssignments, "NA");
    if (pnCount < minimum || naCount < minimum || pnCount !== naCount) {
      violations.push(
        wardViolation(
          input,
          day,
          "pn_na_equal_per_shift",
          `วันที่ ${day} เวร ${shiftCode} มี PN ${pnCount} คน และ NA ${naCount} คน ต้องมีอย่างน้อยประเภทละ ${minimum} คนและจำนวนเท่ากัน`,
          shiftCode,
        ),
      );
    }
  }
}

function validateRequests(
  input: ManualConstraintValidationInput,
  violations: ManualScheduleViolation[],
) {
  const assignmentByStaffDay = new Map(
    input.assignments
      .filter((assignment) => (assignment.wardId ?? input.wardId) === input.wardId)
      .map((assignment) => [
        `${assignment.staffId}:${assignment.day}`,
        assignment,
      ]),
  );

  for (const request of input.requests) {
    const assignment = assignmentByStaffDay.get(`${request.staffId}:${request.day}`);
    if (!assignment) continue;
    const normalizedType = request.requestType.trim().toLowerCase();
    const expectedCode = requestCode(normalizedType);
    const actualCode = assignment.shiftCode.trim();
    const assignedShifts = getAssignmentWorkShifts(assignment);
    const preferredShifts = splitWorkShifts(request.preferredShift);
    const isPreferred = normalizedType === "preferredshift" || normalizedType === "preferred_shift";
    if (!isPreferred && expectedCode === null) continue;
    const matches = isPreferred
      ? preferredShifts.length > 0 && preferredShifts.every((shift) => assignedShifts.includes(shift))
      : expectedCode === actualCode;

    if (!matches) {
      const expectation = expectedCode ?? request.preferredShift ?? "คำขอ";
      violations.push(
        staffViolation(
          input,
          assignment,
          request.day,
          "requested_off_assignment",
          `วันที่ ${request.day} ${assignment.staffLabel} ได้เวร ${actualCode || "0"} ไม่ตรงกับคำขอ ${expectation}`,
          assignedShifts[0] ?? "request",
        ),
      );
    }
  }
}

function validateRemainingHardConstraints(
  input: ManualConstraintValidationInput,
  violations: ManualScheduleViolation[],
) {
  const policy = {
    allowedDoubleShiftCodes: input.policy?.allowedDoubleShiftCodes ?? [],
    forbiddenSequences: input.policy?.forbiddenSequences ?? [["บ", "ด"] as [string, string]],
    maxConsecutiveWorkDays: input.policy?.maxConsecutiveWorkDays ?? 7,
    maxConsecutiveNights: input.policy?.maxConsecutiveNights ?? 2,
    traineeRuleEnabled: input.policy?.traineeRuleEnabled ?? true,
    maxTraineePerShift: input.policy?.maxTraineePerShift ?? 1,
    maxShiftsPer7Days: input.policy?.maxShiftsPer7Days ?? 10,
    morningRegularRequired: input.policy?.morningRegularRequired ?? true,
  };
  const wardAssignments = input.assignments.filter(
    (assignment) => (assignment.wardId ?? input.wardId) === input.wardId,
  );
  const selectedStaffIds = new Set(wardAssignments.map((assignment) => assignment.staffId));
  const assignmentsByDayShift = indexAssignmentsByDayShift(wardAssignments);
  const assignmentsByStaff = new Map<string, ManualConstraintAssignment[]>();

  for (const assignment of input.assignments) {
    if (!selectedStaffIds.has(assignment.staffId)) continue;
    assignmentsByStaff.set(assignment.staffId, [
      ...(assignmentsByStaff.get(assignment.staffId) ?? []),
      assignment,
    ]);
  }

  if (policy.traineeRuleEnabled) {
    for (let day = 1; day <= input.daysInMonth; day += 1) {
      for (const shiftCode of WORK_SHIFTS) {
        const trainees = (assignmentsByDayShift.get(`${day}:${shiftCode}`) ?? [])
          .filter((assignment) => assignment.isTrainee || assignment.isNewNurse);
        if (trainees.length <= policy.maxTraineePerShift) continue;

        for (const assignment of uniqueAssignments(trainees)) {
          violations.push(staffViolation(
            input,
            assignment,
            day,
            "trainee_per_shift",
            `วันที่ ${day} เวร ${shiftCode} มีพยาบาลใหม่/ฝึกหัด ${trainees.length} คน เกินกำหนด ${policy.maxTraineePerShift} คน`,
            shiftCode,
          ));
        }
      }
    }
  }

  const allowedDoublePairs = new Set(
    policy.allowedDoubleShiftCodes.map((code) => shiftPairKey(splitWorkShifts(code))),
  );

  for (const staffAssignments of assignmentsByStaff.values()) {
    const byDay = new Map(staffAssignments.map((assignment) => [assignment.day, assignment]));
    const sample = staffAssignments.find(
      (assignment) => (assignment.wardId ?? input.wardId) === input.wardId,
    );
    if (!sample) continue;
    let consecutiveWorkDays = 0;
    let consecutiveNights = 0;
    const dailyUnits: number[] = [];

    for (let day = 1; day <= input.daysInMonth; day += 1) {
      const assignment = byDay.get(day);
      const assignmentIsInWard =
        assignment !== undefined && (assignment.wardId ?? input.wardId) === input.wardId;
      const shifts = assignment ? splitWorkShifts(assignment.shiftCode) : [];
      const otShifts = assignment ? splitWorkShifts(assignment.otShifts) : [];
      const rawOtShifts = assignment ? splitRawShiftCodes(assignment.otShifts) : [];
      const isAcademic = assignment?.shiftCode.trim() === "ว";
      const isWorkDay = shifts.length > 0 || isAcademic;
      dailyUnits.push(shifts.length + (isAcademic ? 1 : 0));

      if (!sample.isHead && isWorkDay) {
        consecutiveWorkDays += 1;
        if (assignment && assignmentIsInWard && consecutiveWorkDays > policy.maxConsecutiveWorkDays) {
          violations.push(staffViolation(
            input,
            assignment,
            day,
            "max_consecutive_work_days",
            `วันที่ ${day} ${assignment.staffLabel} ทำงานติดต่อกัน ${consecutiveWorkDays} วัน เกินกำหนด ${policy.maxConsecutiveWorkDays} วัน`,
            shifts[0] ?? "work",
          ));
        }
      } else if (!sample.isHead) {
        consecutiveWorkDays = 0;
      }

      if (!sample.isHead && shifts.includes("ด")) {
        consecutiveNights += 1;
        if (assignment && assignmentIsInWard && consecutiveNights > policy.maxConsecutiveNights) {
          violations.push(staffViolation(
            input,
            assignment,
            day,
            "consecutive_night",
            `วันที่ ${day} ${assignment.staffLabel} ขึ้นเวรดึกติดต่อกัน ${consecutiveNights} เวร เกินกำหนด ${policy.maxConsecutiveNights} เวร`,
            "ด",
          ));
        }
      } else if (!sample.isHead) {
        consecutiveNights = 0;
      }

      if (!assignment || !assignmentIsInWard || shifts.length === 0) continue;

      if (!assignment.isHead && shifts.length > 1 && !allowedDoublePairs.has(shiftPairKey(shifts))) {
        violations.push(staffViolation(
          input,
          assignment,
          day,
          "one_shift_per_day",
          `วันที่ ${day} ${assignment.staffLabel} ได้กะ ${assignment.shiftCode} ซึ่งไม่ใช่รูปแบบเวรควบที่อนุญาต`,
          shifts[0] ?? "multiple",
          false,
        ));
      }

      if (
        !assignment.isHead &&
        assignment.allowedWardIds &&
        !assignment.allowedWardIds.includes(input.wardId)
      ) {
        violations.push(staffViolation(
          input,
          assignment,
          day,
          "invalid_ward_assignment",
          `วันที่ ${day} ${assignment.staffLabel} ถูกจัดมาวอร์ดที่ไม่ได้รับอนุญาต`,
          shifts[0] ?? "ward",
          false,
        ));
      }

      if (
        assignment.isHead &&
        (
          !["ช", "บ", "ช/บ"].includes(normalizeShiftCode(assignment.shiftCode)) ||
          (assignment.allowedWardIds && !assignment.allowedWardIds.includes(input.wardId))
        )
      ) {
        violations.push(staffViolation(
          input,
          assignment,
          day,
          "head_invalid_assignment",
          `วันที่ ${day} ${assignment.staffLabel} เป็นหัวหน้าวอร์ด แต่ถูกจัดกะ ${assignment.shiftCode} ที่ไม่อนุญาต`,
          shifts[0] ?? "head",
        ));
      }

      const invalidOt = rawOtShifts.filter((code) => !shifts.includes(code as WorkShift));
      if (invalidOt.length > 0) {
        violations.push(staffViolation(
          input,
          assignment,
          day,
          "ot_shift_must_be_assigned",
          `วันที่ ${day} ${assignment.staffLabel} ถูกระบุ OT กะ ${invalidOt.join("/")} แต่ไม่ได้ขึ้นกะดังกล่าว`,
          shifts[0] ?? "ot",
          false,
        ));
      }
      if (new Set(rawOtShifts).size !== rawOtShifts.length || otShifts.some((code) => !rawOtShifts.includes(code))) {
        violations.push(staffViolation(
          input,
          assignment,
          day,
          "no_duplicate_regular_ot",
          `วันที่ ${day} ${assignment.staffLabel} มีข้อมูลเวรปกติ/OT ซ้ำกัน`,
          shifts[0] ?? "ot",
          false,
        ));
      }

      const nextAssignment = byDay.get(day + 1);
      if (
        !assignment.isHead &&
        nextAssignment &&
        (nextAssignment.wardId ?? input.wardId) === input.wardId
      ) {
        const nextShifts = splitWorkShifts(nextAssignment.shiftCode);
        for (const [fromShift, toShift] of policy.forbiddenSequences) {
          if (shifts.includes(fromShift as WorkShift) && nextShifts.includes(toShift as WorkShift)) {
            violations.push(staffViolation(
              input,
              nextAssignment,
              day + 1,
              "forbidden_sequence",
              `วันที่ ${day + 1} ${assignment.staffLabel} มีลำดับเวรต้องห้าม ${fromShift} → ${toShift}`,
              toShift,
            ));
          }
        }
      }
    }

    if (sample.isHead) continue;

    const maxShifts = policy.maxShiftsPer7Days;
    const coveredDays = new Set<number>();
    for (let startDay = 1; startDay <= input.daysInMonth - 6; startDay += 1) {
      if (coveredDays.has(startDay)) continue;
      const total = dailyUnits.slice(startDay - 1, startDay + 6).reduce((sum, value) => sum + value, 0);
      if (total <= maxShifts) continue;
      const endDay = startDay + 6;
      const assignment = byDay.get(endDay) ?? sample;
      violations.push(staffViolation(
        input,
        assignment,
        endDay,
        "weekly_max_shifts",
        `วันที่ ${startDay}-${endDay} ${sample.staffLabel} มี ${total} กะ เกินกำหนด ${maxShifts} กะต่อ 7 วัน`,
        "weekly",
        false,
      ));
      for (let day = startDay; day <= endDay; day += 1) coveredDays.add(day);
    }
  }

  if (policy.morningRegularRequired) {
    const holidays = new Set(input.holidayDays);
    for (let day = 1; day <= input.daysInMonth; day += 1) {
      if (isHolidayDay(input.year, input.month, day, holidays)) continue;
      const morningAssignments = assignmentsByDayShift.get(`${day}:ช`) ?? [];
      const hasRegularMorning = morningAssignments.some(
        (assignment) => !splitWorkShifts(assignment.otShifts).includes("ช"),
      );
      if (!hasRegularMorning) {
        violations.push(wardViolation(
          input,
          day,
          "morning_regular_required",
          `วันที่ ${day} เวรเช้าไม่มีบุคลากรที่ขึ้นเป็นเวรปกติ`,
          "ช",
        ));
        violations[violations.length - 1].highlightCell = false;
      }
    }
  }
}

function indexAssignmentsByDayShift(assignments: ManualConstraintAssignment[]) {
  const result = new Map<string, ManualConstraintAssignment[]>();
  for (const assignment of assignments) {
    for (const shiftCode of splitWorkShifts(assignment.shiftCode)) {
      const key = `${assignment.day}:${shiftCode}`;
      result.set(key, [...(result.get(key) ?? []), assignment]);
    }
  }
  return result;
}

function getAssignmentWorkShifts(assignment: ManualConstraintAssignment) {
  return splitWorkShifts(assignment.shiftCode);
}

function splitWorkShifts(value: string | null | undefined): WorkShift[] {
  const normalized = (value ?? "").replace(/OT/gi, "").replace(/\s/g, "");
  if (!normalized || ["0", "V", "ล", "ว"].includes(normalized)) return [];
  const parts = normalized.includes("/") ? normalized.split("/") : [normalized];
  return parts.filter((part): part is WorkShift => WORK_SHIFTS.includes(part as WorkShift));
}

function splitRawShiftCodes(value: string | null | undefined) {
  return (value ?? "")
    .replace(/OT/gi, "")
    .split(/[\s,\/]+/)
    .filter(Boolean);
}

function normalizeShiftCode(value: string) {
  return splitWorkShifts(value).join("/");
}

function shiftPairKey(shifts: readonly string[]) {
  return [...new Set(shifts)].sort().join("|");
}

function countCategory(assignments: ManualConstraintAssignment[], category: string) {
  return assignments.filter((item) => item.staffCategory.trim().toUpperCase() === category).length;
}

function isIcuStaff(assignment: ManualConstraintAssignment) {
  const position = `${assignment.position ?? ""}${assignment.payPosition ?? ""}`
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return position === "RNICU" || position === "RNSUC";
}

function uniqueAssignments(assignments: ManualConstraintAssignment[]) {
  return [...new Map(assignments.map((item) => [item.staffId, item])).values()];
}

function wardViolation(
  input: ManualConstraintValidationInput,
  day: number,
  code: string,
  message: string,
  shiftCode: string,
): ManualScheduleViolation {
  return {
    id: `manual:${code}:${day}:${shiftCode}:ward`,
    day,
    staffId: null,
    staffLabel: null,
    wardId: input.wardId,
    wardLabel: input.wardLabel,
    constraintCode: code,
    constraintLabel: formatManualConstraintLabel(code),
    severity: "error",
    message,
  };
}

function staffViolation(
  input: ManualConstraintValidationInput,
  assignment: ManualConstraintAssignment,
  day: number,
  code: string,
  message: string,
  shiftCode: string,
  highlightCell = true,
): ManualScheduleViolation {
  return {
    id: `manual:${code}:${day}:${shiftCode}:${assignment.staffId}`,
    day,
    staffId: assignment.staffId,
    staffLabel: assignment.staffLabel,
    wardId: input.wardId,
    wardLabel: input.wardLabel,
    constraintCode: code,
    constraintLabel: formatManualConstraintLabel(code),
    severity: "error",
    message,
    highlightCell,
  };
}

function requestCode(type: string) {
  if (type === "v" || type === "vacation") return "V";
  if (type === "ล" || type === "leave") return "ล";
  if (type === "ว" || type === "academic") return "ว";
  if (type === "off") return "0";
  return null;
}

function normalizeRequirementShift(value: string): WorkShift | string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "morning" || normalized === "ช") return "ช";
  if (["afternoon", "evening", "บ"].includes(normalized)) return "บ";
  if (normalized === "night" || normalized === "ด") return "ด";
  return value;
}

function readRuleNumber(parameters: unknown, key: string, fallback: number) {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    return fallback;
  }
  const value = Number((parameters as Record<string, unknown>)[key]);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

function isHolidayDay(year: number, month: number, day: number, holidays: Set<number>) {
  const weekday = new Date(Date.UTC(normalizeYear(year), month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6 || holidays.has(day);
}

function normalizeYear(year: number) {
  return year > 2400 ? year - 543 : year;
}

function readShiftFromViolationId(id: string) {
  const shiftCode = id.split(":")[3];
  return WORK_SHIFTS.includes(shiftCode as WorkShift) ? shiftCode : null;
}

function compareViolations(a: ManualScheduleViolation, b: ManualScheduleViolation) {
  return (a.day ?? Number.MAX_SAFE_INTEGER) - (b.day ?? Number.MAX_SAFE_INTEGER) ||
    a.constraintCode.localeCompare(b.constraintCode) ||
    (a.staffLabel ?? "").localeCompare(b.staffLabel ?? "", "th");
}
