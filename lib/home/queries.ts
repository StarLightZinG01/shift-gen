import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";

import type {
  HomeAdminDashboardData,
  HomeDashboardData,
  HomeRole,
  HomeUpcomingDay,
  HomeUserDashboardData,
} from "./types";

type PublishedAssignment = {
  id: string;
  workDate: Date;
  shiftCode: string;
  isOt: boolean;
  ward: {
    code: string;
  };
};

export async function getHomeDashboardData(
  session: SessionPayload | null,
): Promise<HomeDashboardData> {
  const displayName = session?.displayName ?? "";
  const roles = session?.roles ?? [];

  if (roles.includes("admin")) {
    return getAdminHomeDashboardData(displayName);
  }

  return getUserHomeDashboardData(session);
}

async function getAdminHomeDashboardData(
  displayName: string,
): Promise<HomeAdminDashboardData> {
  const latestCycle = await prisma.scheduleCycle.findFirst({
    include: {
      preparations: true,
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

  const [
    totalUsers,
    totalWards,
    runningGaJobs,
    publishedSchedules,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.ward.count(),
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
  ]);

  const submittedWards =
    latestCycle?.preparations.filter((preparation) =>
      ["submitted", "ready"].includes(preparation.status),
    ).length ?? 0;

  return {
    variant: "admin",
    displayName,
    summaryCards: [
      {
        label: "ผู้ใช้ทั้งหมด",
        value: totalUsers.toString(),
        unit: "บัญชี",
        tone: "white",
      },
      {
        label: "วอร์ดทั้งหมด",
        value: totalWards.toString(),
        unit: "วอร์ด",
        tone: "white",
      },
      {
        label: "งาน GA กำลังรัน",
        value: runningGaJobs.toString(),
        unit: "งาน",
        tone: "white",
      },
      {
        label: "ตารางเผยแพร่แล้ว",
        value: publishedSchedules.toString(),
        unit: "ชุด",
        tone: "white",
      },
    ],
    latestCycle: latestCycle
      ? {
          monthLabel: formatMonthYear(latestCycle.month, latestCycle.year),
          statusLabel: formatCycleStatus(latestCycle.status),
          submittedWards,
          totalWards,
        }
      : null,
    emptyMessage:
      latestCycle || totalWards > 0
        ? null
        : "ยังไม่มีรอบจัดตารางและข้อมูลวอร์ดในระบบ",
  };
}

async function getUserHomeDashboardData(
  session: SessionPayload | null,
): Promise<HomeUserDashboardData> {
  const displayName = session?.displayName ?? "";
  const role = getHomeRole(session?.roles ?? []);
  const staff = session?.staffId
    ? await prisma.staff.findUnique({
        where: {
          id: session.staffId,
        },
        include: {
          homeWard: true,
        },
      })
    : null;

  const today = startOfDay(new Date());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextSevenDaysEnd = addDays(today, 7);
  const publishedVersion = await prisma.scheduleVersion.findFirst({
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
    orderBy: {
      createdAt: "desc",
    },
  });
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

  const assignments =
    staff && publishedVersion
      ? await prisma.scheduleAssignment.findMany({
          where: {
            scheduleVersionId: publishedVersion.id,
            staffId: staff.id,
            workDate: {
              gte: monthStart,
              lt: nextMonthStart,
            },
          },
          include: {
            ward: {
              select: {
                code: true,
              },
            },
          },
          orderBy: {
            workDate: "asc",
          },
        })
      : [];

  const upcomingAssignments =
    staff && publishedVersion
      ? await prisma.scheduleAssignment.findMany({
          where: {
            scheduleVersionId: publishedVersion.id,
            staffId: staff.id,
            workDate: {
              gte: today,
              lt: nextSevenDaysEnd,
            },
          },
          include: {
            ward: {
              select: {
                code: true,
              },
            },
          },
          orderBy: {
            workDate: "asc",
          },
        })
      : [];

  const requestCount =
    staff && latestCycle
      ? await prisma.availabilityRequest.count({
          where: {
            cycleId: latestCycle.id,
            staffId: staff.id,
          },
        })
      : 0;

  const todayAssignment = upcomingAssignments.find(
    (assignment) => startOfDay(assignment.workDate).getTime() === today.getTime(),
  );
  const shiftCounts = countShifts(assignments);
  const todayShift = mapTodayShift(todayAssignment, staff?.homeWard.code ?? "-");

  return {
    variant: "user",
    displayName,
    role,
    wardLabel: staff ? `${staff.homeWard.code} ${staff.homeWard.name}` : null,
    monthLabel: formatMonthYear(today.getMonth() + 1, today.getFullYear() + 543),
    summaryCards: [
      {
        label: "จำนวนเวรของฉันในเดือนนี้",
        value: assignments.length.toString(),
        unit: "เวร",
        tone: "white",
      },
      {
        label: "จำนวน off ของเดือนนี้",
        value: shiftCounts.off.toString(),
        unit: "วัน",
        tone: "white",
      },
      {
        label: "จำนวน OT เดือนนี้",
        value: assignments.filter((assignment) => assignment.isOt).length.toString(),
        unit: "เวร",
        tone: "white",
      },
      {
        label: "คำขอที่ส่งในรอบล่าสุด",
        value: requestCount.toString(),
        unit: "รายการ",
        tone: "green",
      },
    ],
    nextCycle: latestCycle
      ? {
          label: "รอบจัดเวรถัดไป",
          date: latestCycle.requestCloseDate
            ? formatShortDate(latestCycle.requestCloseDate)
            : formatMonthYear(latestCycle.month, latestCycle.year),
          time: latestCycle.requestCloseDate
            ? "ปิดรับคำขอ"
            : formatCycleStatus(latestCycle.status),
        }
      : {
          label: "รอบจัดเวรถัดไป",
          date: "-",
          time: "ยังไม่มีรอบจัดตาราง",
        },
    todayShift,
    upcomingDays: buildUpcomingDays(today, upcomingAssignments),
    emptyMessage: !staff
      ? "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลบุคลากรหรือวอร์ด"
      : !publishedVersion
        ? "ยังไม่มีตารางเวรที่เผยแพร่ให้แสดง"
        : assignments.length === 0
          ? "ยังไม่มีเวรของคุณในเดือนนี้"
          : null,
  };
}

function getHomeRole(roles: string[]): HomeRole {
  if (roles.includes("admin")) {
    return "admin";
  }

  if (roles.includes("ward_head")) {
    return "ward_head";
  }

  return "nurse";
}

function countShifts(assignments: PublishedAssignment[]) {
  return assignments.reduce(
    (counts, assignment) => {
      const shift = normalizeShiftCode(assignment.shiftCode);
      counts[shift] += 1;
      return counts;
    },
    {
      night: 0,
      morning: 0,
      afternoon: 0,
      off: 0,
    },
  );
}

function mapTodayShift(
  assignment: PublishedAssignment | undefined,
  fallbackWardCode: string,
) {
  if (!assignment) {
    return {
      hasSchedule: false,
      label: "เวรของฉันวันนี้",
      shiftName: "ไม่มีเวร",
      ward: fallbackWardCode,
      time: "ยังไม่มีเวรที่ต้องเข้าวันนี้",
      summary: [
        { label: "ดึก", value: "0" },
        { label: "เช้า", value: "0" },
        { label: "บ่าย", value: "0" },
      ],
    };
  }

  return {
    hasSchedule: true,
    label: "เวรของฉันวันนี้",
    shiftName: formatShiftCode(assignment.shiftCode),
    ward: assignment.ward.code,
    time: getShiftTime(assignment.shiftCode),
    summary: [
      { label: "ดึก", value: normalizeShiftCode(assignment.shiftCode) === "night" ? "1" : "0" },
      {
        label: "เช้า",
        value: normalizeShiftCode(assignment.shiftCode) === "morning" ? "1" : "0",
      },
      {
        label: "บ่าย",
        value: normalizeShiftCode(assignment.shiftCode) === "afternoon" ? "1" : "0",
      },
    ],
  };
}

function buildUpcomingDays(
  today: Date,
  assignments: PublishedAssignment[],
): HomeUpcomingDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index);
    const assignment = assignments.find(
      (item) => startOfDay(item.workDate).getTime() === date.getTime(),
    );
    const shift = assignment ? normalizeShiftCode(assignment.shiftCode) : "off";

    return {
      id: date.toISOString(),
      day: new Intl.DateTimeFormat("th-TH", { weekday: "short" }).format(date),
      date: new Intl.DateTimeFormat("th-TH", { day: "numeric" }).format(date),
      shift,
      shiftLabel: assignment ? formatShiftCode(assignment.shiftCode) : "หยุด",
      isToday: index === 0,
    };
  });
}

function normalizeShiftCode(shiftCode: string): "night" | "morning" | "afternoon" | "off" {
  const value = shiftCode.toLowerCase();

  if (["n", "night", "ดึก"].includes(value)) {
    return "night";
  }

  if (["m", "morning", "เช้า"].includes(value)) {
    return "morning";
  }

  if (["a", "afternoon", "บ่าย"].includes(value)) {
    return "afternoon";
  }

  return "off";
}

function formatShiftCode(shiftCode: string) {
  const shift = normalizeShiftCode(shiftCode);
  const labels = {
    night: "ดึก",
    morning: "เช้า",
    afternoon: "บ่าย",
    off: "หยุด",
  };

  return labels[shift];
}

function getShiftTime(shiftCode: string) {
  const shift = normalizeShiftCode(shiftCode);
  const times = {
    night: "00.00 - 08.00 น.",
    morning: "08.00 - 16.00 น.",
    afternoon: "16.00 - 00.00 น.",
    off: "ไม่ต้องเข้าเวร",
  };

  return times[shift];
}

function formatMonthYear(month: number, year: number) {
  const date = new Date((year > 2400 ? year - 543 : year), month - 1, 1);

  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatCycleStatus(status: string) {
  const labels: Record<string, string> = {
    preparing: "กำลังเตรียมข้อมูล",
    open: "เปิดรับข้อมูล",
    locked: "ปิดรับข้อมูลแล้ว",
    generating: "GA กำลังจัดตาราง",
    published: "เผยแพร่แล้ว",
  };

  return labels[status] ?? status;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return startOfDay(nextDate);
}
