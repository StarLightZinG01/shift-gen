import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";

import type {
  LeaveRequestCycle,
  LeaveRequestDraft,
  LeaveRequestPageData,
  LeaveRequestType,
  SelectableWard,
} from "./types";

export async function getSelectableWardsForUser(
  userId: string,
): Promise<SelectableWard[]> {
  const staff = await prisma.staff.findUnique({
    where: { userId },
    include: {
      homeWard: true,
      wardPermissions: {
        include: {
          ward: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!staff) {
    return [];
  }

  const wardMap = new Map<string, SelectableWard>();

  wardMap.set(staff.homeWard.id, {
    id: staff.homeWard.id,
    code: staff.homeWard.code,
    name: staff.homeWard.name,
  });

  for (const permission of staff.wardPermissions) {
    wardMap.set(permission.ward.id, {
      id: permission.ward.id,
      code: permission.ward.code,
      name: permission.ward.name,
    });
  }

  return Array.from(wardMap.values());
}

export async function getLeaveRequestPageData(
  session: SessionPayload | null,
): Promise<LeaveRequestPageData> {
  const isAdmin = session?.roles.includes("admin") ?? false;
  const cycle = await getCurrentLeaveRequestCycle();

  if (!session) {
    return {
      isAdmin: false,
      staffId: null,
      cycle,
      allowedWards: [],
      existingRequests: [],
      message: "กรุณาเข้าสู่ระบบก่อนยื่นคำขอ",
    };
  }

  if (isAdmin && !session.staffId) {
    return {
      isAdmin,
      staffId: null,
      cycle,
      allowedWards: [],
      existingRequests: [],
      message:
        "บัญชีผู้ดูแลระบบไม่ได้ผูกกับบุคลากร จึงไม่สามารถยื่นคำขอวันลา/ไม่สะดวกเข้าเวรได้",
    };
  }

  const [allowedWards, existingRequests] = await Promise.all([
    getSelectableWardsForUser(session.userId),
    session.staffId && cycle
      ? getExistingLeaveRequests(cycle.id, session.staffId)
      : Promise.resolve([]),
  ]);

  return {
    isAdmin,
    staffId: session.staffId,
    cycle,
    allowedWards,
    existingRequests,
    message: getPageMessage({
      cycle,
      staffId: session.staffId,
      allowedWards,
    }),
  };
}

async function getCurrentLeaveRequestCycle(): Promise<LeaveRequestCycle | null> {
  const cycle =
    (await prisma.scheduleCycle.findFirst({
      where: {
        status: {
          in: ["preparing", "open"],
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

  const calendarYear = toCalendarYear(cycle.year);
  const daysInMonth = new Date(calendarYear, cycle.month, 0).getDate();
  const firstDayOffset = new Date(calendarYear, cycle.month - 1, 1).getDay();

  return {
    id: cycle.id,
    month: cycle.month,
    year: cycle.year,
    monthLabel: formatMonthYear(cycle.month, cycle.year),
    daysInMonth,
    firstDayOffset,
    trailingEmptyCells: (7 - ((firstDayOffset + daysInMonth) % 7)) % 7,
    requestCloseLabel: cycle.requestCloseDate
      ? formatDateTime(cycle.requestCloseDate)
      : "ยังไม่กำหนดวันปิดรับคำขอ",
  };
}

async function getExistingLeaveRequests(
  cycleId: string,
  staffId: string,
): Promise<LeaveRequestDraft[]> {
  const requests = await prisma.availabilityRequest.findMany({
    where: {
      cycleId,
      staffId,
    },
    orderBy: {
      requestDate: "asc",
    },
  });

  return requests.map((request) => ({
    date: request.requestDate.getDate(),
    type: normalizeRequestType(request.requestType),
    reason: request.reason ?? "",
  }));
}

function getPageMessage({
  cycle,
  staffId,
  allowedWards,
}: {
  cycle: LeaveRequestCycle | null;
  staffId: string | null;
  allowedWards: SelectableWard[];
}) {
  if (!cycle) {
    return "ยังไม่มีรอบจัดตารางสำหรับยื่นคำขอ";
  }

  if (!staffId) {
    return "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลบุคลากร";
  }

  if (allowedWards.length === 0) {
    return "บัญชีนี้ยังไม่มีวอร์ดที่สามารถปฏิบัติงานได้";
  }

  return null;
}

function normalizeRequestType(type: string): LeaveRequestType {
  if (type === "Off" || type === "V" || type === "ว" || type === "ล") {
    return type;
  }

  return "Off";
}

function toCalendarYear(year: number) {
  return year > 2400 ? year - 543 : year;
}

function formatMonthYear(month: number, year: number) {
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(new Date(toCalendarYear(year), month - 1, 1));
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
