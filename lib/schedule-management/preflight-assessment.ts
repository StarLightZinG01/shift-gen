import type {
  CycleContext,
  PreflightSettings,
  SharedStaffUsage,
  ShiftStaffingRequirement,
  StaffingRequirements,
  StaffRow,
} from "./types";
import type { SpecialRuleSetting } from "./special-rules";

export type PreflightRiskSeverity = "critical" | "warning";

export type PreflightRisk = {
  id: string;
  severity: PreflightRiskSeverity;
  title: string;
  message: string;
  recommendation: string;
};

type PreflightAssessmentInput = {
  cycle: CycleContext;
  staffRows: StaffRow[];
  staffingRequirements: StaffingRequirements | null;
  settings: PreflightSettings;
  sharedStaffUsage: SharedStaffUsage[];
  specialRuleSettings?: SpecialRuleSetting[];
};

type ParsedStaff = StaffRow & {
  unavailableDays: Set<number>;
  requestedOffDays: Set<number>;
  preferredByDay: Map<number, string>;
};

type DailyCapacity = {
  day: number;
  available: ParsedStaff[];
  unavailableCount: number;
  minimumWorkers: number;
};

const SHIFT_LABELS: Record<string, string> = {
  "ช": "เช้า",
  "บ": "บ่าย",
  "ด": "ดึก",
};

export function assessSchedulePreflight({
  cycle,
  staffRows,
  staffingRequirements,
  settings,
  sharedStaffUsage,
  specialRuleSettings = [],
}: PreflightAssessmentInput): PreflightRisk[] {
  const requirements = normalizeRequirements(staffingRequirements);

  if (!requirements) {
    return [];
  }

  const daysInMonth = getDaysInMonth(cycle.year, cycle.month);
  const staff = staffRows.map((row) => parseStaffRow(row, daysInMonth));
  const risks: PreflightRisk[] = [];
  const addRisk = (risk: PreflightRisk) => {
    if (!risks.some((item) => item.id === risk.id)) {
      risks.push(risk);
    }
  };

  if (staff.length === 0) {
    return [
      {
        id: "no-eligible-staff",
        severity: "critical",
        title: "ไม่มีบุคลากรสำหรับจัดตาราง",
        message: "ยังไม่มีบุคลากรที่สามารถนำไปจัดตารางของวอร์ดนี้ได้",
        recommendation:
          "เพิ่มบุคลากรในวอร์ด หรือเลือกบุคลากรจากวอร์ดอื่นที่ได้รับสิทธิ์ให้ช่วยวอร์ดนี้",
      },
    ];
  }

  if (!staff.some((row) => row.isHead)) {
    addRisk({
      id: "missing-ward-head",
      severity: "critical",
      title: "ยังไม่ได้กำหนดหัวหน้าวอร์ด",
      message: "ข้อมูลบุคลากรของรอบนี้ไม่มีผู้ที่ถูกกำหนดบทบาทเป็นหัวหน้าวอร์ด",
      recommendation: "กำหนดหัวหน้าวอร์ดอย่างน้อย 1 คนก่อนส่งข้อมูลให้ GA",
    });
  }

  const configuredRequirements = [
    staffingRequirements?.morning,
    staffingRequirements?.afternoon,
    staffingRequirements?.night,
    staffingRequirements?.holidayMorning,
    staffingRequirements?.holidayAfternoon,
    staffingRequirements?.holidayNight,
  ].filter((item): item is ShiftStaffingRequirement => Boolean(item));
  const highestRnRequirement = Math.max(
    0,
    ...configuredRequirements.map((item) => item.rnRequired),
  );
  const highestPnNaRequirement = Math.max(
    0,
    ...configuredRequirements.map((item) => item.pnNaRequired),
  );
  const rnCount = staff.filter((row) => row.staffCategory === "RN").length;
  const pnNaCount = staff.filter((row) =>
    row.staffCategory === "PN" || row.staffCategory === "NA",
  ).length;

  if (rnCount < highestRnRequirement) {
    addRisk({
      id: "insufficient-rn-staff",
      severity: "critical",
      title: "จำนวน RN ไม่เพียงพอต่อกะ",
      message: `วอร์ดมี RN ${rnCount} คน แต่มีบางกะกำหนดให้ RN ขึ้น ${highestRnRequirement} คน`,
      recommendation: "ตรวจสอบประเภทบุคลากรและเพิ่ม RN ที่สามารถขึ้นเวรวอร์ดนี้ได้",
    });
  }

  if (pnNaCount < highestPnNaRequirement) {
    addRisk({
      id: "insufficient-pn-na-staff",
      severity: "critical",
      title: "จำนวน PN/NA ไม่เพียงพอต่อกะ",
      message: `วอร์ดมี PN/NA ${pnNaCount} คน แต่มีบางกะกำหนดให้ PN/NA ขึ้น ${highestPnNaRequirement} คน`,
      recommendation: "ตรวจสอบประเภทบุคลากรและเพิ่ม PN/NA ที่สามารถขึ้นเวรวอร์ดนี้ได้",
    });
  }

  const missingRateStaff = staff.filter(
    (row) => !isPositiveNumber(row.otRate) || !isPositiveNumber(row.shiftPayRate),
  );
  if (missingRateStaff.length > 0) {
    addRisk({
      id: "missing-compensation-rates",
      severity: "warning",
      title: "ข้อมูลค่าตอบแทนยังไม่ครบ",
      message: `มีบุคลากร ${missingRateStaff.length} คนที่ค่า OT หรือค่าเวรเป็น 0/ไม่ถูกต้อง ยอดค่าตอบแทนอาจต่ำกว่าความเป็นจริง`,
      recommendation: "ตรวจสอบช่องค่า OT และค่าเวร (บ/ด) ของบุคลากรรายบุคคล",
    });
  }

  const minimumWorkers = minimumDistinctWorkers(requirements, settings);
  const dailyCapacity = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const available = staff.filter((row) => !row.unavailableDays.has(day));
    return {
      day,
      available,
      unavailableCount: staff.length - available.length,
      minimumWorkers,
    } satisfies DailyCapacity;
  });

  addDailyCapacityRisks(risks, dailyCapacity);
  addDailyCategoryCapacityRisks(
    risks,
    dailyCapacity,
    staffingRequirements!,
    settings,
    cycle,
  );
  addRequestConflictRisks(risks, staff, requirements);
  addTraineeRisks(risks, dailyCapacity, requirements, settings);
  addWeeklyCapacityRisk(risks, staff, requirements, settings, daysInMonth);
  addConsecutiveWorkRisk(risks, staff, minimumWorkers, settings, daysInMonth);
  addMonthlyCapacityRisks(
    risks,
    staff,
    requirements,
    minimumWorkers,
    settings,
    cycle,
    daysInMonth,
  );
  addHeadUsageRisk(risks, dailyCapacity, cycle, requirements, settings);
  addExternalStaffRisks(risks, staff, dailyCapacity, sharedStaffUsage);
  addBalanceRisks(risks, staff, requirements, cycle, daysInMonth);
  addSpecialRuleRisks(
    risks,
    staff,
    specialRuleSettings,
    staffingRequirements,
  );

  return risks.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
}

function addDailyCategoryCapacityRisks(
  risks: PreflightRisk[],
  dailyCapacity: DailyCapacity[],
  requirements: StaffingRequirements,
  settings: PreflightSettings,
  cycle: CycleContext,
) {
  const holidayDays = new Set(
    cycle.holidays.map((item) => item.date.getUTCDate()),
  );
  const maxDailyUnits =
    settings.enableMorningEveningDouble || settings.enableNightEveningDouble ? 2 : 1;
  const problems: Record<"RN" | "PN/NA", string[]> = { RN: [], "PN/NA": [] };

  for (const item of dailyCapacity) {
    const year = cycle.year > 2400 ? cycle.year - 543 : cycle.year;
    const weekday = new Date(Date.UTC(year, cycle.month - 1, item.day)).getUTCDay();
    const holiday = weekday === 0 || weekday === 6 || holidayDays.has(item.day);
    const shifts = holiday
      ? [requirements.holidayMorning, requirements.holidayAfternoon, requirements.holidayNight]
      : [requirements.morning, requirements.afternoon, requirements.night];
    if (!shifts.every((value): value is ShiftStaffingRequirement => Boolean(value))) {
      continue;
    }

    const availableRn = item.available.filter((row) => row.staffCategory === "RN").length;
    const availableSupport = item.available.filter(
      (row) => row.staffCategory === "PN" || row.staffCategory === "NA",
    ).length;
    const requiredRn = shifts.reduce((sum, value) => sum + value.rnRequired, 0);
    const requiredSupport = shifts.reduce((sum, value) => sum + value.pnNaRequired, 0);
    if (
      shifts.some((value) => value.rnRequired > availableRn) ||
      requiredRn > availableRn * maxDailyUnits
    ) {
      problems.RN.push(`วันที่ ${item.day} ต้องใช้ RN รวม ${requiredRn} เวร แต่มี RN พร้อมทำงาน ${availableRn} คน`);
    }
    if (
      shifts.some((value) => value.pnNaRequired > availableSupport) ||
      requiredSupport > availableSupport * maxDailyUnits
    ) {
      problems["PN/NA"].push(
        `วันที่ ${item.day} ต้องใช้ PN/NA รวม ${requiredSupport} เวร แต่มี PN/NA พร้อมทำงาน ${availableSupport} คน`,
      );
    }
  }

  for (const category of ["RN", "PN/NA"] as const) {
    if (problems[category].length === 0) continue;
    risks.push({
      id: `daily-${category.toLowerCase().replace("/", "-")}-capacity`,
      severity: "critical",
      title: `${category} อาจไม่เพียงพอสำหรับกำลังคนรายวัน`,
      message: formatExamples(problems[category]),
      recommendation: `ตรวจสอบวันหยุดและคำขอของ ${category} หรือเพิ่มบุคลากรกลุ่มนี้ก่อนส่งข้อมูลให้ GA`,
    });
  }
}

function addSpecialRuleRisks(
  risks: PreflightRisk[],
  staff: ParsedStaff[],
  settings: SpecialRuleSetting[],
  staffingRequirements: StaffingRequirements | null,
) {
  const enabled = new Map(
    settings.filter((item) => item.enabled).map((item) => [item.ruleKey, item]),
  );
  const rnCount = staff.filter((row) => row.staffCategory === "RN").length;

  const inchargeRule = enabled.get("incharge_min_per_shift");
  if (inchargeRule) {
    const required = inchargeRule.parameters.minCount ?? 1;
    const available = staff.filter((row) => row.canBeInCharge).length;
    if (available < required) {
      risks.push({
        id: "special-incharge-capacity",
        severity: "critical",
        title: "RN.Incharge ไม่เพียงพอตามกฎเฉพาะ",
        message: `กฎกำหนดให้แต่ละกะมี RN.Incharge อย่างน้อย ${required} คน แต่ข้อมูลวอร์ดมีผู้ที่เป็น Incharge ได้ ${available} คน`,
        recommendation: "ตรวจสอบสถานะ Incharge ของบุคลากร หรือเพิ่มผู้ที่สามารถเป็น Incharge ให้เพียงพอต่อกะ",
      });
    }
  }

  if (enabled.has("icu_new_not_together")) {
    const hasIcu = staff.some((row) => {
      const role = normalizeRole(row.payPosition);
      return role.includes("RNICU") || role.includes("RNSUC");
    });
    const hasNew = staff.some((row) => row.isNewNurse);
    if (!hasIcu || !hasNew) {
      risks.push({
        id: "special-icu-new-data",
        severity: "warning",
        title: "ควรตรวจสอบข้อมูล RN ICU/RNSuC และ RN new",
        message: "เปิดกฎ RN ICU/RNSuC และ RN new ไม่ขึ้นเวรด้วยกัน แต่ข้อมูลบุคลากรอาจยังระบุสองกลุ่มนี้ไม่ครบ",
        recommendation: "ตรวจสอบตำแหน่ง RN ICU หรือ RNSuC และสถานะพยาบาลใหม่ของบุคลากรก่อนส่งข้อมูลให้ GA",
      });
    }
  }

  const sundayRule = enabled.get("sunday_morning_rn_exact");
  const sundayRequired = sundayRule?.parameters.exactCount ?? 0;
  if (sundayRule && rnCount < sundayRequired) {
    risks.push({
      id: "special-sunday-rn-capacity",
      severity: "critical",
      title: "RN ไม่พอสำหรับเวรเช้าวันอาทิตย์",
      message: `กฎกำหนด RN เวรเช้าวันอาทิตย์เท่ากับ ${sundayRequired} คน แต่วอร์ดมี RN ${rnCount} คน`,
      recommendation: "ตรวจสอบประเภทบุคลากรหรือเพิ่ม RN ที่สามารถขึ้นเวรวอร์ดนี้ได้",
    });
  }

  const morningRule = enabled.get("morning_rn_by_day");
  if (morningRule) {
    const required = Math.max(...Object.values(morningRule.parameters), 0);
    if (rnCount < required) {
      risks.push({
        id: "special-morning-rn-capacity",
        severity: "critical",
        title: "RN ไม่พอสำหรับกฎเวรเช้าแยกตามวัน",
        message: `กฎเฉพาะต้องใช้ RN เวรเช้าสูงสุด ${required} คน แต่วอร์ดมี RN ${rnCount} คน`,
        recommendation: "ตรวจสอบประเภทบุคลากรหรือเพิ่ม RN ที่สามารถขึ้นเวรวอร์ดนี้ได้",
      });
    }
  }

  const weekdayMorningPnRule = enabled.get("weekday_morning_pn_exact");
  if (weekdayMorningPnRule) {
    const required = weekdayMorningPnRule.parameters.exactCount ?? 1;
    const available = staff.filter((row) => row.staffCategory === "PN").length;
    if (available < required) {
      risks.push({
        id: "special-weekday-morning-pn-capacity",
        severity: "critical",
        title: "PN ไม่พอสำหรับเวรเช้าวันราชการ",
        message: `กฎกำหนด PN เวรเช้าวันราชการเท่ากับ ${required} คน แต่วอร์ดมี PN ${available} คน`,
        recommendation: "ตรวจสอบประเภทบุคลากรหรือเพิ่ม PN ที่สามารถขึ้นเวรวอร์ดนี้ได้",
      });
    }
    const configured = staffingRequirements?.morning?.pnNaRequired ?? 0;
    if (configured < required) {
      risks.push({
        id: "special-weekday-morning-pn-requirement",
        severity: "critical",
        title: "จำนวน PN ขัดกับกำลังคนเวรเช้า",
        message: `เวรเช้าวันราชการกำหนด PN/NA รวม ${configured} คน แต่กฎเฉพาะกำหนด PN เท่ากับ ${required} คน`,
        recommendation: "กำหนดจำนวน PN/NA ของเวรเช้าวันราชการให้ไม่น้อยกว่าจำนวน PN ในกฎเฉพาะ",
      });
    }
  }

  const pairRule = enabled.get("pn_na_equal_per_shift");
  if (pairRule) {
    const minimum = pairRule.parameters.minEach ?? 1;
    const pnCount = staff.filter((row) => row.staffCategory === "PN").length;
    const naCount = staff.filter((row) => row.staffCategory === "NA").length;
    if (pnCount < minimum || naCount < minimum) {
      risks.push({
        id: "special-pn-na-pair-capacity",
        severity: "critical",
        title: "PN หรือ NA ไม่พอสำหรับจัดเป็นคู่",
        message: `แต่ละกะต้องมี PN และ NA อย่างละอย่างน้อย ${minimum} คน แต่ข้อมูลวอร์ดมี PN ${pnCount} คน และ NA ${naCount} คน`,
        recommendation: "ตรวจสอบประเภทบุคลากรและเพิ่ม PN หรือ NA ที่สามารถขึ้นเวรวอร์ดนี้ได้",
      });
    }
    const configuredSupportCounts = [
      staffingRequirements?.morning,
      staffingRequirements?.afternoon,
      staffingRequirements?.night,
      staffingRequirements?.holidayMorning,
      staffingRequirements?.holidayAfternoon,
      staffingRequirements?.holidayNight,
    ]
      .filter((value): value is ShiftStaffingRequirement => Boolean(value))
      .map((value) => value.pnNaRequired);
    const invalidCount = configuredSupportCounts.find(
      (count) => count % 2 !== 0 || count < minimum * 2,
    );
    if (invalidCount !== undefined) {
      risks.push({
        id: "special-pn-na-pair-count-conflict",
        severity: "critical",
        title: "จำนวน PN/NA ขัดกับกฎการขึ้นเป็นคู่",
        message: `กำหนด PN/NA รวม ${invalidCount} คน แต่การแบ่งเป็น PN และ NA จำนวนเท่ากันต้องใช้เลขคู่และไม่น้อยกว่า ${minimum * 2} คน`,
        recommendation: `ปรับจำนวน PN/NA ที่ต้องจัดเป็นเลขคู่และไม่น้อยกว่า ${minimum * 2} คนก่อนส่งข้อมูลให้ GA`,
      });
    }
  }
}

function normalizeRole(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function addDailyCapacityRisks(risks: PreflightRisk[], dailyCapacity: DailyCapacity[]) {
  const shortages = dailyCapacity.filter(
    (item) => item.available.length < item.minimumWorkers,
  );

  if (shortages.length > 0) {
    const worst = shortages.reduce((current, item) =>
      item.available.length < current.available.length ? item : current,
    );
    risks.push({
      id: "daily-staff-shortage",
      severity: "critical",
      title: "บางวันมีกำลังคนไม่เพียงพอ",
      message: `พบ ${shortages.length} วันที่จำนวนผู้พร้อมทำงานต่ำกว่าที่ต้องใช้ โดยวันที่ ${worst.day} เหลือ ${worst.available.length} คน จากที่ต้องใช้อย่างน้อย ${worst.minimumWorkers} คน และมีผู้หยุด/ลา/ประชุม ${worst.unavailableCount} คน`,
      recommendation:
        "ตรวจสอบหรือประสานเปลี่ยนคำขอบางรายการ และเพิ่มบุคลากรที่สามารถช่วยวอร์ดนี้ได้",
    });
  }

  const usableDays = dailyCapacity.filter((item) => item.available.length > 0);
  if (usableDays.length === 0 || shortages.length > 0) {
    return;
  }

  const tightest = usableDays.reduce((current, item) => {
    const currentRatio = current.minimumWorkers / current.available.length;
    const itemRatio = item.minimumWorkers / item.available.length;
    return itemRatio > currentRatio ? item : current;
  });
  const utilization = tightest.minimumWorkers / tightest.available.length;

  if (utilization >= 0.85) {
    risks.push({
      id: "low-staff-buffer",
      severity: "warning",
      title: "กำลังคนสำรองของวอร์ดเหลือน้อย",
      message: `วันที่ ${tightest.day} ต้องใช้บุคลากรอย่างน้อย ${tightest.minimumWorkers} จากผู้ที่พร้อมทำงาน ${tightest.available.length} คน หรือประมาณ ${Math.round(utilization * 100)}%`,
      recommendation:
        "เตรียมบุคลากรช่วยวอร์ดหรือทบทวนคำขอหยุดในช่วงดังกล่าวก่อนส่งข้อมูลให้ GA",
    });
  }
}

function addRequestConflictRisks(
  risks: PreflightRisk[],
  staff: ParsedStaff[],
  requirements: NormalizedRequirements,
) {
  const conflicts: string[] = [];
  const forbidden: string[] = [];
  const preferredCounts = new Map<string, { day: number; shift: string; count: number }>();

  for (const row of staff) {
    for (const [day, shift] of row.preferredByDay) {
      if (row.unavailableDays.has(day)) {
        conflicts.push(`${staffLabel(row)} วันที่ ${day}`);
      }

      const nextShift = row.preferredByDay.get(day + 1);
      if (shiftParts(shift).includes("บ") && nextShift && shiftParts(nextShift).includes("ด")) {
        forbidden.push(`${staffLabel(row)} วันที่ ${day}–${day + 1}`);
      }

      for (const part of shiftParts(shift)) {
        if (!(part in SHIFT_LABELS)) {
          continue;
        }
        const key = `${day}:${part}`;
        const current = preferredCounts.get(key) ?? { day, shift: part, count: 0 };
        current.count += 1;
        preferredCounts.set(key, current);
      }
    }
  }

  if (conflicts.length > 0) {
    risks.push({
      id: "request-conflict",
      severity: "critical",
      title: "พบคำขอที่ขัดแย้งกัน",
      message: `${formatExamples(conflicts)} มีทั้งคำขอหยุด/ลา/ประชุม และคำขอเข้าเวรในวันเดียวกัน`,
      recommendation: "ตรวจสอบและเลือกคำขอเพียงประเภทเดียวในแต่ละวัน",
    });
  }

  if (forbidden.length > 0) {
    risks.push({
      id: "preferred-forbidden-sequence",
      severity: "critical",
      title: "คำขอเข้าเวรทำให้เกิดลำดับต้องห้าม",
      message: `${formatExamples(forbidden)} ขอเวรในรูปแบบบ่ายต่อดึก`,
      recommendation: "เปลี่ยนคำขอเวรวันใดวันหนึ่งเพื่อไม่ให้เกิด บ → ด",
    });
  }

  const overMaximum = Array.from(preferredCounts.values()).filter(
    (item) => item.count > requirements[item.shift as ShiftCode].max,
  );
  if (overMaximum.length > 0) {
    const worst = overMaximum.sort((a, b) => b.count - a.count)[0];
    risks.push({
      id: "preferred-over-coverage",
      severity: "warning",
      title: "คำขอเข้าเวรบางกะมากกว่ากำลังคนสูงสุด",
      message: `วันที่ ${worst.day} มีผู้ขอเวร${SHIFT_LABELS[worst.shift]} ${worst.count} คน แต่กะนี้รับได้สูงสุด ${requirements[worst.shift as ShiftCode].max} คน`,
      recommendation: "ทบทวนคำขอบางรายการ เพราะ GA ไม่สามารถจัดให้ครบทุกคำขอได้",
    });
  }
}

function addTraineeRisks(
  risks: PreflightRisk[],
  dailyCapacity: DailyCapacity[],
  requirements: NormalizedRequirements,
  settings: PreflightSettings,
) {
  const problems: string[] = [];

  for (const item of dailyCapacity) {
    for (const shift of ["ช", "บ", "ด"] as const) {
      const eligible = item.available.filter((row) => !(shift === "ด" && row.isHead));
      const regularCount = eligible.filter((row) => !row.isTrainee).length;
      const traineeCount = eligible.filter((row) => row.isTrainee).length;
      const capacity = regularCount + Math.min(traineeCount, settings.maxTraineePerShift);

      if (capacity < requirements[shift].min) {
        problems.push(`วันที่ ${item.day} เวร${SHIFT_LABELS[shift]}`);
      }
    }
  }

  if (problems.length > 0) {
    risks.push({
      id: "trainee-capacity",
      severity: "critical",
      title: "สัดส่วนพยาบาลใหม่อาจทำให้กำลังคนไม่ครบ",
      message: `${formatExamples(problems)} มีบุคลากรทั่วไปไม่พอ เมื่อแต่ละกะรับพยาบาลใหม่ได้ไม่เกิน ${settings.maxTraineePerShift} คน`,
      recommendation:
        "เพิ่มบุคลากรทั่วไป ย้ายพยาบาลใหม่ไปกะอื่น หรือตรวจสอบสถานะพยาบาลใหม่ของบุคลากรให้ถูกต้อง",
    });
  }
}

function addWeeklyCapacityRisk(
  risks: PreflightRisk[],
  staff: ParsedStaff[],
  requirements: NormalizedRequirements,
  settings: PreflightSettings,
  daysInMonth: number,
) {
  const requiredPerDay = requiredShiftUnits(requirements);
  const maxDailyUnits = settings.enableMorningEveningDouble || settings.enableNightEveningDouble ? 2 : 1;
  let worst: { start: number; end: number; required: number; capacity: number } | null = null;

  for (let start = 1; start <= daysInMonth - 6; start += 1) {
    const end = start + 6;
    const capacity = staff.reduce((sum, row) => {
      let availableDays = 0;
      for (let day = start; day <= end; day += 1) {
        if (!row.unavailableDays.has(day)) {
          availableDays += 1;
        }
      }
      return sum + Math.min(settings.maxShiftsPer7Days, availableDays * maxDailyUnits);
    }, 0);
    const required = requiredPerDay * 7;

    if (required > capacity && (!worst || required - capacity > worst.required - worst.capacity)) {
      worst = { start, end, required, capacity };
    }
  }

  if (worst) {
    risks.push({
      id: "weekly-shift-capacity",
      severity: "critical",
      title: `ช่วงวันที่ ${worst.start}–${worst.end} มีภาระงานเกินกำลังคน`,
      message: `ต้องจัดอย่างน้อย ${worst.required} เวร แต่บุคลากรรองรับได้ประมาณ ${worst.capacity} เวร โดยไม่เกิน ${settings.maxShiftsPer7Days} เวรใน 7 วัน`,
      recommendation: "เพิ่มบุคลากรช่วยวอร์ด หรือตรวจสอบคำขอหยุดในช่วงดังกล่าว",
    });
  }
}

function addConsecutiveWorkRisk(
  risks: PreflightRisk[],
  staff: ParsedStaff[],
  minimumWorkers: number,
  settings: PreflightSettings,
  daysInMonth: number,
) {
  const windowSize = settings.maxConsecutiveWorkDays + 1;
  let worst: { start: number; end: number; required: number; capacity: number } | null = null;

  for (let start = 1; start <= daysInMonth - windowSize + 1; start += 1) {
    const end = start + windowSize - 1;
    const required = minimumWorkers * windowSize;
    const capacity = staff.reduce((sum, row) => {
      let availableDays = 0;
      for (let day = start; day <= end; day += 1) {
        if (!row.unavailableDays.has(day)) {
          availableDays += 1;
        }
      }
      return sum + Math.min(settings.maxConsecutiveWorkDays, availableDays);
    }, 0);

    if (required > capacity && (!worst || required - capacity > worst.required - worst.capacity)) {
      worst = { start, end, required, capacity };
    }
  }

  if (worst) {
    risks.push({
      id: "consecutive-work-risk",
      severity: "warning",
      title: `มีโอกาสทำงานติดต่อกันเกิน ${settings.maxConsecutiveWorkDays} วัน`,
      message: `ช่วงวันที่ ${worst.start}–${worst.end} ต้องใช้คนทำงานรวมอย่างน้อย ${worst.required} คน-วัน แต่รองรับได้ ${worst.capacity} คน-วันหากทุกคนมีวันพักตามเกณฑ์`,
      recommendation: "เพิ่มบุคลากรช่วยวอร์ด หรือกระจายคำขอหยุดออกจากช่วงดังกล่าว",
    });
  }
}

function addMonthlyCapacityRisks(
  risks: PreflightRisk[],
  staff: ParsedStaff[],
  requirements: NormalizedRequirements,
  minimumWorkers: number,
  settings: PreflightSettings,
  cycle: CycleContext,
  daysInMonth: number,
) {
  const totalRequired = requiredShiftUnits(requirements) * daysInMonth;
  const fullWeeks = Math.floor(daysInMonth / 7);
  const remainingDays = daysInMonth % 7;
  const maxDailyUnits = settings.enableMorningEveningDouble || settings.enableNightEveningDouble ? 2 : 1;
  const maximumPerStaff =
    fullWeeks * settings.maxShiftsPer7Days +
    Math.min(settings.maxShiftsPer7Days, remainingDays * maxDailyUnits);
  const maximumCapacity = maximumPerStaff * staff.length;

  if (totalRequired > maximumCapacity) {
    risks.push({
      id: "monthly-capacity",
      severity: "critical",
      title: "จำนวนบุคลากรอาจไม่เพียงพอกับเวรขั้นต่ำทั้งเดือน",
      message: `เดือนนี้ต้องจัดอย่างน้อย ${totalRequired} เวร แต่กำลังคนรองรับได้ไม่เกินประมาณ ${maximumCapacity} เวรภายใต้กฎ ${settings.maxShiftsPer7Days} เวรใน 7 วัน`,
      recommendation: "เพิ่มบุคลากรประจำหรือบุคลากรช่วยวอร์ดก่อนส่งข้อมูลให้ GA",
    });
  }

  const requestedOff = staff.reduce((sum, row) => sum + row.requestedOffDays.size, 0);
  const availableOffSlots = Math.max(0, staff.length * daysInMonth - minimumWorkers * daysInMonth);
  if (requestedOff > availableOffSlots) {
    risks.push({
      id: "requested-off-capacity",
      severity: "critical",
      title: "คำขอหยุดรวมสูงกว่าที่ภาระงานรองรับ",
      message: `มีคำขอหยุดรวม ${requestedOff} วัน แต่จากกำลังคนขั้นต่ำ วอร์ดรองรับวันหยุดรวมได้ประมาณ ${availableOffSlots} วัน`,
      recommendation:
        "ตรวจสอบคำขอ off ที่ยังเปลี่ยนแปลงได้ และประสานเพิ่มบุคลากรสำหรับวันที่มีคำขอหนาแน่น โดยไม่แก้วันลาที่อนุมัติแล้วโดยพลการ",
    });
  }

  const officialWorkDays = countOfficialWorkDays(cycle, daysInMonth);
  const regularCapacity = officialWorkDays * staff.length;
  const estimatedOt = Math.max(0, totalRequired - regularCapacity);
  if (estimatedOt > 0) {
    risks.push({
      id: "estimated-ot",
      severity: "warning",
      title: "เดือนนี้มีแนวโน้มต้องใช้ OT",
      message: `ต้องจัดอย่างน้อย ${totalRequired} เวร ขณะที่โควตาเวรปกติรวมประมาณ ${regularCapacity} เวร จึงคาดว่าต้องมี OT อย่างน้อย ${estimatedOt} เวร`,
      recommendation: "ตรวจสอบงบประมาณ OT และความถูกต้องของค่า OT รายบุคคลก่อนจัดตาราง",
    });

    const averageOt = estimatedOt / staff.length;
    if (averageOt > 3) {
      risks.push({
        id: "ot-concentration-risk",
        severity: "warning",
        title: "OT อาจกระจุกอยู่กับบุคลากรบางคน",
        message: `OT ที่คาดการณ์เฉลี่ยประมาณ ${averageOt.toFixed(1)} เวรต่อคน หากมีข้อจำกัดหรือคำขอหยุดมาก การกระจาย OT อาจไม่สม่ำเสมอ`,
        recommendation: "เพิ่มบุคลากรช่วยวอร์ดและทบทวนคำขอหยุดของผู้ที่พร้อมรับเวรเพิ่มเติม",
      });
    }
  }
}

function addHeadUsageRisk(
  risks: PreflightRisk[],
  dailyCapacity: DailyCapacity[],
  cycle: CycleContext,
  requirements: NormalizedRequirements,
  settings: PreflightSettings,
) {
  const neededDays = dailyCapacity.filter((item) => {
    const nonHeads = item.available.filter((row) => !row.isHead);
    return (
      nonHeads.length < minimumDistinctWorkers(requirements, settings) &&
      item.available.length >= minimumDistinctWorkers(requirements, settings)
    );
  });

  if (neededDays.length === 0) {
    return;
  }

  risks.push({
    id: "head-help-required",
    severity: "warning",
    title: "หัวหน้าวอร์ดอาจต้องช่วยขึ้นเวรเพิ่มเติม",
    message: `มี ${neededDays.length} วันที่กำลังคนทั่วไปไม่พอ โดยอาจต้องใช้หัวหน้าวอร์ดช่วย เช่น วันที่ ${neededDays.slice(0, 5).map((item) => item.day).join(", ")}`,
    recommendation: "เพิ่มพยาบาลทั่วไปหรือบุคลากรช่วยวอร์ด หากไม่ต้องการให้หัวหน้าช่วยกะอื่น",
  });

  const holidayHelpDays = neededDays.filter((item) => !isOfficialWorkDay(cycle, item.day));
  if (holidayHelpDays.length > 0) {
    risks.push({
      id: "head-holiday-help",
      severity: "warning",
      title: "หัวหน้าวอร์ดอาจต้องช่วยในวันหยุด",
      message: `วันที่ ${holidayHelpDays.slice(0, 5).map((item) => item.day).join(", ")} กำลังคนทั่วไปไม่พอ จึงอาจต้องใช้หัวหน้าวอร์ดช่วย`,
      recommendation: "เพิ่มบุคลากรทั่วไปในวันดังกล่าว หรือประสานบุคลากรข้ามวอร์ดล่วงหน้า",
    });
  }
}

function addExternalStaffRisks(
  risks: PreflightRisk[],
  staff: ParsedStaff[],
  dailyCapacity: DailyCapacity[],
  sharedStaffUsage: SharedStaffUsage[],
) {
  const externalStaff = staff.filter((row) => row.rowType === "external");
  if (externalStaff.length > 0) {
    const dependsOnExternal = dailyCapacity.some((item) => {
      const homeAvailable = item.available.filter((row) => row.rowType !== "external");
      return homeAvailable.length < item.minimumWorkers;
    });

    if (dependsOnExternal) {
      risks.push({
        id: "external-staff-dependency",
        severity: "warning",
        title: "วอร์ดนี้พึ่งพาบุคลากรช่วยจากวอร์ดอื่น",
        message: `มีบุคลากรช่วยวอร์ด ${externalStaff.length} คน และบางวันกำลังคนประจำไม่พอกับขั้นต่ำหากไม่มีบุคลากรกลุ่มนี้`,
        recommendation: "ยืนยันความพร้อมกับวอร์ดหลักของบุคลากรเหล่านี้ก่อนส่งข้อมูลให้ GA",
      });
    }
  }

  const selectedIds = new Set(staff.map((row) => row.staffId).filter(Boolean));
  const competing = sharedStaffUsage.filter((usage) => selectedIds.has(usage.staffId));
  if (competing.length > 0) {
    const examples = competing.slice(0, 3).map(
      (usage) => `${usage.staffCode} (${usage.otherWardCodes.join(", ")})`,
    );
    risks.push({
      id: "shared-staff-competition",
      severity: "warning",
      title: "มีบุคลากรที่หลายวอร์ดต้องการใช้พร้อมกัน",
      message: `${formatExamples(examples)} ถูกเลือกช่วยวอร์ดอื่นในรอบเดียวกัน อาจเกิดการแข่งขันกำลังคนเมื่อจัดหลายวอร์ดพร้อมกัน`,
      recommendation: "ประสานวอร์ดที่เกี่ยวข้องและส่งวอร์ดเหล่านี้ให้ GA จัดพร้อมกัน",
    });
  }
}

function addBalanceRisks(
  risks: PreflightRisk[],
  staff: ParsedStaff[],
  requirements: NormalizedRequirements,
  cycle: CycleContext,
  daysInMonth: number,
) {
  const offCounts = staff.filter((row) => !row.isHead).map((row) => row.requestedOffDays.size);
  if (offCounts.length > 1) {
    const difference = Math.max(...offCounts) - Math.min(...offCounts);
    if (difference > 3) {
      risks.push({
        id: "requested-off-imbalance",
        severity: "warning",
        title: "คำขอหยุดของบุคลากรกระจายไม่สมดุล",
        message: `จำนวนคำขอหยุดของแต่ละคนต่างกันสูงสุด ${difference} วัน อาจทำให้วันทำงานและ OT กระจายไม่สม่ำเสมอ`,
        recommendation: "ตรวจสอบคำขอ off ที่ยืดหยุ่นได้ โดยยังคงวันลาและคำขอที่ได้รับอนุมัติไว้",
      });
    }
  }

  const nonHeadStaff = staff.filter((row) => !row.isHead);
  if (nonHeadStaff.length === 0) {
    return;
  }

  const officialWorkDays = countOfficialWorkDays(cycle, daysInMonth);
  const averageWorkUnits = (requiredShiftUnits(requirements) * daysInMonth) / staff.length;
  if (averageWorkUnits > officialWorkDays + 2) {
    risks.push({
      id: "high-average-workload",
      severity: "warning",
      title: "ภาระงานเฉลี่ยต่อคนค่อนข้างสูง",
      message: `แต่ละคนอาจต้องทำเฉลี่ยประมาณ ${averageWorkUnits.toFixed(1)} เวร เทียบกับเวรราชการประมาณ ${officialWorkDays} เวร`,
      recommendation: "เพิ่มบุคลากรช่วยวอร์ดเพื่อลด OT และลดความเสี่ยงทำงานต่อเนื่อง",
    });
  }

  const preferredPerStaff = nonHeadStaff.map((row) => ({
    row,
    counts: countPreferredShiftTypes(row.preferredByDay),
  }));
  for (const shift of ["ช", "บ", "ด"] as const) {
    const expectedAverage = (requirements[shift].min * daysInMonth) / nonHeadStaff.length;
    const concentrated = preferredPerStaff.find(
      (item) => item.counts[shift] > Math.ceil(expectedAverage) + 2,
    );
    if (concentrated) {
      risks.push({
        id: `preferred-shift-concentration-${shift}`,
        severity: "warning",
        title: `คำขอเวร${SHIFT_LABELS[shift]}อาจทำให้เวรย่อยไม่สมดุล`,
        message: `${staffLabel(concentrated.row)} ขอเวร${SHIFT_LABELS[shift]} ${concentrated.counts[shift]} วัน ซึ่งสูงกว่าค่าเฉลี่ยที่ควรกระจายต่อคน`,
        recommendation: "ทบทวนคำขอที่ยืดหยุ่นได้ หรือยอมรับว่าบางคำขออาจไม่ถูกจัดให้ครบ",
      });
    }
  }
}

type ShiftCode = "ช" | "บ" | "ด";
type NormalizedRequirements = Record<ShiftCode, { min: number; max: number }>;

function normalizeRequirements(
  requirements: StaffingRequirements | null,
): NormalizedRequirements | null {
  const morning = requirements?.morning;
  const afternoon = requirements?.afternoon;
  const night = requirements?.night;
  const holidayMorning = requirements?.holidayMorning;
  const holidayAfternoon = requirements?.holidayAfternoon;
  const holidayNight = requirements?.holidayNight;
  if (
    ![
      morning,
      afternoon,
      night,
      holidayMorning,
      holidayAfternoon,
      holidayNight,
    ].every(isValidRequirement)
  ) {
    return null;
  }

  return {
    "ช": mergeRequirementRanges(morning!, holidayMorning!),
    "บ": mergeRequirementRanges(afternoon!, holidayAfternoon!),
    "ด": mergeRequirementRanges(night!, holidayNight!),
  };
}

function mergeRequirementRanges(
  weekday: { min: number; max: number },
  holiday: { min: number; max: number },
) {
  return {
    min: Math.max(weekday.min, holiday.min),
    max: Math.max(weekday.max, holiday.max),
  };
}

function isValidRequirement(value: { min: number; max: number } | undefined) {
  return Boolean(
    value &&
      Number.isFinite(value.min) &&
      Number.isFinite(value.max) &&
      value.min >= 0 &&
      value.max >= value.min,
  );
}

function parseStaffRow(row: StaffRow, daysInMonth: number): ParsedStaff {
  const requestedOffDays = unionSets(
    parseDayList(row.off, daysInMonth),
    parseDayList(row.vacation, daysInMonth),
    parseDayList(row.leave, daysInMonth),
  );
  const unavailableDays = unionSets(
    requestedOffDays,
    parseDayList(row.academic, daysInMonth),
  );
  return {
    ...row,
    requestedOffDays,
    unavailableDays,
    preferredByDay: parsePreferredShifts(row.preferredShifts, daysInMonth),
  };
}

function parseDayList(value: string, daysInMonth: number) {
  const days = new Set<number>();
  for (const token of value.split(/[,;|\s]+/)) {
    const day = Number(token.trim());
    if (Number.isInteger(day) && day >= 1 && day <= daysInMonth) {
      days.add(day);
    }
  }
  return days;
}

function parsePreferredShifts(value: string, daysInMonth: number) {
  const requests = new Map<number, string>();
  const pattern = /(\d{1,2})\s*[:=]\s*(ช\/บ|ด\/บ|ช|บ|ด)/g;
  for (const match of value.matchAll(pattern)) {
    const day = Number(match[1]);
    if (day >= 1 && day <= daysInMonth) {
      requests.set(day, match[2]);
    }
  }
  return requests;
}

function minimumDistinctWorkers(
  requirements: NormalizedRequirements,
  settings: PreflightSettings,
) {
  const morning = requirements["ช"].min;
  const afternoon = requirements["บ"].min;
  const night = requirements["ด"].min;
  const pairCapacity =
    (settings.enableMorningEveningDouble ? morning : 0) +
    (settings.enableNightEveningDouble ? night : 0);
  return morning + night + Math.max(0, afternoon - pairCapacity);
}

function requiredShiftUnits(requirements: NormalizedRequirements) {
  return requirements["ช"].min + requirements["บ"].min + requirements["ด"].min;
}

function countOfficialWorkDays(cycle: CycleContext, daysInMonth: number) {
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (isOfficialWorkDay(cycle, day)) {
      count += 1;
    }
  }
  return count;
}

function isOfficialWorkDay(cycle: CycleContext, day: number) {
  const year = cycle.year > 2400 ? cycle.year - 543 : cycle.year;
  const date = new Date(Date.UTC(year, cycle.month - 1, day));
  const weekday = date.getUTCDay();
  const holiday = cycle.holidays.some((item) => item.date.getUTCDate() === day);
  return weekday !== 0 && weekday !== 6 && !holiday;
}

function getDaysInMonth(year: number, month: number) {
  const calendarYear = year > 2400 ? year - 543 : year;
  return new Date(calendarYear, month, 0).getDate();
}

function unionSets(...sets: Set<number>[]) {
  return new Set(sets.flatMap((set) => Array.from(set)));
}

function shiftParts(value: string) {
  return value.split("/").map((part) => part.trim()).filter(Boolean);
}

function countPreferredShiftTypes(preferredByDay: Map<number, string>) {
  const counts: Record<ShiftCode, number> = { "ช": 0, "บ": 0, "ด": 0 };
  for (const shift of preferredByDay.values()) {
    for (const part of shiftParts(shift)) {
      if (part === "ช" || part === "บ" || part === "ด") {
        counts[part] += 1;
      }
    }
  }
  return counts;
}

function isPositiveNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function staffLabel(staff: Pick<StaffRow, "code" | "fullName">) {
  return staff.fullName || staff.code || "บุคลากรไม่ทราบชื่อ";
}

function formatExamples(values: string[]) {
  const shown = values.slice(0, 3).join(", ");
  return values.length > 3 ? `${shown} และอีก ${values.length - 3} รายการ` : shown;
}

function severityOrder(severity: PreflightRiskSeverity) {
  return severity === "critical" ? 0 : 1;
}
