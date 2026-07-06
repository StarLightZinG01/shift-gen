import { prisma } from "@/lib/prisma";

import { mockCycle } from "./mock-data";
import type {
  CycleContext,
  ExternalStaffCandidate,
  RequestSummaryRow,
  StaffingRequirements,
  StaffRow,
  WardContext,
} from "./types";

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

  return {
    id: cycle.id,
    month: cycle.month,
    year: cycle.year,
    status: cycle.status,
    requestOpenDate: cycle.requestOpenDate,
    requestCloseDate: cycle.requestCloseDate,
    dataLockDate: cycle.dataLockDate,
    autoGenerateAt: cycle.autoGenerateAt,
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

  return {
    id: cycle.id,
    month: cycle.month,
    year: cycle.year,
    status: cycle.status,
    requestOpenDate: cycle.requestOpenDate,
    requestCloseDate: cycle.requestCloseDate,
    dataLockDate: cycle.dataLockDate,
    autoGenerateAt: cycle.autoGenerateAt,
  };
}

export async function getStaffRowsForWard(
  wardId: string,
  cycleId: string | null,
): Promise<StaffRow[]> {
  const [homeStaff, externalSelections] = await Promise.all([
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

  return [
    ...homeStaff.map((member) => mapStaffToRow(member, "home")),
    ...externalSelections.map((selection) =>
      mapStaffToRow(selection.staff, "external"),
    ),
  ];
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
    isHead: member.isHead,
    isTrainee: member.isTrainee,
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

export async function getRequestSummaryRows(
  cycleId: string | null,
  wardId: string,
): Promise<RequestSummaryRow[]> {
  if (!cycleId) {
    return [];
  }

  const requests = await prisma.availabilityRequest.findMany({
    where: {
      cycleId,
      staff: {
        homeWardId: wardId,
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
