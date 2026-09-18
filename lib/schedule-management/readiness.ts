import type { SpecialRuleSetting } from "./special-rules";
import type {
  CycleContext,
  StaffingRequirements,
  StaffRow,
  WardContext,
} from "./types";

export type ReadinessCheckStatus = "passed" | "warning";

export type ReadinessCheck = {
  id: string;
  status: ReadinessCheckStatus;
  message: string;
};

type ReadinessInput = {
  staffRows: StaffRow[];
  staffingRequirements: StaffingRequirements | null;
  specialRuleSettings?: SpecialRuleSetting[];
  cycle?: CycleContext;
  ward?: WardContext | null;
};

const SPECIAL_RULE_PARAMETER_CHECKS: Partial<
  Record<
    SpecialRuleSetting["ruleKey"],
    {
      title: string;
      fields: Record<string, { label: string; min: number }>;
    }
  >
> = {
  incharge_min_per_shift: {
    title: "ทุกกะต้องมี RN.Incharge",
    fields: { minCount: { label: "จำนวน Incharge ขั้นต่ำต่อกะ", min: 1 } },
  },
  sunday_morning_rn_exact: {
    title: "กำหนดจำนวน RN เวรเช้าวันอาทิตย์",
    fields: { exactCount: { label: "จำนวน RN", min: 0 } },
  },
  morning_rn_by_day: {
    title: "กำหนด RN เวรเช้าตามประเภทวัน",
    fields: {
      mondayWednesday: { label: "RN วันจันทร์และพุธ", min: 0 },
      tuesdayThursdayFriday: {
        label: "RN วันอังคาร พฤหัสบดี และศุกร์",
        min: 0,
      },
      holiday: { label: "RN วันหยุด", min: 0 },
    },
  },
  weekday_morning_pn_exact: {
    title: "วันราชการเวรเช้าต้องมี PN ตามจำนวนที่กำหนด",
    fields: { exactCount: { label: "จำนวน PN", min: 0 } },
  },
  pn_na_equal_per_shift: {
    title: "PN และ NA ต้องขึ้นเป็นคู่",
    fields: { minEach: { label: "จำนวนคู่ขั้นต่ำต่อกะ", min: 1 } },
  },
};

export function buildReadinessChecks({
  staffRows,
  staffingRequirements,
  specialRuleSettings = [],
  cycle,
  ward,
}: ReadinessInput): ReadinessCheck[] {
  const requirements = getRequirements(staffingRequirements);
  const completeRequirements =
    requirements.length === 6 && requirements.every(hasCompleteRequirement);
  const validRequirements =
    completeRequirements && requirements.every(hasValidRequirement);
  const incompleteStaffCount = staffRows.filter(hasIncompleteStaffData).length;
  const duplicateCodeCount = countDuplicateCodes(staffRows);
  const totalRequired = maxRequirement(requirements, (item) => item.max);
  const rnRequired = maxRequirement(requirements, (item) => item.rnRequired);
  const pnNaRequired = maxRequirement(requirements, (item) => item.pnNaRequired);
  const rnCount = countCategory(staffRows, "RN");
  const pnCount = countCategory(staffRows, "PN");
  const naCount = countCategory(staffRows, "NA");
  const pnNaCount = pnCount + naCount;
  const specialRuleProblem = findSpecialRuleProblem({
    settings: specialRuleSettings,
    staffRows,
    staffingRequirements,
    rnCount,
    pnCount,
    naCount,
  });
  const requestProblem = cycle ? findRequestProblem(staffRows, cycle) : null;
  const hasRoundContext = cycle
    ? Boolean(
        cycle.id &&
          cycle.month >= 1 &&
          cycle.month <= 12 &&
          cycle.year > 0 &&
          ward?.id &&
          ward.code.trim(),
      )
    : true;

  const checks: ReadinessCheck[] = [
    {
      id: "round-context",
      status: hasRoundContext ? "passed" : "warning",
      message: hasRoundContext
        ? "ข้อมูลรอบตารางและวอร์ดครบแล้ว"
        : "ข้อมูลรอบตารางหรือวอร์ดยังไม่ครบ",
    },
    {
      id: "staffing-requirements",
      status: completeRequirements ? "passed" : "warning",
      message: completeRequirements
        ? "กำหนดจำนวน RN และ PN/NA ครบทั้ง 6 กะแล้ว"
        : "ยังไม่ได้กำหนดจำนวน RN และ PN/NA ให้ครบทั้ง 6 กะ",
    },
    {
      id: "staffing-values",
      status: validRequirements ? "passed" : "warning",
      message: validRequirements
        ? "จำนวนกำลังคนทุกกะถูกต้อง"
        : "จำนวนกำลังคนต้องเป็นจำนวนเต็ม ไม่ติดลบ และตรงกับ RN + PN/NA",
    },
    {
      id: "ward-staff",
      status: staffRows.length > 0 ? "passed" : "warning",
      message:
        staffRows.length > 0
          ? "มีบุคลากรที่สามารถนำไปจัดเวรได้"
          : "ยังไม่มีบุคลากรที่สามารถนำไปจัดเวรได้",
    },
    {
      id: "staff-data",
      status: incompleteStaffCount === 0 ? "passed" : "warning",
      message:
        incompleteStaffCount === 0
          ? "ข้อมูลรหัส ชื่อ ตำแหน่ง และค่าตอบแทนครบแล้ว"
          : `มีบุคลากร ${incompleteStaffCount} คนที่ข้อมูลยังไม่ครบ`,
    },
    {
      id: "duplicate-staff-code",
      status: duplicateCodeCount === 0 ? "passed" : "warning",
      message:
        duplicateCodeCount === 0
          ? "ไม่มีรหัสบุคลากรซ้ำกัน"
          : `พบรหัสบุคลากรซ้ำ ${duplicateCodeCount} รหัส`,
    },
    {
      id: "ward-head",
      status: staffRows.some((row) => row.isHead) ? "passed" : "warning",
      message: staffRows.some((row) => row.isHead)
        ? "มีหัวหน้าวอร์ดแล้ว"
        : "ยังไม่มีหัวหน้าวอร์ด",
    },
    {
      id: "total-capacity",
      status: staffRows.length >= totalRequired ? "passed" : "warning",
      message:
        staffRows.length >= totalRequired
          ? "จำนวนบุคลากรเพียงพอต่อกำลังคนสูงสุดของหนึ่งกะ"
          : `บุคลากรไม่พอ: ต้องใช้สูงสุด ${totalRequired} คนต่อกะ แต่มี ${staffRows.length} คน`,
    },
    {
      id: "rn-capacity",
      status: rnCount >= rnRequired ? "passed" : "warning",
      message:
        rnCount >= rnRequired
          ? "จำนวน RN เพียงพอต่อกะ"
          : `RN ไม่พอ: ต้องใช้สูงสุด ${rnRequired} คนต่อกะ แต่มี ${rnCount} คน`,
    },
    {
      id: "pn-na-capacity",
      status: pnNaCount >= pnNaRequired ? "passed" : "warning",
      message:
        pnNaCount >= pnNaRequired
          ? "จำนวน PN/NA เพียงพอต่อกะ"
          : `PN/NA ไม่พอ: ต้องใช้สูงสุด ${pnNaRequired} คนต่อกะ แต่มี ${pnNaCount} คน`,
    },
    {
      id: "special-rules",
      status: specialRuleProblem ? "warning" : "passed",
      message: specialRuleProblem ?? "ข้อมูลรองรับกฎเฉพาะที่เปิดใช้งานแล้ว",
    },
    {
      id: "staff-requests",
      status: requestProblem ? "warning" : "passed",
      message: requestProblem ?? "รูปแบบวันที่และคำขอของบุคลากรถูกต้อง",
    },
  ];

  return checks.sort(
    (a, b) => Number(a.status === "passed") - Number(b.status === "passed"),
  );
}

type Requirement = NonNullable<StaffingRequirements["morning"]>;

function getRequirements(staffing: StaffingRequirements | null) {
  if (!staffing) return [];
  return [
    staffing.night,
    staffing.morning,
    staffing.afternoon,
    staffing.holidayNight,
    staffing.holidayMorning,
    staffing.holidayAfternoon,
  ].filter((item): item is Requirement => Boolean(item));
}

function hasCompleteRequirement(requirement: Requirement) {
  return [
    requirement.min,
    requirement.max,
    requirement.rnRequired,
    requirement.pnNaRequired,
  ].every(Number.isFinite);
}

function hasValidRequirement(requirement: Requirement) {
  const values = [requirement.rnRequired, requirement.pnNaRequired];
  return (
    values.every((value) => Number.isInteger(value) && value >= 0) &&
    requirement.min === requirement.max &&
    requirement.max === requirement.rnRequired + requirement.pnNaRequired
  );
}

function maxRequirement(
  requirements: Requirement[],
  select: (requirement: Requirement) => number,
) {
  return Math.max(0, ...requirements.map(select).filter(Number.isFinite));
}

function countCategory(staffRows: StaffRow[], category: StaffRow["staffCategory"]) {
  return staffRows.filter((row) => row.staffCategory === category).length;
}

function countDuplicateCodes(staffRows: StaffRow[]) {
  const counts = new Map<string, number>();
  for (const row of staffRows) {
    const code = row.code.trim().toLocaleLowerCase("th");
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

function findSpecialRuleProblem({
  settings,
  staffRows,
  staffingRequirements,
  rnCount,
  pnCount,
  naCount,
}: {
  settings: SpecialRuleSetting[];
  staffRows: StaffRow[];
  staffingRequirements: StaffingRequirements | null;
  rnCount: number;
  pnCount: number;
  naCount: number;
}) {
  const enabled = settings.filter((setting) => setting.enabled);
  for (const setting of enabled) {
    const check = SPECIAL_RULE_PARAMETER_CHECKS[setting.ruleKey];
    const invalidField = Object.entries(check?.fields ?? {}).find(
      ([key, field]) => {
        const value = setting.parameters[key];
        return !Number.isInteger(value) || value < field.min;
      },
    );
    if (invalidField && check) {
      return `${check.title}: ${invalidField[1].label} ไม่ถูกต้อง`;
    }
  }

  const byKey = new Map(enabled.map((setting) => [setting.ruleKey, setting]));
  const inchargeRequired = byKey.get("incharge_min_per_shift")?.parameters.minCount;
  const inchargeCount = staffRows.filter((row) => row.canBeInCharge).length;
  if (inchargeRequired !== undefined && inchargeCount < inchargeRequired) {
    return `ผู้ที่เป็น Incharge ได้มี ${inchargeCount} คน แต่มีกฎกำหนดอย่างน้อย ${inchargeRequired} คนต่อกะ`;
  }

  const pairRequired = byKey.get("pn_na_equal_per_shift")?.parameters.minEach;
  if (pairRequired !== undefined && (pnCount < pairRequired || naCount < pairRequired)) {
    return `กฎ PN/NA ต้องการอย่างน้อยประเภทละ ${pairRequired} คน แต่มี PN ${pnCount} และ NA ${naCount} คน`;
  }

  const sundayRn = byKey.get("sunday_morning_rn_exact")?.parameters.exactCount;
  if (sundayRn !== undefined && rnCount < sundayRn) {
    return `RN มี ${rnCount} คน แต่มีกฎวันอาทิตย์กำหนด ${sundayRn} คน`;
  }

  const morningRule = byKey.get("morning_rn_by_day");
  if (morningRule) {
    const required = Math.max(0, ...Object.values(morningRule.parameters));
    if (rnCount < required) {
      return `RN มี ${rnCount} คน แต่มีกฎเวรเช้ากำหนดสูงสุด ${required} คน`;
    }
  }

  const weekdayMorningPn = byKey.get("weekday_morning_pn_exact")?.parameters.exactCount;
  if (weekdayMorningPn !== undefined && pnCount < weekdayMorningPn) {
    return `PN มี ${pnCount} คน แต่กฎวันราชการเวรเช้ากำหนด ${weekdayMorningPn} คน`;
  }
  if (
    weekdayMorningPn !== undefined &&
    (staffingRequirements?.morning?.pnNaRequired ?? 0) < weekdayMorningPn
  ) {
    return `กำลังคนเวรเช้าวันราชการกำหนด PN/NA รวม ${staffingRequirements?.morning?.pnNaRequired ?? 0} คน แต่กฎกำหนด PN ${weekdayMorningPn} คน`;
  }

  return null;
}

function findRequestProblem(staffRows: StaffRow[], cycle: CycleContext) {
  const daysInMonth = new Date(normalizeYear(cycle.year), cycle.month, 0).getDate();

  for (const row of staffRows) {
    try {
      const usedDays = new Map<number, string>();
      const groups = [
        ["Off", row.off],
        ["V", row.vacation],
        ["ล", row.leave],
        ["ว", row.academic],
      ] as const;

      for (const [label, value] of groups) {
        for (const day of parseDayList(value, daysInMonth)) {
          if (usedDays.has(day)) {
            return `${row.fullName || row.code}: วันที่ ${day} ถูกระบุในคำขอมากกว่าหนึ่งประเภท`;
          }
          usedDays.set(day, label);
        }
      }

      for (const day of parsePreferredShiftDays(row.preferredShifts, daysInMonth)) {
        if (usedDays.has(day)) {
          return `${row.fullName || row.code}: วันที่ ${day} มีทั้งคำขอหยุดและคำขอเข้าเวร`;
        }
        usedDays.set(day, "ขอเข้าเวร");
      }
    } catch (error) {
      return `${row.fullName || row.code}: ${
        error instanceof Error ? error.message : "รูปแบบคำขอไม่ถูกต้อง"
      }`;
    }
  }

  return null;
}

function parseDayList(value: string, daysInMonth: number) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0" || trimmed === "-") return [];

  const days = trimmed
    .replace(/[，、]/g, ",")
    .split(/[,\s]+/)
    .filter(Boolean)
    .flatMap((part) => {
      const range = part.match(/^(\d{1,2})-(\d{1,2})$/);
      if (!range) return [validateDay(Number(part), daysInMonth)];
      const start = validateDay(Number(range[1]), daysInMonth);
      const end = validateDay(Number(range[2]), daysInMonth);
      if (start > end) throw new Error(`ช่วงวันที่ ${part} ไม่ถูกต้อง`);
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    });

  return [...new Set(days)];
}

function parsePreferredShiftDays(value: string, daysInMonth: number) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0" || trimmed === "-") return [];

  const days = trimmed
    .replace(/[，、]/g, ",")
    .split(/[,;\n\r]+/)
    .filter(Boolean)
    .map((part) => {
      const match = part.trim().match(/^(\d{1,2})\s*(?::|=|\s)\s*(ช\/บ|ด\/บ|ช|บ|ด)$/);
      if (!match) throw new Error("คำขอเข้าเวรต้องอยู่ในรูปแบบ วัน:กะ เช่น 20:ช");
      return validateDay(Number(match[1]), daysInMonth);
    });

  if (new Set(days).size !== days.length) {
    throw new Error("คำขอเข้าเวรมีวันที่ซ้ำกัน");
  }
  return days;
}

function validateDay(day: number, daysInMonth: number) {
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
    throw new Error(`วันที่ ${day} ไม่อยู่ในรอบตาราง`);
  }
  return day;
}

function normalizeYear(year: number) {
  return year > 2400 ? year - 543 : year;
}

function hasIncompleteStaffData(row: StaffRow) {
  return (
    isBlank(row.code) ||
    isBlank(row.fullName) ||
    isBlank(row.homeWard) ||
    isBlank(row.payPosition) ||
    !isValidNumericText(row.otRate) ||
    !isValidNumericText(row.shiftPayRate)
  );
}

function isBlank(value: string) {
  return value.trim().length === 0;
}

function isValidNumericText(value: string) {
  return !isBlank(value) && Number.isFinite(Number(value));
}
