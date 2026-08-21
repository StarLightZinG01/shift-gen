import type {
  GaMonthInfo,
  GaPenaltiesInput,
  GaRequestType,
  GaRulesInput,
  GaSettingsInput,
  GaShiftCode,
  GaShiftInput,
  GaStaffingRange,
} from "./types";
import { MAX_CONSECUTIVE_NIGHTS } from "./constants";

export const SHIFT_CODES = {
  morning: "ช",
  afternoon: "บ",
  night: "ด",
} as const satisfies Record<string, GaShiftCode>;

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
    max_consecutive_nights: MAX_CONSECUTIVE_NIGHTS,
    monthly_quota_mode: "working_days_excluding_weekends_holidays",
    min_rest_hours: 8,
    morning_code: SHIFT_CODES.morning,
    evening_code: SHIFT_CODES.afternoon,
    night_code: SHIFT_CODES.night,
    max_consecutive_work_days: 7,
    shift_type_balance_weight: 50,
    max_double_per_pair_per_7_days: {},
    regular_shift_quota_per_staff: null,
    prefer_morning_ot: true,
    morning_regular_required: true,
    target_off_days_per_staff: null,
    repair_warning_rules: false,
  };
}

export function defaultPenalties(): GaPenaltiesInput {
  return {
    hard: {
      coverage_under: 10000,
      coverage_over: 8000,
      one_shift_per_day: 10000,
      invalid_ward_assignment: 10000,
      requested_off_assignment: 20000,
      weekly_max_shifts: 10000,
      trainee_per_shift: 9000,
      forbidden_sequence: 10000,
      max_consecutive_work_days: 10000,
      morning_regular_required: 10000,
      ot_shift_must_be_assigned: 10000,
      no_duplicate_regular_ot: 10000,
      head_invalid_assignment: 10000,
      consecutive_night: 10000,
    },
    soft: {
      coverage_target_gap: 200,
      off_balance: 500,
      workload_balance: 120,
      shift_count_balance: 300,
      shift_type_balance: 150,
      ot_balance: 700,
      prefer_morning_ot: 100,
      ot_cost_balance: 100,
      minimize_unnecessary_ot: 300,
      ot_shift_type_balance: 200,
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
