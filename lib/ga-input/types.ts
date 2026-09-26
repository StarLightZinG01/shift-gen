export type GaShiftCode = "ช" | "บ" | "ด";

export type GaRequestType = "off" | "vacation" | "leave" | "academic" | "preferred_shift";

export type GaInput = {
  cycle: GaCycleInput;
  department: string;
  wards: GaWardInput[];
  year: number;
  month: number;
  thai_weekday: boolean;
  staff: GaStaffInput[];
  shifts: GaShiftInput[];
  coverage: {
    default: Record<string, Record<string, GaStaffingRange>>;
    by_day: Record<string, Record<string, Record<string, GaStaffingRange>>>;
  };
  staffing_composition: {
    default: Record<string, Record<GaShiftCode, GaStaffingComposition>>;
    by_day: Record<string, Record<string, Record<GaShiftCode, GaStaffingComposition>>>;
  };
  holidays: number[];
  monthInfo: GaMonthInfo;
  availabilityRequests: GaAvailabilityRequestInput[];
  preferredShiftRequests: GaPreferredShiftRequestInput[];
  rules: GaRulesInput;
  trainee_rule: GaTraineeRuleInput;
  rule_engine: GaRuleEngineInput;
  penalties: GaPenaltiesInput;
  ga: GaSettingsInput;
  custom_rules: GaCustomRuleInput[];
  readinessWarnings?: string[];
  validation: GaInputValidation;
};

export type GaCycleInput = {
  id: string;
  year: number;
  month: number;
  status: string;
  days: number;
  requestOpenDate: string | null;
  requestCloseDate: string | null;
  dataLockDate: string | null;
  autoGenerateAt: string | null;
};

export type GaWardInput = {
  id: string;
  code: string;
  name: string;
  preparationId: string;
  preparationStatus: string;
  requirements: Record<GaShiftCode, GaStaffingRange | null>;
  holidayRequirements: Record<GaShiftCode, GaStaffingRange | null>;
  composition: Record<GaShiftCode, GaStaffingComposition>;
  holidayComposition: Record<GaShiftCode, GaStaffingComposition>;
  staff: GaWardStaffInput[];
  customRules: GaCustomRuleInput[];
};

export type GaCustomRuleInput = {
  rule_id: string;
  rule_key:
    | "incharge_min_per_shift"
    | "icu_new_not_together"
    | "sunday_morning_rn_exact"
    | "morning_rn_by_day"
    | "weekday_morning_pn_exact"
    | "pn_na_equal_per_shift";
  rule_name: string;
  ward: string;
  parameters: Record<string, number>;
};

export type GaStaffingRange = {
  min: number;
  max: number;
};

export type GaStaffingComposition = {
  rn_required: number;
  pn_na_required: number;
  requires_incharge: boolean;
};

export type GaWardStaffInput = {
  id: string | null;
  code: string;
  name: string;
  homeWardId: string | null;
  homeWardName: string;
  allowedWardIds: string[];
  allowedWardCodes: string[];
  isExternal: boolean;
  isHead: boolean;
  isTrainee: boolean;
  staffCategory: "RN" | "PN" | "NA" | "OTHER";
  isNewNurse: boolean;
  canBeInCharge: boolean;
  position: string;
  payPosition: string;
  otRate: number;
  shiftPayRate: number;
  regularWorkTarget: number | null;
};

export type GaStaffInput = {
  id: string;
  unit: string;
  home_ward: string;
  allowed_wards: string[];
  role: string;
  position: string;
  pay_position: string;
  ot_rate: number;
  shift_allowance: Record<GaShiftCode, number>;
  is_trainee: boolean;
  is_head: boolean;
  staff_category: "RN" | "PN" | "NA" | "OTHER";
  is_new_nurse: boolean;
  can_be_in_charge: boolean;
  max_shifts_per_7_days: number;
  monthly_quota: number | null;
  special_days: Record<string, "V" | "ว" | "ล" | "0">;
};

export type GaShiftInput = {
  code: string;
  name: string;
  start: number;
  hours: number;
};

export type GaAvailabilityRequestInput = {
  staffId: string;
  staffCode: string;
  date: string;
  day: number;
  requestType: GaRequestType;
  gaCode: "V" | "ว" | "ล" | "0" | null;
  preferredShift: string | null;
  reason: string | null;
};

export type GaPreferredShiftRequestInput = {
  staffId: string;
  staffCode: string;
  date: string;
  day: number;
  preferredShift: string;
  reason: string | null;
};

export type GaMonthInfo = {
  days: number;
  dates: Array<{
    day: number;
    date: string;
    weekday: number;
    thaiWeekday: string;
    isWeekend: boolean;
    isHoliday: boolean;
  }>;
};

export type GaRulesInput = {
  one_shift_per_day: boolean;
  allow_double_shift_codes: string[];
  double_shift_pair: string[][];
  double_shift_required_per_7_days: number;
  double_shift_target_per_month: number;
  max_consecutive_nights: number;
  monthly_quota_mode: string;
  min_rest_hours: number;
  morning_code: "ช";
  evening_code: "บ";
  night_code: "ด";
  max_consecutive_work_days: number;
  shift_type_balance_weight: number;
  max_double_per_pair_per_7_days: Record<string, number>;
  regular_shift_quota_per_staff: number | null;
  prefer_morning_ot: boolean;
  morning_regular_required: boolean;
  target_off_days_per_staff: number | null;
  repair_warning_rules: boolean;
};

export type GaTraineeRuleInput = {
  enabled: boolean;
  max_per_shift: number;
  max_trainee_per_shift: number;
};

export type GaRuleEngineInput = {
  hard: {
    forbidden_sequences: string[][];
    max_consecutive: Record<string, number>;
    max_consecutive_work_days: number;
  };
};

export type GaPenaltiesInput = {
  hard: Record<string, number>;
  soft: Record<string, number>;
};

export type GaSettingsInput = {
  population_size: number;
  generations: number;
  elite_size: number;
  tournament_size: number;
  crossover_rate: number;
  mutation_rate: number;
  random_seed: number | null;
  stop_if_objective_zero: boolean;
  patience: number;
  log_every: number;
  max_seconds: number;
  full_repair_every: number;
  repair_elite_every: number;
};

export type GaInputValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};
