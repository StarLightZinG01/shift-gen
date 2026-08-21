import { prisma } from "@/lib/prisma";
import { getGaSettingsData } from "@/lib/schedule-rounds/ga-settings";

import {
  buildMonthInfo,
  defaultPenalties,
  defaultRules,
  defaultShifts,
  normalizeRequestType,
  normalizeShiftCode,
  safeStaffingRange,
  splitAllowedWardText,
  toDateString,
  toDateTimeString,
  toNumber,
} from "./formatters";
import { MAX_CONSECUTIVE_NIGHTS } from "./constants";
import type {
  GaAvailabilityRequestInput,
  GaInput,
  GaPreferredShiftRequestInput,
  GaStaffInput,
  GaStaffingRange,
  GaWardInput,
  GaWardStaffInput,
} from "./types";
import { validateGaInput } from "./validators";

type StaffRecord = {
  id: string;
  staffCode: string;
  fullName: string;
  homeWardId: string;
  position: string | null;
  payPosition: string | null;
  otRate: unknown;
  shiftPayRate: unknown;
  isHead: boolean;
  isTrainee: boolean;
  homeWard: {
    id: string;
    code: string;
    name: string;
  };
  wardPermissions: Array<{
    ward: {
      id: string;
      code: string;
      name: string;
    };
  }>;
};

type StaffAccumulator = GaWardStaffInput & {
  specialDays: Record<string, "V" | "ว" | "ล" | "0">;
};

export async function buildGaInput(cycleId: string): Promise<GaInput> {
  if (!cycleId.trim()) {
    throw new Error("ต้องระบุ cycleId");
  }

  const cycle = await prisma.scheduleCycle.findUnique({
    where: {
      id: cycleId,
    },
    include: {
      preparations: {
        include: {
          ward: true,
          staffingRequirements: true,
          staffSnapshots: {
            orderBy: {
              staffCode: "asc",
            },
          },
        },
        orderBy: {
          ward: {
            code: "asc",
          },
        },
      },
      externalStaff: {
        include: {
          ward: true,
          staff: {
            include: {
              homeWard: true,
              wardPermissions: {
                include: {
                  ward: true,
                },
              },
            },
          },
        },
      },
      availabilityRequests: {
        include: {
          staff: {
            include: {
              homeWard: true,
            },
          },
        },
        orderBy: [
          {
            requestDate: "asc",
          },
          {
            staff: {
              staffCode: "asc",
            },
          },
        ],
      },
    },
  });

  if (!cycle) {
    throw new Error("ไม่พบรอบจัดตารางนี้");
  }

  const wardIds = cycle.preparations.map((preparation) => preparation.wardId);
  const homeStaff = await prisma.staff.findMany({
    where: {
      homeWardId: {
        in: wardIds,
      },
    },
    include: {
      homeWard: true,
      wardPermissions: {
        include: {
          ward: true,
        },
      },
    },
    orderBy: [
      {
        isHead: "desc",
      },
      {
        staffCode: "asc",
      },
    ],
  });

  const staffById = new Map<string, StaffRecord>();
  for (const staff of homeStaff) {
    staffById.set(staff.id, staff);
  }
  for (const selection of cycle.externalStaff) {
    staffById.set(selection.staff.id, selection.staff);
  }

  const wardByCode = new Map(
    cycle.preparations.map((preparation) => [preparation.ward.code, preparation.ward]),
  );
  const wardById = new Map(
    cycle.preparations.map((preparation) => [preparation.ward.id, preparation.ward]),
  );

  const requests = buildAvailabilityRequests(cycle.availabilityRequests, cycle.year, cycle.month);
  const specialDaysByStaffCode = buildSpecialDaysByStaffCode(requests);
  const gaStaffByCode = new Map<string, StaffAccumulator>();

  const wards: GaWardInput[] = cycle.preparations.map((preparation) => {
    const fallbackStaff = homeStaff.filter((staff) => staff.homeWardId === preparation.wardId);
    const sourceStaff =
      preparation.staffSnapshots.length > 0 || preparation.submittedAt
        ? preparation.staffSnapshots.map((snapshot) =>
            mapSnapshotToWardStaff(snapshot, staffById, wardByCode, wardById),
          )
        : fallbackStaff.map((staff) => mapStaffRecordToWardStaff(staff, false));

    const externalStaff = cycle.externalStaff
      .filter((selection) => selection.wardId === preparation.wardId)
      .map((selection) => mapStaffRecordToWardStaff(selection.staff, true, selection.ward.code));

    const staff = deduplicateWardStaff([...sourceStaff, ...externalStaff]);

    for (const staffMember of staff) {
      mergeGaStaffAccumulator(gaStaffByCode, staffMember, specialDaysByStaffCode.get(staffMember.code) ?? {});
    }

    return {
      id: preparation.ward.id,
      code: preparation.ward.code,
      name: preparation.ward.name,
      preparationId: preparation.id,
      preparationStatus: preparation.status,
      requirements: buildRequirementMap(preparation.staffingRequirements),
      staff,
    };
  });

  const gaSettings = await getGaSettingsData();
  const holidayDays = await getCycleHolidayDays(cycle.id);
  const enableMorningEveningDouble = true;
  const enableNightEveningDouble = true;
  const rules = {
    ...defaultRules(),
    allow_double_shift_codes: [
      ...(enableMorningEveningDouble ? ["ช/บ"] : []),
      ...(enableNightEveningDouble ? ["ด/บ"] : []),
    ],
    double_shift_pair: [
      ...(enableMorningEveningDouble ? [["ช", "บ"]] : []),
      ...(enableNightEveningDouble ? [["ด", "บ"]] : []),
    ],
    max_consecutive_nights: MAX_CONSECUTIVE_NIGHTS,
    min_rest_hours: gaSettings.minRestHours,
    max_consecutive_work_days: gaSettings.maxConsecutiveWorkDays,
    target_off_days_per_staff: null,
    prefer_morning_ot: true,
    morning_regular_required: true,
  };
  const monthInfo = buildMonthInfo(cycle.year, cycle.month, holidayDays);

  const inputWithoutValidation = {
    cycle: {
      id: cycle.id,
      year: cycle.year,
      month: cycle.month,
      status: cycle.status,
      days: monthInfo.days,
      requestOpenDate: toDateString(cycle.requestOpenDate),
      requestCloseDate: toDateString(cycle.requestCloseDate),
      dataLockDate: toDateString(cycle.dataLockDate),
      autoGenerateAt: toDateTimeString(cycle.autoGenerateAt),
    },
    department: wards[0]?.code ?? "ShiftGen",
    wards,
    year: cycle.year,
    month: cycle.month,
    thai_weekday: true,
    staff: Array.from(gaStaffByCode.values()).map((staff) =>
      toGaStaffInput(staff, gaSettings.maxShiftsPer7Days),
    ),
    shifts: defaultShifts({
      enableMorningEveningDouble,
      enableNightEveningDouble,
    }),
    coverage: {
      default: Object.fromEntries(
        wards.map((ward) => [
          ward.code,
          {
            "ช": safeStaffingRange(ward.requirements["ช"]),
            "บ": safeStaffingRange(ward.requirements["บ"]),
            "ด": safeStaffingRange(ward.requirements["ด"]),
            ...(enableMorningEveningDouble
              ? { "ช/บ": { min: 0, max: 2 } }
              : {}),
            ...(enableNightEveningDouble
              ? { "ด/บ": { min: 0, max: 2 } }
              : {}),
          },
        ]),
      ),
      by_day: {},
    },
    holidays: holidayDays,
    monthInfo,
    availabilityRequests: requests,
    preferredShiftRequests: buildPreferredShiftRequests(requests),
    rules,
    trainee_rule: {
      enabled: true,
      max_per_shift: gaSettings.maxTraineePerShift,
      max_trainee_per_shift: gaSettings.maxTraineePerShift,
    },
    rule_engine: {
      hard: {
        forbidden_sequences: [["บ", "ด"]],
        max_consecutive: {
          "ด": rules.max_consecutive_nights,
        },
        max_consecutive_work_days: gaSettings.maxConsecutiveWorkDays,
      },
    },
    penalties: defaultPenalties(),
    ga: {
      population_size: gaSettings.populationSize,
      generations: gaSettings.generations,
      elite_size: gaSettings.eliteSize,
      tournament_size: gaSettings.tournamentSize,
      crossover_rate: gaSettings.crossoverRate,
      mutation_rate: gaSettings.mutationRate,
      random_seed: gaSettings.randomSeed,
      stop_if_objective_zero: false,
      patience: gaSettings.patience,
      log_every: 5,
      max_seconds: gaSettings.maxSeconds,
      full_repair_every: gaSettings.fullRepairEvery,
      repair_elite_every: gaSettings.repairEliteEvery,
    },
    custom_rules: [],
  };

  return {
    ...inputWithoutValidation,
    validation: validateGaInput(inputWithoutValidation),
  };
}

type CycleHolidayDayRow = {
  holiday_date: Date;
};

async function getCycleHolidayDays(cycleId: string) {
  const rows = await prisma.$queryRaw<CycleHolidayDayRow[]>`
    SELECT holiday_date
    FROM schedule_cycle_holidays
    WHERE cycle_id = ${cycleId}::uuid
    ORDER BY holiday_date ASC
  `;

  return rows.map((row) => row.holiday_date.getUTCDate());
}

function buildRequirementMap(
  requirements: Array<{ shiftCode: string; minStaff: number; maxStaff: number }>,
): Record<"ช" | "บ" | "ด", GaStaffingRange | null> {
  const result: Record<"ช" | "บ" | "ด", GaStaffingRange | null> = {
    "ช": null,
    "บ": null,
    "ด": null,
  };

  for (const requirement of requirements) {
    const shiftCode = normalizeShiftCode(requirement.shiftCode);

    if (!shiftCode) {
      continue;
    }

    result[shiftCode] = {
      min: requirement.minStaff,
      max: requirement.maxStaff,
    };
  }

  return result;
}

function mapStaffRecordToWardStaff(
  staff: StaffRecord,
  isExternal: boolean,
  selectedWardCode?: string,
): GaWardStaffInput {
  const allowedWards = getAllowedWards(staff);

  if (selectedWardCode && !allowedWards.codes.includes(selectedWardCode)) {
    allowedWards.codes.push(selectedWardCode);
  }

  return {
    id: staff.id,
    code: staff.staffCode,
    name: staff.fullName,
    homeWardId: staff.homeWardId,
    homeWardName: staff.homeWard.code,
    allowedWardIds: allowedWards.ids,
    allowedWardCodes: allowedWards.codes,
    isExternal,
    isHead: staff.isHead,
    isTrainee: staff.isTrainee,
    position: staff.position ?? "",
    payPosition: staff.payPosition ?? staff.position ?? "",
    otRate: toNumber(staff.otRate),
    shiftPayRate: toNumber(staff.shiftPayRate),
    regularWorkTarget: null,
  };
}

function mapSnapshotToWardStaff(
  snapshot: {
    staffId: string | null;
    staffCode: string;
    fullName: string;
    homeWardName: string;
    allowedWardsText: string;
    position: string | null;
    payPosition: string | null;
    otRate: unknown;
    shiftPayRate: unknown;
    isHead: boolean;
    isTrainee: boolean;
  },
  staffById: Map<string, StaffRecord>,
  wardByCode: Map<string, { id: string; code: string }>,
  wardById: Map<string, { id: string; code: string }>,
): GaWardStaffInput {
  if (snapshot.staffId) {
    const staff = staffById.get(snapshot.staffId);

    if (staff) {
      return mapStaffRecordToWardStaff(staff, false);
    }
  }

  const allowedWardCodes = splitAllowedWardText(snapshot.allowedWardsText);
  const homeWard = wardByCode.get(snapshot.homeWardName) ?? wardById.get(snapshot.homeWardName);
  if (homeWard && !allowedWardCodes.includes(homeWard.code)) {
    allowedWardCodes.unshift(homeWard.code);
  }

  return {
    id: snapshot.staffId,
    code: snapshot.staffCode,
    name: snapshot.fullName,
    homeWardId: homeWard?.id ?? null,
    homeWardName: snapshot.homeWardName,
    allowedWardIds: allowedWardCodes
      .map((code) => wardByCode.get(code)?.id)
      .filter((id): id is string => Boolean(id)),
    allowedWardCodes,
    isExternal: false,
    isHead: snapshot.isHead,
    isTrainee: snapshot.isTrainee,
    position: snapshot.position ?? "",
    payPosition: snapshot.payPosition ?? snapshot.position ?? "",
    otRate: toNumber(snapshot.otRate),
    shiftPayRate: toNumber(snapshot.shiftPayRate),
    regularWorkTarget: null,
  };
}

function getAllowedWards(staff: StaffRecord) {
  const wardIds = new Set<string>([staff.homeWard.id]);
  const wardCodes = new Set<string>([staff.homeWard.code]);

  for (const permission of staff.wardPermissions) {
    wardIds.add(permission.ward.id);
    wardCodes.add(permission.ward.code);
  }

  return {
    ids: Array.from(wardIds),
    codes: Array.from(wardCodes),
  };
}

function deduplicateWardStaff(staff: GaWardStaffInput[]) {
  const result = new Map<string, GaWardStaffInput>();

  for (const staffMember of staff) {
    const key = staffMember.id ?? staffMember.code.toLowerCase();
    const existing = result.get(key);

    if (!existing) {
      result.set(key, staffMember);
      continue;
    }

    result.set(key, {
      ...existing,
      allowedWardIds: Array.from(new Set([...existing.allowedWardIds, ...staffMember.allowedWardIds])),
      allowedWardCodes: Array.from(new Set([...existing.allowedWardCodes, ...staffMember.allowedWardCodes])),
      isExternal: existing.isExternal || staffMember.isExternal,
      isHead: existing.isHead || staffMember.isHead,
      isTrainee: existing.isTrainee || staffMember.isTrainee,
    });
  }

  return Array.from(result.values());
}

function mergeGaStaffAccumulator(
  staffByCode: Map<string, StaffAccumulator>,
  staff: GaWardStaffInput,
  specialDays: Record<string, "V" | "ว" | "ล" | "0">,
) {
  const key = staff.code;
  const existing = staffByCode.get(key);

  if (!existing) {
    staffByCode.set(key, {
      ...staff,
      specialDays,
    });
    return;
  }

  staffByCode.set(key, {
    ...existing,
    allowedWardIds: Array.from(new Set([...existing.allowedWardIds, ...staff.allowedWardIds])),
    allowedWardCodes: Array.from(new Set([...existing.allowedWardCodes, ...staff.allowedWardCodes])),
    isExternal: existing.isExternal || staff.isExternal,
    isHead: existing.isHead || staff.isHead,
    isTrainee: existing.isTrainee || staff.isTrainee,
    specialDays: {
      ...existing.specialDays,
      ...specialDays,
    },
  });
}

function toGaStaffInput(staff: StaffAccumulator, maxShiftsPer7Days: number): GaStaffInput {
  return {
    id: staff.code,
    unit: staff.homeWardName,
    home_ward: staff.homeWardName,
    allowed_wards: staff.allowedWardCodes.length > 0 ? staff.allowedWardCodes : [staff.homeWardName],
    role: "nurse",
    position: staff.isHead ? "Head Nurse" : staff.isTrainee ? "Trainee Nurse" : staff.position || "RN",
    pay_position: staff.payPosition,
    ot_rate: staff.otRate,
    shift_allowance: {
      "ช": 0,
      "บ": staff.shiftPayRate,
      "ด": staff.shiftPayRate,
    },
    is_trainee: staff.isTrainee,
    is_head: staff.isHead,
    max_shifts_per_7_days: maxShiftsPer7Days,
    monthly_quota: staff.regularWorkTarget,
    special_days: staff.specialDays,
  };
}

function buildAvailabilityRequests(
  requests: Array<{
    staffId: string;
    requestDate: Date;
    requestType: string;
    preferredShift: string | null;
    reason: string | null;
    staff: {
      staffCode: string;
    };
  }>,
  year: number,
  month: number,
): GaAvailabilityRequestInput[] {
  const calendarYear = normalizeYear(year);

  return requests
    .map((request) => {
      const requestMonth = request.requestDate.getUTCMonth() + 1;
      const requestYear = request.requestDate.getUTCFullYear();

      if (requestMonth !== month || requestYear !== calendarYear) {
        return null;
      }

      const normalized = normalizeRequestType(request.requestType);

      return {
        staffId: request.staffId,
        staffCode: request.staff.staffCode,
        date: request.requestDate.toISOString().slice(0, 10),
        day: request.requestDate.getUTCDate(),
        requestType: normalized.requestType,
        gaCode: normalized.gaCode,
        preferredShift: request.preferredShift,
        reason: request.reason,
      };
    })
    .filter((request): request is GaAvailabilityRequestInput => request !== null);
}

function normalizeYear(year: number) {
  return year > 2400 ? year - 543 : year;
}

function buildSpecialDaysByStaffCode(requests: GaAvailabilityRequestInput[]) {
  const result = new Map<string, Record<string, "V" | "ว" | "ล" | "0">>();

  for (const request of requests) {
    if (!request.gaCode) {
      continue;
    }

    const current = result.get(request.staffCode) ?? {};
    current[String(request.day)] = request.gaCode;
    result.set(request.staffCode, current);
  }

  return result;
}

function buildPreferredShiftRequests(
  requests: GaAvailabilityRequestInput[],
): GaPreferredShiftRequestInput[] {
  return requests
    .filter(
      (request) =>
        request.requestType === "preferred_shift" && Boolean(request.preferredShift),
    )
    .map((request) => ({
      staffId: request.staffId,
      staffCode: request.staffCode,
      date: request.date,
      day: request.day,
      preferredShift: request.preferredShift!,
      reason: request.reason,
    }));
}
