import { prisma } from "@/lib/prisma";
import {
  isActiveGaRunStatus,
  mapGaRunSummary,
} from "@/lib/ga-runs/queries";
import {
  getGaSettingsData,
  getGaSettingsProfiles,
} from "@/lib/schedule-rounds/ga-settings";
import { getCompensationSummary } from "@/lib/compensation/queries";
import { getManualScheduleData } from "@/lib/manual-schedule/queries";

import type {
  CompensationSummaryData,
  GaSettingsData,
  LatestScheduleRound,
  ManualScheduleData,
  OverviewStat,
  ScheduleDataOverview,
  ScheduleRoundRow,
  ScheduleRoundsData,
  ScheduleRoundStatus,
  WardPreparationStatus,
  UserManagementData,
  UserManagementRole,
} from "./types";

type ScheduleRoundsDashboardData = {
  overviewStats: OverviewStat[];
  latestScheduleRound: LatestScheduleRound;
  userManagement: UserManagementData;
  scheduleRounds: ScheduleRoundsData;
  scheduleData: ScheduleDataOverview;
  gaSettings: GaSettingsData;
  gaSettingsProfiles: GaSettingsData[];
  compensation: CompensationSummaryData;
  manualSchedule: ManualScheduleData;
};

export async function getScheduleRoundsDashboardData({
  compensationVersionId,
  manualVersionId,
  manualWardId,
}: {
  compensationVersionId?: string;
  manualVersionId?: string;
  manualWardId?: string;
} = {}): Promise<ScheduleRoundsDashboardData> {
  const latestCycle = await prisma.scheduleCycle.findFirst({
    orderBy: [
      {
        year: "desc",
      },
      {
        month: "desc",
      },
    ],
  });

  const [
    totalUsers,
    wardHeads,
    clinicalStaff,
    totalWards,
    submittedWards,
    runningGaJobs,
    publishedSchedules,
    userManagement,
    scheduleRounds,
    scheduleData,
    gaSettings,
    gaSettingsProfiles,
    compensation,
    manualSchedule,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.staff.count({
      where: {
        isHead: true,
      },
    }),
    prisma.staff.count({
      where: {
        isHead: false,
      },
    }),
    prisma.ward.count(),
    latestCycle
      ? prisma.wardCyclePreparation.count({
          where: {
            cycleId: latestCycle.id,
          },
        })
      : Promise.resolve(0),
    prisma.gaRun.count({
      where: {
        status: {
          in: ["queued", "running", "processing"],
        },
      },
    }),
    prisma.scheduleVersion.count({
      where: {
        OR: [
          {
            status: "published",
          },
          {
            publishedAt: {
              not: null,
            },
          },
        ],
      },
    }),
    getUserManagementData(),
    getScheduleRoundsData(),
    getScheduleDataOverview(),
    getGaSettingsData(),
    getGaSettingsProfiles(),
    getCompensationSummary(compensationVersionId),
    getManualScheduleData({
      versionId: manualVersionId,
      wardId: manualWardId,
    }),
  ]);

  const pendingWards = Math.max(totalWards - submittedWards, 0);

  return {
    overviewStats: [
      {
        id: "total-users",
        label: "ผู้ใช้ทั้งหมด",
        value: totalUsers.toString(),
        tone: "teal",
      },
      {
        id: "ward-heads",
        label: "หัวหน้าวอร์ด",
        value: wardHeads.toString(),
        tone: "blue",
      },
      {
        id: "clinical-staff",
        label: "พยาบาล/แพทย์",
        value: clinicalStaff.toString(),
        tone: "green",
      },
      {
        id: "total-wards",
        label: "วอร์ดทั้งหมด",
        value: totalWards.toString(),
        tone: "purple",
      },
      {
        id: "submitted-wards",
        label: "วอร์ดส่งข้อมูลแล้ว",
        value: `${submittedWards}/${totalWards}`,
        tone: "green",
      },
      {
        id: "pending-wards",
        label: "วอร์ดยังไม่ส่งข้อมูล",
        value: pendingWards.toString(),
        tone: "yellow",
      },
      {
        id: "running-ga",
        label: "งาน GA กำลังรัน",
        value: runningGaJobs.toString(),
        tone: "teal",
      },
      {
        id: "published-schedules",
        label: "ตารางเผยแพร่แล้ว",
        value: publishedSchedules.toString(),
        tone: "gray",
      },
    ],
    latestScheduleRound: {
      title: "สถานะรอบจัดตารางล่าสุด",
      monthLabel: latestCycle
        ? formatScheduleMonthYear(latestCycle.month, latestCycle.year)
        : "ยังไม่มีรอบจัดตาราง",
      statusLabel: latestCycle ? formatCycleStatus(latestCycle.status) : "-",
      submittedWards,
      totalWards,
    },
    userManagement,
    scheduleRounds,
    scheduleData,
    gaSettings,
    gaSettingsProfiles,
    compensation,
    manualSchedule,
  };
}

export async function getScheduleDataOverview(): Promise<ScheduleDataOverview> {
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

  const wards = await prisma.ward.findMany({
    include: {
      staff: {
        where: {
          isHead: true,
        },
        orderBy: {
          staffCode: "asc",
        },
      },
      preparations: cycle
        ? {
            where: {
              cycleId: cycle.id,
            },
          }
        : false,
    },
    orderBy: {
      code: "asc",
    },
  });

  if (!cycle) {
    return {
      cycle: null,
      summary: {
        totalWards: wards.length,
        completedWards: 0,
        incompleteWards: 0,
        draftWards: wards.length,
      },
      rows: [],
    };
  }

  const rows = wards.map((ward) => {
    const status = normalizePreparationStatus(ward.preparations[0]?.status);

    return {
      wardId: ward.id,
      wardCode: ward.code,
      wardName: ward.name,
      headNames: ward.staff.map((member) => member.fullName),
      status,
      statusLabel: formatPreparationStatus(status),
    };
  });

  return {
    cycle: {
      id: cycle.id,
      month: cycle.month,
      year: cycle.year,
      monthLabel: formatScheduleMonthYear(cycle.month, cycle.year),
      status: cycle.status,
      statusLabel: formatCycleStatus(cycle.status),
    },
    summary: {
      totalWards: rows.length,
      completedWards: rows.filter((row) =>
        ["submitted", "ready"].includes(row.status),
      ).length,
      incompleteWards: rows.filter((row) => row.status === "needs_fix").length,
      draftWards: rows.filter((row) => row.status === "draft").length,
    },
    rows,
  };
}

export async function getScheduleRoundsData(): Promise<ScheduleRoundsData> {
  const [rounds, totalWards] = await Promise.all([
    prisma.scheduleCycle.findMany({
      include: {
        preparations: {
          select: {
            status: true,
            ward: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
          orderBy: {
            ward: {
              code: "asc",
            },
          },
        },
        gaRuns: {
          where: {
            batchId: null,
          },
          select: {
            id: true,
            status: true,
            generationCount: true,
            objective: true,
            fitness: true,
            createdAt: true,
            startedAt: true,
            finishedAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        gaRunBatches: {
          select: {
            id: true,
            status: true,
            objective: true,
            fitness: true,
            createdAt: true,
            startedAt: true,
            finishedAt: true,
            groupCount: true,
            completedGroupCount: true,
            failedGroupCount: true,
            runs: {
              select: {
                id: true,
                status: true,
                groupIndex: true,
                settingsSnapshot: true,
              },
              orderBy: {
                groupIndex: "asc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
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
    }),
    prisma.ward.count(),
  ]);

  const holidaysByCycleId = await getHolidayDatesByCycleId(
    rounds.map((round) => round.id),
  );

  return {
    rounds: rounds.map((round) =>
      mapScheduleRoundRow(round, totalWards, holidaysByCycleId.get(round.id) ?? []),
    ),
    totalWards,
  };
}

function mapScheduleRoundRow(
  round: {
    id: string;
    year: number;
    month: number;
    status: string;
    requestOpenDate: Date | null;
    requestCloseDate: Date | null;
    dataLockDate: Date | null;
    autoGenerateAt: Date | null;
    createdAt: Date;
    preparations: Array<{
      status: string;
      ward: {
        id: string;
        code: string;
        name: string;
      };
    }>;
    gaRuns: Array<{
      id: string;
      status: string;
      generationCount: number | null;
      objective: unknown;
      fitness: unknown;
      createdAt: Date;
      startedAt: Date | null;
      finishedAt: Date | null;
    }>;
    gaRunBatches: Array<{
      id: string;
      status: string;
      objective: unknown;
      fitness: unknown;
      createdAt: Date;
      startedAt: Date | null;
      finishedAt: Date | null;
      groupCount: number;
      completedGroupCount: number;
      failedGroupCount: number;
      runs: Array<{
        id: string;
        status: string;
        groupIndex: number | null;
        settingsSnapshot: unknown;
      }>;
    }>;
  },
  totalWards: number,
  holidays: Array<{ date: Date; label: string | null }>,
): ScheduleRoundRow {
  const submittedWards = round.preparations.filter((preparation) =>
    ["submitted", "ready"].includes(preparation.status),
  ).length;
  const latestBatch = round.gaRunBatches[0] ?? null;
  const latestChildRun = round.gaRuns[0] ?? null;
  const latestRecord =
    latestBatch &&
    (!latestChildRun || latestBatch.createdAt >= latestChildRun.createdAt)
      ? {
          ...latestBatch,
          generationCount: null,
        }
      : latestChildRun;
  const latestGaRun = latestRecord ? mapGaRunSummary(latestRecord) : null;

  return {
    id: round.id,
    year: round.year,
    month: round.month,
    monthLabel: formatScheduleMonthYear(round.month, round.year),
    status: normalizeScheduleRoundStatus(round.status),
    statusLabel: formatCycleStatus(round.status),
    requestOpenDate: toDateInputValue(round.requestOpenDate),
    requestCloseDate: toDateInputValue(round.requestCloseDate),
    dataLockDate: toDateInputValue(round.dataLockDate),
    autoGenerateAt: toDateTimeInputValue(round.autoGenerateAt),
    holidayDates: holidays.map((holiday) => toDateInputValue(holiday.date)),
    holidayDateLabels: formatHolidayDateLabels(holidays),
    submittedWards,
    totalWards,
    requestOpenDateLabel: formatDateLabel(round.requestOpenDate),
    requestCloseDateLabel: formatDateLabel(round.requestCloseDate),
    dataLockDateLabel: formatDateLabel(round.dataLockDate),
    autoGenerateAtLabel: formatDateTimeLabel(round.autoGenerateAt),
    createdAtLabel: formatDateTimeLabel(round.createdAt),
    latestGaRun,
    latestGaBatch: latestBatch
      ? {
          groupCount: latestBatch.groupCount,
          completedGroupCount: latestBatch.completedGroupCount,
          failedGroupCount: latestBatch.failedGroupCount,
          groups: latestBatch.runs.map((run, index) => ({
            id: run.id,
            index: run.groupIndex ?? index + 1,
            status: run.status,
            wardCodes: readGroupWardCodes(run.settingsSnapshot),
          })),
        }
      : null,
    hasActiveGaRun: latestGaRun ? isActiveGaRunStatus(latestGaRun.status) : false,
    wardOptions: round.preparations.map((preparation) => {
      const status = normalizePreparationStatus(preparation.status);

      return {
        id: preparation.ward.id,
        code: preparation.ward.code,
        name: preparation.ward.name,
        status,
        statusLabel: formatPreparationStatus(status),
      };
    }),
  };
}

function readGroupWardCodes(settingsSnapshot: unknown) {
  if (
    !settingsSnapshot ||
    typeof settingsSnapshot !== "object" ||
    Array.isArray(settingsSnapshot)
  ) {
    return [];
  }

  const wardCodes = (settingsSnapshot as Record<string, unknown>).groupWardCodes;
  return Array.isArray(wardCodes)
    ? wardCodes.filter((code): code is string => typeof code === "string")
    : [];
}

type ScheduleRoundHolidayRow = {
  cycle_id: string;
  holiday_date: Date;
  label: string | null;
};

async function getHolidayDatesByCycleId(cycleIds: string[]) {
  const result = new Map<string, Array<{ date: Date; label: string | null }>>();

  if (cycleIds.length === 0) {
    return result;
  }

  await Promise.all(
    cycleIds.map(async (cycleId) => {
      const rows = await prisma.$queryRaw<ScheduleRoundHolidayRow[]>`
        SELECT cycle_id, holiday_date, label
        FROM schedule_cycle_holidays
        WHERE cycle_id = ${cycleId}::uuid
        ORDER BY holiday_date ASC
      `;

      result.set(
        cycleId,
        rows.map((row) => ({
          date: row.holiday_date,
          label: row.label,
        })),
      );
    }),
  );

  return result;
}

async function getUserManagementData(): Promise<UserManagementData> {
  const [users, wards] = await Promise.all([
    prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
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
        username: "asc",
      },
    }),
    prisma.ward.findMany({
      orderBy: {
        code: "asc",
      },
    }),
  ]);

  return {
    users: users.map((user) => {
      const role = normalizeRole(user.roles[0]?.role.name, user.staff?.isHead);
      const homeWard = user.staff?.homeWard;
      const permissionWards =
        user.staff?.wardPermissions.map((item) => item.ward) ?? [];
      const allowedWards = [
        ...(homeWard ? [homeWard] : []),
        ...permissionWards,
      ].filter(
        (ward, index, wardList) =>
          wardList.findIndex((item) => item.id === ward.id) === index,
      );

      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        employeeCode: user.employeeCode,
        status: user.status,
        role,
        staffId: user.staff?.id ?? null,
        staffCode: user.staff?.staffCode ?? user.employeeCode ?? user.username,
        homeWardId: user.staff?.homeWardId ?? null,
        homeWardCode: homeWard?.code ?? "-",
        allowedWardIds: allowedWards.map((ward) => ward.id),
        allowedWardCodes: allowedWards.map((ward) => ward.code),
        position: user.staff?.position ?? "",
        payPosition: user.staff?.payPosition ?? "",
        otRate: user.staff?.otRate.toString() ?? "0",
        shiftPayRate: user.staff?.shiftPayRate.toString() ?? "0",
        isHead: user.staff?.isHead ?? role === "ward_head",
        isTrainee: user.staff?.isTrainee ?? false,
      };
    }),
    wards: wards.map((ward) => ({
      id: ward.id,
      code: ward.code,
      name: ward.name,
    })),
  };
}

function normalizeRole(
  role: string | undefined,
  isHead: boolean | undefined,
): UserManagementRole {
  if (role === "admin" || role === "ward_head" || role === "nurse") {
    return role;
  }

  return isHead ? "ward_head" : "nurse";
}

function formatScheduleMonthYear(month: number, year: number) {
  const thaiMonths = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const displayYear = year < 2400 ? year + 543 : year;

  return `${thaiMonths[month - 1] ?? "ไม่ระบุเดือน"} ${displayYear}`;
}

function formatCycleStatus(status: string) {
  const statusLabels: Record<string, string> = {
    preparing: "กำลังเตรียมข้อมูล",
    open: "เปิดให้หัวหน้าวอร์ดกรอก/ตรวจข้อมูล",
    locked: "ล็อกข้อมูล",
    generating: "GA กำลังจัดตาราง",
    published: "เผยแพร่แล้ว",
  };

  return statusLabels[status] ?? status;
}

function normalizeScheduleRoundStatus(status: string): ScheduleRoundStatus {
  if (
    status === "preparing" ||
    status === "open" ||
    status === "locked" ||
    status === "generating" ||
    status === "published"
  ) {
    return status;
  }

  return "preparing";
}

function normalizePreparationStatus(
  status: string | undefined,
): WardPreparationStatus {
  if (
    status === "draft" ||
    status === "needs_fix" ||
    status === "submitted" ||
    status === "ready"
  ) {
    return status;
  }

  return "draft";
}

function formatPreparationStatus(status: WardPreparationStatus) {
  const labels: Record<WardPreparationStatus, string> = {
    draft: "ยังไม่ส่งข้อมูล",
    needs_fix: "ข้อมูลยังไม่ครบ",
    submitted: "ส่งข้อมูลครบแล้ว",
    ready: "ส่งข้อมูลครบแล้ว",
  };

  return labels[status];
}

function formatDateLabel(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function formatDateTimeLabel(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toDateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function toDateTimeInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 16) : "";
}

function formatHolidayDateLabels(holidays: Array<{ date: Date; label: string | null }>) {
  if (holidays.length === 0) {
    return "-";
  }

  return holidays
    .map((holiday) =>
      new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(holiday.date),
    )
    .join(", ");
}
