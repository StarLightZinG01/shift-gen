import { prisma } from "@/lib/prisma";
import { getGaSettingsData } from "@/lib/schedule-rounds/ga-settings";

import { mockCycle } from "./mock-data";
import type {
  CycleContext,
  ExternalStaffCandidate,
  RequestSummaryRow,
  PreflightSettings,
  SharedStaffUsage,
  StaffingRequirements,
  StaffRow,
  WardContext,
} from "./types";

export async function getSchedulePreflightContext(
  cycleId: string | null,
  wardId: string,
): Promise<{
  settings: PreflightSettings;
  sharedStaffUsage: SharedStaffUsage[];
}> {
  const [gaSettings, otherWardSelections] = await Promise.all([
    getGaSettingsData(),
    cycleId
      ? prisma.wardCycleExternalStaff.findMany({
          where: {
            cycleId,
            wardId: { not: wardId },
          },
          include: {
            staff: {
              select: {
                staffCode: true,
                fullName: true,
              },
            },
            ward: {
              select: {
                code: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const usageByStaff = new Map<string, SharedStaffUsage>();

  for (const selection of otherWardSelections) {
    const existing = usageByStaff.get(selection.staffId);
    if (existing) {
      if (!existing.otherWardCodes.includes(selection.ward.code)) {
        existing.otherWardCodes.push(selection.ward.code);
      }
      continue;
    }

    usageByStaff.set(selection.staffId, {
      staffId: selection.staffId,
      staffCode: selection.staff.staffCode,
      fullName: selection.staff.fullName,
      otherWardCodes: [selection.ward.code],
    });
  }

  return {
    settings: {
      maxShiftsPer7Days: gaSettings.maxShiftsPer7Days,
      maxConsecutiveWorkDays: gaSettings.maxConsecutiveWorkDays,
      maxTraineePerShift: gaSettings.maxTraineePerShift,
      enableMorningEveningDouble: gaSettings.enableMorningEveningDouble,
      enableNightEveningDouble: gaSettings.enableNightEveningDouble,
      morningRegularRequired: gaSettings.morningRegularRequired,
    },
    sharedStaffUsage: Array.from(usageByStaff.values()).map((usage) => ({
      ...usage,
      otherWardCodes: usage.otherWardCodes.sort(),
    })),
  };
}

export async function getWardContext(
  userId: string,
): Promise<WardContext | null> {
  const staff = await prisma.staff.findUnique({
    where: { userId },
    include: {
      homeWard: true,
    },
  });

  if (!staff) {
    return null;
  }

  return {
    id: staff.homeWard.id,
    code: staff.homeWard.code,
    name: staff.homeWard.name,
    isHead: staff.isHead,
  };
}

export async function getWardContextById(
  wardId: string,
): Promise<WardContext | null> {
  const ward = await prisma.ward.findUnique({
    where: {
      id: wardId,
    },
    include: {
      staff: {
        where: {
          isHead: true,
        },
        take: 1,
      },
    },
  });

  if (!ward) {
    return null;
  }

  return {
    id: ward.id,
    code: ward.code,
    name: ward.name,
    isHead: ward.staff.length > 0,
  };
}

export async function getCurrentCycle(): Promise<CycleContext> {
  const cycle = await prisma.scheduleCycle.findFirst({
    where: {
      status: {
        in: ["preparing", "draft", "open"],
      },
    },
    orderBy: [
      {
        year: "desc",
      },
      {
        month: "desc",
      },
    ],
  });

  if (!cycle) {
    return mockCycle;
  }

  const holidays = await getCycleHolidays(cycle.id);

  return {
    id: cycle.id,
    month: cycle.month,
    year: cycle.year,
    status: cycle.status,
    requestOpenDate: cycle.requestOpenDate,
    requestCloseDate: cycle.requestCloseDate,
    dataLockDate: cycle.dataLockDate,
    autoGenerateAt: cycle.autoGenerateAt,
    holidays,
  };
}

export async function getCurrentCycleOrNull(): Promise<CycleContext | null> {
  const cycle =
    (await prisma.scheduleCycle.findFirst({
      where: {
        status: {
          in: ["preparing", "open", "locked"],
        },
      },
      orderBy: [
        {
          year: "desc",
        },
        {
          month: "desc",
        },
      ],
    })) ??
    (await prisma.scheduleCycle.findFirst({
      orderBy: [
        {
          year: "desc",
        },
        {
          month: "desc",
        },
      ],
    }));

  if (!cycle) {
    return null;
  }

  const holidays = await getCycleHolidays(cycle.id);

  return {
    id: cycle.id,
    month: cycle.month,
    year: cycle.year,
    status: cycle.status,
    requestOpenDate: cycle.requestOpenDate,
    requestCloseDate: cycle.requestCloseDate,
    dataLockDate: cycle.dataLockDate,
    autoGenerateAt: cycle.autoGenerateAt,
    holidays,
  };
}

export async function getStaffRowsForWard(
  wardId: string,
  cycleId: string | null,
): Promise<StaffRow[]> {
  const [preparation, homeStaff, externalSelections] = await Promise.all([
    cycleId
      ? prisma.wardCyclePreparation.findUnique({
          where: {
            cycleId_wardId: {
              cycleId,
              wardId,
            },
          },
          include: {
            staffSnapshots: {
              orderBy: {
                staffCode: "asc",
              },
            },
          },
        })
      : Promise.resolve(null),
    prisma.staff.findMany({
      where: {
        homeWardId: wardId,
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
    }),
    cycleId
      ? prisma.wardCycleExternalStaff.findMany({
          where: {
            cycleId,
            wardId,
          },
          include: {
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
          orderBy: {
            selectedAt: "asc",
          },
        })
      : Promise.resolve([]),
  ]);

  const homeStaffById = new Map(homeStaff.map((member) => [member.id, member]));
  const baseStaffRows =
    preparation !== null && preparation.staffSnapshots.length > 0
      ? preparation.staffSnapshots.map((snapshot) =>
          mapSnapshotToRow(snapshot, homeStaffById),
        )
      : homeStaff.map((member) => mapStaffToRow(member, "home"));

  const staffRows = [
    ...baseStaffRows,
    ...externalSelections.map((selection) =>
      mapStaffToRow(selection.staff, "external"),
    ),
  ];

  return applyAvailabilityRequestsToStaffRows(staffRows, cycleId);
}

export async function getExternalStaffCandidates(
  wardId: string,
): Promise<ExternalStaffCandidate[]> {
  const staff = await prisma.staff.findMany({
    where: {
      homeWardId: {
        not: wardId,
      },
      wardPermissions: {
        some: {
          wardId,
        },
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
    orderBy: {
      staffCode: "asc",
    },
  });

  return staff.map((member) => {
    return {
      id: member.id,
      code: member.staffCode,
      fullName: member.fullName,
      homeWard: member.homeWard.code,
      allowedWards: getAllowedWardCodes(member),
      payPosition: member.payPosition ?? member.position ?? "",
      otRate: member.otRate.toString(),
      shiftPayRate: member.shiftPayRate.toString(),
      isHead: member.isHead,
      isTrainee: member.isTrainee,
    };
  });
}

type StaffWithWardPermissions = Awaited<
  ReturnType<typeof prisma.staff.findFirst>
> & {
  homeWard: { code: string };
  wardPermissions: Array<{ ward: { code: string } }>;
};

function mapStaffToRow(
  member: NonNullable<StaffWithWardPermissions>,
  rowType: StaffRow["rowType"],
): StaffRow {
  return {
    id: rowType === "external" ? `external-${member.id}` : member.id,
    staffId: member.id,
    rowType,
    code: member.staffCode,
    fullName: member.fullName,
    homeWard: member.homeWard.code,
    allowedWards: getAllowedWardCodes(member),
    payPosition: member.payPosition ?? member.position ?? "",
    otRate: member.otRate.toString(),
    shiftPayRate: member.shiftPayRate.toString(),
    off: "0",
    vacation: "0",
    leave: "0",
    academic: "0",
    preferredShifts: "0",
    isHead: member.isHead,
    isTrainee: member.isTrainee,
  };
}

function mapSnapshotToRow(
  snapshot: {
    id: string;
    staffId: string | null;
    staffCode: string;
    fullName: string;
    homeWardName: string;
    allowedWardsText: string;
    payPosition: string | null;
    position: string | null;
    otRate: unknown;
    shiftPayRate: unknown;
    isHead: boolean;
    isTrainee: boolean;
  },
  staffById: Map<string, NonNullable<StaffWithWardPermissions>>,
): StaffRow {
  if (snapshot.staffId) {
    const member = staffById.get(snapshot.staffId);

    if (member) {
      return mapStaffToRow(member, "home");
    }
  }

  return {
    id: snapshot.staffId ?? `snapshot-${snapshot.id}`,
    staffId: snapshot.staffId,
    rowType: "home",
    code: snapshot.staffCode,
    fullName: snapshot.fullName,
    homeWard: snapshot.homeWardName,
    allowedWards: splitAllowedWardText(snapshot.allowedWardsText),
    payPosition: snapshot.payPosition ?? snapshot.position ?? "",
    otRate: String(snapshot.otRate ?? 0),
    shiftPayRate: String(snapshot.shiftPayRate ?? 0),
    off: "0",
    vacation: "0",
    leave: "0",
    academic: "0",
    preferredShifts: "0",
    isHead: snapshot.isHead,
    isTrainee: snapshot.isTrainee,
  };
}

function getAllowedWardCodes(member: NonNullable<StaffWithWardPermissions>) {
  const allowedWards = new Set<string>();
  allowedWards.add(member.homeWard.code);

  for (const permission of member.wardPermissions) {
    allowedWards.add(permission.ward.code);
  }

  return Array.from(allowedWards);
}

function splitAllowedWardText(value: string) {
  return value
    .split(/[,\n\r;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getRequestSummaryRows(
  cycleId: string | null,
  wardId: string,
): Promise<RequestSummaryRow[]> {
  if (!cycleId) {
    return [];
  }

  const staffIds = await getCycleWardStaffIds(cycleId, wardId);

  if (staffIds.length === 0) {
    return [];
  }

  const requests = await prisma.availabilityRequest.findMany({
    where: {
      cycleId,
      staffId: {
        in: staffIds,
      },
    },
    include: {
      staff: {
        select: {
          staffCode: true,
          fullName: true,
        },
      },
    },
    orderBy: [
      {
        submittedAt: "desc",
      },
      {
        requestDate: "desc",
      },
    ],
  });

  return requests.map((request) => ({
    id: request.id,
    staffCode: request.staff.staffCode,
    displayName: request.staff.fullName,
    requestType: request.requestType,
    preferredShift: request.preferredShift,
    requestDate: request.requestDate,
    reason: request.reason ?? "",
  }));
}

export async function getStaffingRequirements(
  cycleId: string,
  wardId: string,
): Promise<StaffingRequirements | null> {
  const preparation = await prisma.wardCyclePreparation.findUnique({
    where: {
      cycleId_wardId: {
        cycleId,
        wardId,
      },
    },
    include: {
      staffingRequirements: true,
    },
  });

  if (!preparation) {
    return null;
  }

  const requirements: StaffingRequirements = {};

  for (const requirement of preparation.staffingRequirements) {
    const shiftCode = requirement.shiftCode.toLowerCase();

    if (["night", "n"].includes(shiftCode)) {
      requirements.night = {
        min: requirement.minStaff,
        max: requirement.maxStaff,
      };
    }

    if (["morning", "m"].includes(shiftCode)) {
      requirements.morning = {
        min: requirement.minStaff,
        max: requirement.maxStaff,
      };
    }

    if (["afternoon", "a"].includes(shiftCode)) {
      requirements.afternoon = {
        min: requirement.minStaff,
        max: requirement.maxStaff,
      };
    }
  }

  return requirements;
}

async function applyAvailabilityRequestsToStaffRows(
  staffRows: StaffRow[],
  cycleId: string | null,
): Promise<StaffRow[]> {
  if (!cycleId || staffRows.length === 0) {
    return staffRows;
  }

  const staffIds = staffRows
    .map((row) => row.staffId)
    .filter((staffId): staffId is string => Boolean(staffId));

  if (staffIds.length === 0) {
    return staffRows;
  }

  const requests = await prisma.availabilityRequest.findMany({
    where: {
      cycleId,
      staffId: {
        in: staffIds,
      },
    },
    orderBy: {
      requestDate: "asc",
    },
  });

  const datesByStaff = new Map<
    string,
    {
      off: number[];
      vacation: number[];
      leave: number[];
      academic: number[];
      preferredShifts: string[];
    }
  >();

  for (const request of requests) {
    const current =
      datesByStaff.get(request.staffId) ?? {
        off: [],
        vacation: [],
        leave: [],
        academic: [],
        preferredShifts: [],
      };
    const day = request.requestDate.getUTCDate();

    if (request.requestType === "Off") {
      current.off.push(day);
    }

    if (request.requestType === "V") {
      current.vacation.push(day);
    }

    if (request.requestType === "ล") {
      current.leave.push(day);
    }

    if (request.requestType === "ว") {
      current.academic.push(day);
    }

    if (request.requestType === "PreferredShift" && request.preferredShift) {
      current.preferredShifts.push(`${day}:${request.preferredShift}`);
    }

    datesByStaff.set(request.staffId, current);
  }

  return staffRows.map((row) => {
    if (!row.staffId) {
      return row;
    }

    const dates = datesByStaff.get(row.staffId);

    if (!dates) {
      return row;
    }

    return {
      ...row,
      off: formatRequestDays(dates.off),
      vacation: formatRequestDays(dates.vacation),
      leave: formatRequestDays(dates.leave),
      academic: formatRequestDays(dates.academic),
      preferredShifts: formatPreferredShiftRequests(dates.preferredShifts),
    };
  });
}

async function getCycleWardStaffIds(cycleId: string, wardId: string) {
  const [homeStaff, externalSelections] = await Promise.all([
    prisma.staff.findMany({
      where: {
        homeWardId: wardId,
      },
      select: {
        id: true,
      },
    }),
    prisma.wardCycleExternalStaff.findMany({
      where: {
        cycleId,
        wardId,
      },
      select: {
        staffId: true,
      },
    }),
  ]);

  return Array.from(
    new Set([
      ...homeStaff.map((staff) => staff.id),
      ...externalSelections.map((selection) => selection.staffId),
    ]),
  );
}

function formatRequestDays(days: number[]) {
  if (days.length === 0) {
    return "0";
  }

  return Array.from(new Set(days))
    .sort((a, b) => a - b)
    .join(", ");
}

function formatPreferredShiftRequests(values: string[]) {
  if (values.length === 0) {
    return "0";
  }

  return Array.from(new Set(values))
    .sort((a, b) => Number(a.split(":")[0]) - Number(b.split(":")[0]))
    .join(", ");
}

type CycleHolidayRow = {
  holiday_date: Date;
  label: string | null;
};

async function getCycleHolidays(cycleId: string) {
  const holidays = await prisma.$queryRaw<CycleHolidayRow[]>`
    SELECT holiday_date, label
    FROM schedule_cycle_holidays
    WHERE cycle_id = ${cycleId}::uuid
    ORDER BY holiday_date ASC
  `;

  return holidays.map((holiday) => ({
    date: holiday.holiday_date,
    label: holiday.label,
  }));
}
