import { buildReadinessChecks } from "./readiness";
import {
  SPECIAL_RULE_DEFINITIONS,
  type AvailableSpecialRuleKey,
  type SpecialRuleSetting,
} from "./special-rules";
import type {
  CycleContext,
  StaffingRequirements,
  StaffRow,
  WardContext,
} from "./types";

export type ShiftRequirementSummary = {
  total: number | null;
  rn: number | null;
  pnNa: number | null;
};

export type WardSummary = {
  totalStaff: number;
  headCount: number;
  newNurseCount: number;
  rnCount: number;
  pnCount: number;
  naCount: number;
  otherCount: number;
  inchargeCount: number;
  externalStaffCount: number;
  shiftRequirements: {
    regular: Record<"night" | "morning" | "afternoon", ShiftRequirementSummary>;
    holiday: Record<"night" | "morning" | "afternoon", ShiftRequirementSummary>;
  };
  requestCounts: {
    off: number;
    vacation: number;
    leave: number;
    academic: number;
    preferredShift: number;
    total: number;
  };
  enabledSpecialRules: Array<{ key: AvailableSpecialRuleKey; title: string }>;
  readinessWarnings: string[];
  readinessStatus: "ready" | "needs-fix";
  readinessStatusLabel: string;
};

type WardSummaryInput = {
  wardCode?: string;
  staffRows: StaffRow[];
  staffingRequirements: StaffingRequirements | null;
  specialRuleSettings: SpecialRuleSetting[];
  cycle?: CycleContext;
  ward?: WardContext | null;
};

export function buildWardSummary({
  wardCode,
  staffRows,
  staffingRequirements,
  specialRuleSettings,
  cycle,
  ward,
}: WardSummaryInput): WardSummary {
  const rnCount = countCategory(staffRows, "RN");
  const pnCount = countCategory(staffRows, "PN");
  const naCount = countCategory(staffRows, "NA");
  const inchargeCount = staffRows.filter((row) => row.canBeInCharge).length;
  const readinessChecks = buildReadinessChecks({
    staffRows,
    staffingRequirements,
    specialRuleSettings,
    cycle,
    ward,
  });
  const enabledSpecialRules = SPECIAL_RULE_DEFINITIONS.flatMap((definition) => {
    const setting = specialRuleSettings.find(
      (item) => item.ruleKey === definition.ruleKey && item.enabled,
    );
    return setting ? [{ key: definition.ruleKey, title: definition.title }] : [];
  });
  const readinessWarnings = buildSpecialRuleWarnings({
    specialRuleSettings,
    rnCount,
    pnCount,
    naCount,
    inchargeCount,
  });
  const requestCounts = buildRequestCounts(staffRows);
  const isReady =
    readinessChecks.every((check) => check.status === "passed") &&
    readinessWarnings.length === 0;

  return {
    totalStaff: staffRows.length,
    headCount: staffRows.filter((row) => row.isHead).length,
    newNurseCount: staffRows.filter((row) => row.isNewNurse).length,
    rnCount,
    pnCount,
    naCount,
    otherCount: countCategory(staffRows, "OTHER"),
    inchargeCount,
    externalStaffCount: countExternalStaff(wardCode, staffRows),
    shiftRequirements: {
      regular: {
        night: summarizeRequirement(staffingRequirements?.night),
        morning: summarizeRequirement(staffingRequirements?.morning),
        afternoon: summarizeRequirement(staffingRequirements?.afternoon),
      },
      holiday: {
        night: summarizeRequirement(staffingRequirements?.holidayNight),
        morning: summarizeRequirement(staffingRequirements?.holidayMorning),
        afternoon: summarizeRequirement(staffingRequirements?.holidayAfternoon),
      },
    },
    requestCounts,
    enabledSpecialRules,
    readinessWarnings,
    readinessStatus: isReady ? "ready" : "needs-fix",
    readinessStatusLabel: isReady ? "พร้อมจัดตาราง" : "ควรตรวจสอบ",
  };
}

function countCategory(staffRows: StaffRow[], category: StaffRow["staffCategory"]) {
  return staffRows.filter((row) => row.staffCategory === category).length;
}

function countExternalStaff(wardCode: string | undefined, staffRows: StaffRow[]) {
  if (!wardCode) return 0;
  return staffRows.filter((row) => row.homeWard !== wardCode).length;
}

function summarizeRequirement(
  requirement:
    | { min: number; max: number; rnRequired?: number; pnNaRequired?: number }
    | undefined,
): ShiftRequirementSummary {
  if (!requirement || !Number.isFinite(requirement.max)) {
    return { total: null, rn: null, pnNa: null };
  }

  const rn = Number.isFinite(requirement.rnRequired) ? requirement.rnRequired! : null;
  const pnNa = Number.isFinite(requirement.pnNaRequired)
    ? requirement.pnNaRequired!
    : null;
  return { total: requirement.max, rn, pnNa };
}

function buildRequestCounts(staffRows: StaffRow[]) {
  const counts = {
    off: staffRows.reduce((sum, row) => sum + countRequestEntries(row.off), 0),
    vacation: staffRows.reduce(
      (sum, row) => sum + countRequestEntries(row.vacation),
      0,
    ),
    leave: staffRows.reduce((sum, row) => sum + countRequestEntries(row.leave), 0),
    academic: staffRows.reduce(
      (sum, row) => sum + countRequestEntries(row.academic),
      0,
    ),
    preferredShift: staffRows.reduce(
      (sum, row) => sum + countRequestEntries(row.preferredShifts),
      0,
    ),
  };

  return { ...counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
}

function countRequestEntries(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized === "0") return 0;

  return normalized
    .split(/[,;|\n\r]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== "0").length;
}

function buildSpecialRuleWarnings({
  specialRuleSettings,
  rnCount,
  pnCount,
  naCount,
  inchargeCount,
}: {
  specialRuleSettings: SpecialRuleSetting[];
  rnCount: number;
  pnCount: number;
  naCount: number;
  inchargeCount: number;
}) {
  const enabled = new Map(
    specialRuleSettings
      .filter((setting) => setting.enabled)
      .map((setting) => [setting.ruleKey, setting]),
  );
  const warnings: string[] = [];
  const inchargeRequired = enabled.get("incharge_min_per_shift")?.parameters.minCount;
  if (inchargeRequired !== undefined && inchargeCount < inchargeRequired) {
    warnings.push(`ต้องมี Incharge อย่างน้อย ${inchargeRequired} คน แต่มี ${inchargeCount} คน`);
  }

  const pairRequired = enabled.get("pn_na_equal_per_shift")?.parameters.minEach;
  if (
    pairRequired !== undefined &&
    (pnCount < pairRequired || naCount < pairRequired)
  ) {
    warnings.push(`กฎ PN/NA ต้องการอย่างน้อยประเภทละ ${pairRequired} คน`);
  }

  const sundayRn = enabled.get("sunday_morning_rn_exact")?.parameters.exactCount;
  if (sundayRn !== undefined && rnCount < sundayRn) {
    warnings.push(`RN ไม่พอสำหรับเวรเช้าวันอาทิตย์ที่กำหนด ${sundayRn} คน`);
  }

  const morningRule = enabled.get("morning_rn_by_day");
  if (morningRule) {
    const required = Math.max(...Object.values(morningRule.parameters), 0);
    if (rnCount < required) {
      warnings.push(`RN ไม่พอสำหรับเวรเช้าที่กำหนดสูงสุด ${required} คน`);
    }
  }

  const weekdayMorningPn = enabled.get("weekday_morning_pn_exact")?.parameters.exactCount;
  if (weekdayMorningPn !== undefined && pnCount < weekdayMorningPn) {
    warnings.push(`PN ไม่พอสำหรับเวรเช้าวันราชการที่กำหนด ${weekdayMorningPn} คน`);
  }

  return warnings;
}
