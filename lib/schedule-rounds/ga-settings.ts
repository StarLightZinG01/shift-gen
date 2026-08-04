import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

import { defaultGaSettings } from "./ga-settings-defaults";
import type { GaSettingsData } from "./types";

type GaSettingsRow = {
  profile_key: string;
  profile_name: string;
  is_active: boolean;
  population_size: number;
  generations: number;
  patience: number;
  elite_size: number;
  tournament_size: number;
  crossover_rate: number | string;
  mutation_rate: number | string;
  full_repair_every: number;
  repair_elite_every: number;
  random_seed: number | null;
  max_seconds: number;
  max_shifts_per_7_days: number;
  weekly_min_days_off: number;
  max_consecutive_nights: number;
  max_consecutive_work_days: number;
  max_trainee_per_shift: number;
  min_rest_hours: number;
  workload_balance_max_diff: number;
  shift_count_balance_max_diff: number;
  shift_type_balance_max_diff: number;
  target_off_days_per_staff: number | null;
  enable_morning_evening_double: boolean;
  enable_night_evening_double: boolean;
  prefer_morning_ot: boolean;
  morning_regular_required: boolean;
  updated_at: Date;
};

export type SaveGaSettingsInput = Omit<
  GaSettingsData,
  "isActive" | "updatedAtLabel" | "source"
>;

export async function getGaSettingsData(): Promise<GaSettingsData> {
  try {
    const rows = await prisma.$queryRaw<GaSettingsRow[]>`
      SELECT
        profile_key,
        profile_name,
        COALESCE(is_active, false) AS is_active,
        population_size,
        generations,
        patience,
        elite_size,
        tournament_size,
        crossover_rate,
        mutation_rate,
        COALESCE(full_repair_every, 4) AS full_repair_every,
        COALESCE(repair_elite_every, 8) AS repair_elite_every,
        random_seed,
        max_seconds,
        max_shifts_per_7_days,
        weekly_min_days_off,
        max_consecutive_nights,
        max_consecutive_work_days,
        max_trainee_per_shift,
        min_rest_hours,
        workload_balance_max_diff,
        shift_count_balance_max_diff,
        shift_type_balance_max_diff,
        target_off_days_per_staff,
        enable_morning_evening_double,
        enable_night_evening_double,
        prefer_morning_ot,
        morning_regular_required,
        updated_at
      FROM ga_settings
      ORDER BY
        COALESCE(is_active, false) DESC,
        CASE WHEN profile_key = 'default' THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return defaultGaSettings;
    }

    return mapGaSettingsRow(rows[0]);
  } catch {
    return defaultGaSettings;
  }
}

export async function getGaSettingsProfiles(): Promise<GaSettingsData[]> {
  try {
    const rows = await prisma.$queryRaw<GaSettingsRow[]>`
      SELECT
        profile_key,
        profile_name,
        COALESCE(is_active, false) AS is_active,
        population_size,
        generations,
        patience,
        elite_size,
        tournament_size,
        crossover_rate,
        mutation_rate,
        COALESCE(full_repair_every, 4) AS full_repair_every,
        COALESCE(repair_elite_every, 8) AS repair_elite_every,
        random_seed,
        max_seconds,
        max_shifts_per_7_days,
        weekly_min_days_off,
        max_consecutive_nights,
        max_consecutive_work_days,
        max_trainee_per_shift,
        min_rest_hours,
        workload_balance_max_diff,
        shift_count_balance_max_diff,
        shift_type_balance_max_diff,
        target_off_days_per_staff,
        enable_morning_evening_double,
        enable_night_evening_double,
        prefer_morning_ot,
        morning_regular_required,
        updated_at
      FROM ga_settings
      ORDER BY
        COALESCE(is_active, false) DESC,
        profile_name ASC,
        updated_at DESC
    `;

    if (rows.length === 0) {
      return [defaultGaSettings];
    }

    return rows.map(mapGaSettingsRow);
  } catch {
    return [defaultGaSettings];
  }
}

export async function activateGaSettingsProfile(profileKey: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE ga_settings
      SET is_active = false
      WHERE is_active = true
    `;

    await tx.$executeRaw`
      UPDATE ga_settings
      SET is_active = true,
          updated_at = NOW()
      WHERE profile_key = ${profileKey}
    `;
  });
}

export async function saveGaSettingsData(input: SaveGaSettingsInput, userId: string) {
  const id = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE ga_settings
      SET is_active = false
      WHERE is_active = true
    `;

    await tx.$executeRaw`
    INSERT INTO ga_settings (
      id,
      profile_key,
      profile_name,
      is_active,
      population_size,
      generations,
      patience,
      elite_size,
      tournament_size,
      crossover_rate,
      mutation_rate,
      full_repair_every,
      repair_elite_every,
      random_seed,
      max_seconds,
      max_shifts_per_7_days,
      weekly_min_days_off,
      max_consecutive_nights,
      max_consecutive_work_days,
      max_trainee_per_shift,
      min_rest_hours,
      workload_balance_max_diff,
      shift_count_balance_max_diff,
      shift_type_balance_max_diff,
      target_off_days_per_staff,
      enable_morning_evening_double,
      enable_night_evening_double,
      prefer_morning_ot,
      morning_regular_required,
      updated_by,
      updated_at
    )
    VALUES (
      ${id}::uuid,
      ${input.profileKey},
      ${input.profileName},
      true,
      ${input.populationSize},
      ${input.generations},
      ${input.patience},
      ${input.eliteSize},
      ${input.tournamentSize},
      ${input.crossoverRate},
      ${input.mutationRate},
      ${input.fullRepairEvery},
      ${input.repairEliteEvery},
      ${input.randomSeed},
      ${input.maxSeconds},
      ${input.maxShiftsPer7Days},
      ${input.weeklyMinDaysOff},
      ${input.maxConsecutiveNights},
      ${input.maxConsecutiveWorkDays},
      ${input.maxTraineePerShift},
      ${input.minRestHours},
      ${input.workloadBalanceMaxDiff},
      ${input.shiftCountBalanceMaxDiff},
      ${input.shiftTypeBalanceMaxDiff},
      ${input.targetOffDaysPerStaff},
      ${input.enableMorningEveningDouble},
      ${input.enableNightEveningDouble},
      ${input.preferMorningOt},
      ${input.morningRegularRequired},
      ${userId}::uuid,
      NOW()
    )
    ON CONFLICT (profile_key) DO UPDATE SET
      profile_name = EXCLUDED.profile_name,
      is_active = true,
      population_size = EXCLUDED.population_size,
      generations = EXCLUDED.generations,
      patience = EXCLUDED.patience,
      elite_size = EXCLUDED.elite_size,
      tournament_size = EXCLUDED.tournament_size,
      crossover_rate = EXCLUDED.crossover_rate,
      mutation_rate = EXCLUDED.mutation_rate,
      full_repair_every = EXCLUDED.full_repair_every,
      repair_elite_every = EXCLUDED.repair_elite_every,
      random_seed = EXCLUDED.random_seed,
      max_seconds = EXCLUDED.max_seconds,
      max_shifts_per_7_days = EXCLUDED.max_shifts_per_7_days,
      weekly_min_days_off = EXCLUDED.weekly_min_days_off,
      max_consecutive_nights = EXCLUDED.max_consecutive_nights,
      max_consecutive_work_days = EXCLUDED.max_consecutive_work_days,
      max_trainee_per_shift = EXCLUDED.max_trainee_per_shift,
      min_rest_hours = EXCLUDED.min_rest_hours,
      workload_balance_max_diff = EXCLUDED.workload_balance_max_diff,
      shift_count_balance_max_diff = EXCLUDED.shift_count_balance_max_diff,
      shift_type_balance_max_diff = EXCLUDED.shift_type_balance_max_diff,
      target_off_days_per_staff = EXCLUDED.target_off_days_per_staff,
      enable_morning_evening_double = EXCLUDED.enable_morning_evening_double,
      enable_night_evening_double = EXCLUDED.enable_night_evening_double,
      prefer_morning_ot = EXCLUDED.prefer_morning_ot,
      morning_regular_required = EXCLUDED.morning_regular_required,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    `;
  });
}

function mapGaSettingsRow(row: GaSettingsRow): GaSettingsData {
  return {
    profileKey: row.profile_key,
    profileName: row.profile_name,
    isActive: row.is_active,
    populationSize: row.population_size,
    generations: row.generations,
    patience: row.patience,
    eliteSize: row.elite_size,
    tournamentSize: row.tournament_size,
    crossoverRate: Number(row.crossover_rate),
    mutationRate: Number(row.mutation_rate),
    fullRepairEvery: row.full_repair_every,
    repairEliteEvery: row.repair_elite_every,
    randomSeed: row.random_seed,
    maxSeconds: row.max_seconds,
    maxShiftsPer7Days: row.max_shifts_per_7_days,
    weeklyMinDaysOff: row.weekly_min_days_off,
    maxConsecutiveNights: row.max_consecutive_nights,
    maxConsecutiveWorkDays: row.max_consecutive_work_days,
    maxTraineePerShift: row.max_trainee_per_shift,
    minRestHours: row.min_rest_hours,
    workloadBalanceMaxDiff: row.workload_balance_max_diff,
    shiftCountBalanceMaxDiff: row.shift_count_balance_max_diff,
    shiftTypeBalanceMaxDiff: row.shift_type_balance_max_diff,
    targetOffDaysPerStaff: row.target_off_days_per_staff,
    enableMorningEveningDouble: row.enable_morning_evening_double,
    enableNightEveningDouble: row.enable_night_evening_double,
    preferMorningOt: row.prefer_morning_ot,
    morningRegularRequired: row.morning_regular_required,
    updatedAtLabel: formatDateTime(row.updated_at),
    source: "database",
  };
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
