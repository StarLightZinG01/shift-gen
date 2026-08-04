import { calculateCompensationForAssignments } from "@/lib/compensation/calculate";
import { formatMonthYear } from "@/lib/my-schedule/formatters";
import type {
  CompensationSummaryData,
  ScheduleVersionOption,
  WardCompensationResult,
} from "@/lib/compensation/types";
import { prisma } from "@/lib/prisma";

export async function getCompensationSummary(
  scheduleVersionId?: string | null,
): Promise<CompensationSummaryData> {
  const versions = await prisma.scheduleVersion.findMany({
    where: {
      assignments: {
        some: {},
      },
    },
    include: {
      cycle: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  if (versions.length === 0) {
    return {
      scheduleVersionId: null,
      scheduleVersionLabel: "ยังไม่มีตารางเวร",
      versionOptions: [],
      totalOtAmount: 0,
      totalRegularShiftAmount: 0,
      totalAmount: 0,
      wards: [],
      hasStoredSummary: false,
    };
  }

  const selectedVersion =
    versions.find((version) => version.id === scheduleVersionId) ?? versions[0];
  const [storedSummaries, assignments] = await Promise.all([
    prisma.wardCompensationSummary.findMany({
      where: {
        scheduleVersionId: selectedVersion.id,
      },
      include: {
        ward: true,
        items: true,
      },
      orderBy: {
        ward: {
          code: "asc",
        },
      },
    }),
    prisma.scheduleAssignment.findMany({
      where: {
        scheduleVersionId: selectedVersion.id,
      },
      include: {
        staff: true,
        ward: true,
      },
    }),
  ]);
  const calculatedWards = calculateCompensationForAssignments(assignments);
  const wards =
    storedSummaries.length > 0
      ? mergeStoredAndCalculated(storedSummaries, calculatedWards)
      : calculatedWards;
  const totals = wards.reduce(
    (result, ward) => {
      result.totalOtAmount += ward.totalOtAmount;
      result.totalRegularShiftAmount += ward.totalRegularShiftAmount;
      result.totalAmount += ward.totalAmount;
      return result;
    },
    {
      totalOtAmount: 0,
      totalRegularShiftAmount: 0,
      totalAmount: 0,
    },
  );

  return {
    scheduleVersionId: selectedVersion.id,
    scheduleVersionLabel: formatVersionLabel(selectedVersion),
    versionOptions: versions.map(toVersionOption),
    ...totals,
    wards,
    hasStoredSummary: storedSummaries.length > 0,
  };
}

export async function getWardCompensationDetail(
  scheduleVersionId: string,
  wardId: string,
) {
  const data = await getCompensationSummary(scheduleVersionId);
  return data.wards.find((ward) => ward.wardId === wardId) ?? null;
}

export async function getMyCompensationSummary(
  userId: string,
  scheduleVersionId: string,
) {
  const staff = await prisma.staff.findUnique({
    where: {
      userId,
    },
  });

  if (!staff) {
    return null;
  }

  const data = await getCompensationSummary(scheduleVersionId);
  const staffSummary = data.wards
    .flatMap((ward) => ward.staffSummaries)
    .find((summary) => summary.staffId === staff.id);

  return staffSummary ?? null;
}

function mergeStoredAndCalculated(
  storedSummaries: Array<{
    wardId: string;
    totalOtAmount: unknown;
    totalRegularShiftAmount: unknown;
    totalAmount: unknown;
    ward: {
      id: string;
      code: string;
      name: string;
    };
    items: Array<{
      category: string;
      staffType: string | null;
      rate: unknown;
      quantity: number;
      amount: unknown;
    }>;
  }>,
  calculatedWards: WardCompensationResult[],
) {
  const calculatedByWardId = new Map(
    calculatedWards.map((ward) => [ward.wardId, ward]),
  );

  return storedSummaries.map((summary) => {
    const calculated = calculatedByWardId.get(summary.wardId);

    return {
      wardId: summary.ward.id,
      wardCode: summary.ward.code,
      wardName: summary.ward.name,
      totalOtAmount: Number(summary.totalOtAmount),
      totalRegularShiftAmount: Number(summary.totalRegularShiftAmount),
      totalAmount: Number(summary.totalAmount),
      staffSummaries: calculated?.staffSummaries ?? [],
      items: summary.items.map((item) => ({
        category: item.category === "ot" ? "ot" : "shift_pay",
        staffType: item.staffType ?? "UNKNOWN",
        rate: Number(item.rate),
        quantity: item.quantity,
        amount: Number(item.amount),
      })),
    } satisfies WardCompensationResult;
  });
}

function toVersionOption(version: {
  id: string;
  versionNo: number;
  status: string;
  cycle: {
    month: number;
    year: number;
  };
}): ScheduleVersionOption {
  return {
    id: version.id,
    label: formatVersionLabel(version),
    status: version.status,
  };
}

function formatVersionLabel(version: {
  versionNo: number;
  status: string;
  cycle: {
    month: number;
    year: number;
  };
}) {
  return `${formatMonthYear(version.cycle.month, version.cycle.year)} · v${version.versionNo} · ${formatVersionStatus(version.status)}`;
}

function formatVersionStatus(status: string) {
  return status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง";
}
