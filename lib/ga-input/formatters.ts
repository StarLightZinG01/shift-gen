import type {
  GaBaseRuleSettings,
  GaCompensationRate,
  GaMonthInfo,
  GaPenaltiesInput,
  GaRequestType,
  GaRulesInput,
  GaSettingsInput,
  GaShiftCode,
  GaShiftInput,
  GaStaffingRange,
} from "./types";

export const SHIFT_CODES = {
  morning: "ช",
  afternoon: "บ",
  night: "ด",
} as const satisfies Record<string, GaShiftCode>;

export const COMPENSATION_RATES: Record<string, GaCompensationRate> = {
  NA: { otRate: 400, shiftPayRate: 120 },
  PN: { otRate: 450, shiftPayRate: 240 },
  RN: { otRate: 800, shiftPayRate: 360 },
  RNanes: { otRate: 950, shiftPayRate: 950 },
  RNICU: { otRate: 900, shiftPayRate: 900 },
  RNSuC: { otRate: 850, shiftPayRate: 850 },
};

const thaiWeekdays = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

export function normalizeShiftCode(shiftCode: string): GaShiftCode | null {
  const value = shiftCode.trim().toLowerCase();

  if (["morning", "m", "ช"].includes(value)) {
    return SHIFT_CODES.morning;
  }

  if (["afternoon", "evening", "a", "e", "บ"].includes(value)) {
    return SHIFT_CODES.afternoon;
  }

  if (["night", "n", "ด"].includes(value)) {
    return SHIFT_CODES.night;
  }

  return null;
}

export function normalizeRequestType(value: string): {
  requestType: GaRequestType;
  gaCode: "V" | "ว" | "ล" | "0" | null;
} {
  const normalized = value.trim().toLowerCase();

  if (["v", "vacation"].includes(normalized)) {
    return { requestType: "vacation", gaCode: "V" };
  }

  if (["ล", "leave"].includes(normalized)) {
    return { requestType: "leave", gaCode: "ล" };
  }

  if (["ว", "academic"].includes(normalized)) {
    return { requestType: "academic", gaCode: "ว" };
  }

  if (["preferredshift", "preferred_shift", "preferred"].includes(normalized)) {
    return { requestType: "preferred_shift", gaCode: null };
  }

  return { requestType: "off", gaCode: "0" };
}

export function toDateString(date: Date | null | undefined) {
  if (!date) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function toDateTimeString(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

export function toNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function splitAllowedWardText(value: string) {
  return [
    ...new Set(
      value
        .split(/[,;|\n\r]+/)
        .map((ward) => ward.trim())
        .filter(Boolean),
    ),
  ];
}

export function applyCompensationFallback(payPosition: string, rate: number, key: keyof GaCompensationRate) {
  if (rate > 0) {
    return rate;
  }

  return COMPENSATION_RATES[payPosition]?.[key] ?? 0;
}

export function safeStaffingRange(range: GaStaffingRange | null): GaStaffingRange {
  if (!range) {
    return { min: 0, max: 0 };
  }

  const min = Math.max(0, Number.isFinite(range.min) ? range.min : 0);
  const max = Math.max(min, Number.isFinite(range.max) ? range.max : min);

  return { min, max };
}

export function buildMonthInfo(year: number, month: number, holidays: number[] = []): GaMonthInfo {
  const calendarYear = year > 2400 ? year - 543 : year;
  const days = new Date(calendarYear, month, 0).getDate();
  const holidaySet = new Set(holidays);

  return {
    days,
    dates: Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const date = new Date(Date.UTC(calendarYear, month - 1, day));
      const jsWeekday = date.getUTCDay();
      const mondayFirstWeekday = (jsWeekday + 6) % 7;

      return {
        day,
        date: date.toISOString().slice(0, 10),
        weekday: mondayFirstWeekday,
        thaiWeekday: thaiWeekdays[mondayFirstWeekday],
        isWeekend: jsWeekday === 0 || jsWeekday === 6,
        isHoliday: holidaySet.has(day),
      };
    }),
  };
}

export function defaultBaseRuleSettings(): GaBaseRuleSettings {
  return {
    coverage: true,
    oneShiftPerDay: true,
    weeklyMinDaysOff: true,
    weeklyMaxShifts: true,
    maxConsecutiveNights: true,
    maxConsecutiveWorkDays: true,
    traineePerShift: true,
    eveningToNight: true,
    doubleShiftConsecutive: true,
    workloadBalance: true,
    doubleShiftBalance: false,
  };
}

export function defaultShifts(options?: {
  enableMorningEveningDouble?: boolean;
  enableNightEveningDouble?: boolean;
}): GaShiftInput[] {
  const morningEveningCode = `${SHIFT_CODES.morning}/${SHIFT_CODES.afternoon}`;
  const nightEveningCode = `${SHIFT_CODES.night}/${SHIFT_CODES.afternoon}`;

  return [
    { code: SHIFT_CODES.morning, name: "Morning", start: 8, hours: 8 },
    { code: SHIFT_CODES.afternoon, name: "Evening", start: 16, hours: 8 },
    { code: SHIFT_CODES.night, name: "Night", start: 0, hours: 8 },
    ...(options?.enableMorningEveningDouble
      ? [{ code: morningEveningCode, name: "Morning-Evening", start: 8, hours: 16 }]
      : []),
    ...(options?.enableNightEveningDouble
      ? [{ code: nightEveningCode, name: "Night-Evening", start: 0, hours: 16 }]
      : []),
  ];
}

export function defaultRules(): GaRulesInput {
  return {
    one_shift_per_day: true,
    allow_double_shift_codes: [],
    double_shift_pair: [],
    double_shift_required_per_7_days: 0,
    double_shift_target_per_month: 0,
    weekly_min_days_off: 1,
    max_consecutive_nights: 3,
    monthly_quota_mode: "working_days_excluding_weekends_holidays",
    min_rest_hours: 8,
    morning_code: SHIFT_CODES.morning,
    evening_code: SHIFT_CODES.afternoon,
    night_code: SHIFT_CODES.night,
    max_consecutive_work_days: 7,
    shift_type_balance_weight: 50,
    max_double_per_pair_per_7_days: {},
    regular_shift_quota_per_staff: null,
    max_ot_per_staff: null,
    prefer_morning_ot: true,
    morning_regular_required: true,
    target_off_days_per_staff: null,
    repair_warning_rules: false,
  };
}

export function defaultPenalties(
  baseRuleSettings: GaBaseRuleSettings = defaultBaseRuleSettings(),
): GaPenaltiesInput {
  return {
    hard: {
      coverage_under: baseRuleSettings.coverage ? 10000 : 0,
      coverage_over: baseRuleSettings.coverage ? 8000 : 0,
      one_shift_per_day: baseRuleSettings.oneShiftPerDay ? 10000 : 0,
      invalid_ward_assignment: 10000,
      requested_off_assignment: 20000,
      weekly_max_shifts: 10000,
      trainee_per_shift: baseRuleSettings.traineePerShift ? 9000 : 0,
      forbidden_sequence: 10000,
      max_consecutive_hard: baseRuleSettings.maxConsecutiveNights ? 10000 : 0,
      max_consecutive_work_days: 10000,
      morning_regular_required: 10000,
      ot_shift_must_be_assigned: 10000,
      no_duplicate_regular_ot: 10000,
      max_ot_per_staff: 8000,
      head_invalid_assignment: 10000,
    },
    soft: {
      coverage_target_gap: 200,
      off_balance: 500,
      workload_balance: baseRuleSettings.workloadBalance ? 120 : 0,
      consecutive_night: baseRuleSettings.maxConsecutiveNights ? 300 : 0,
      shift_count_balance: baseRuleSettings.workloadBalance ? 300 : 0,
      shift_type_balance: 150,
      ot_balance: 700,
      prefer_morning_ot: 100,
      ot_cost_balance: 100,
      minimize_unnecessary_ot: 300,
      ot_shift_type_balance: 200,
      preferred_shift_request: 300,
      violation_distribution: 200,
    },
  };
}

export function defaultGaSettings(): GaSettingsInput {
  return {
    population_size: 120,
    generations: 200,
    elite_size: 8,
    tournament_size: 4,
    crossover_rate: 0.9,
    mutation_rate: 0.004,
    random_seed: 42,
    stop_if_objective_zero: false,
    patience: 30,
    log_every: 5,
    max_seconds: 600,
    full_repair_every: 4,
    repair_elite_every: 8,
  };
}

export function defaultRulesNote(baseRuleSettings: GaBaseRuleSettings) {
  return [
    { key: "coverage", label: "กำลังคนครบตามกะ", level: "hard" as const, status: "enabled", enabled: baseRuleSettings.coverage },
    { key: "oneShiftPerDay", label: "หนึ่งคนไม่เกินหนึ่งเวรต่อวัน", level: "hard" as const, status: "enabled", enabled: baseRuleSettings.oneShiftPerDay },
    { key: "weeklyMaxShifts", label: "จำกัดจำนวนเวรใน 7 วัน", level: "hard" as const, status: "enabled", enabled: baseRuleSettings.weeklyMaxShifts },
    { key: "traineePerShift", label: "จำกัดพยาบาลฝึกหัดต่อกะ", level: "hard" as const, status: "enabled", enabled: baseRuleSettings.traineePerShift },
    { key: "workloadBalance", label: "กระจายภาระงาน", level: "soft" as const, status: "enabled", enabled: baseRuleSettings.workloadBalance },
  ];
}
