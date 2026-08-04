import type { SessionPayload } from "@/lib/auth/session";
import { calculateCompensationForAssignments } from "@/lib/compensation/calculate";
import { buildWardCompensationSummary } from "@/lib/my-schedule/compensation-summary";
import { formatMonthYear } from "@/lib/my-schedule/formatters";
import { buildScheduleMatrix } from "@/lib/my-schedule/schedule-matrix";
import type {
  MyScheduleAssignment,
  MyScheduleEmptyData,
  MySchedulePageData,
  MyScheduleStaff,
} from "@/lib/my-schedule/types";
import { prisma } from "@/lib/prisma";

const visibleScheduleStatuses = ["published", "draft"] as const;

export async function getMySchedulePageData({
  session,
  versionId,
}: {
  session: SessionPayload | null;
  versionId?: string;
}): Promise<MySchedulePageData> {
  if (!session) {
    return emptyData(
      "no-session",
      "ไม่พบ session",
      "กรุณาเข้าสู่ระบบก่อนดูตารางเวรของฉัน",
    );
  }

  const staff = await prisma.staff.findUnique({
    where: { userId: session.userId },
    include: {
      homeWard: true,
    },
  });

  if (!staff) {
    if (session.roles.includes("admin")) {
      return emptyData(
        "admin-no-ward",
        "บัญชีผู้ดูแลระบบไม่มีวอร์ดประจำ",
        "กรุณาดูตารางเวรผ่านเมนูผู้ดูแลระบบแทน",
      );
    }

    return emptyData(
      "no-staff",
      "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลบุคลากร",
      "กรุณาให้ผู้ดูแลระบบเชื่อมบัญชีผู้ใช้กับข้อมูลบุคลากรก่อน",
    );
  }

  const versions = await prisma.scheduleVersion.findMany({
    where: {
      status: {
        in: [...visibleScheduleStatuses],
      },
      assignments: {
        some: {
          wardId: staff.homeWardId,
        },
      },
    },
    include: {
      cycle: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 12,
  });

  if (versions.length === 0) {
    return emptyData(
      "no-published-version",
      "ยังไม่มีตารางเวรของวอร์ดนี้",
      "เมื่อสร้างตารางเวรของวอร์ดนี้สำเร็จแล้ว ตารางจะแสดงที่หน้านี้",
    );
  }

  const sortedVersions = sortVisibleVersions(versions);
  const selectedVersion =
    sortedVersions.find((version) => version.id === versionId) ??
    sortedVersions[0];
  const daysInMonth = new Date(
    normalizeYear(selectedVersion.cycle.year),
    selectedVersion.cycle.month,
    0,
  ).getDate();

  const [wardAssignments, myAssignments, availabilityRequests, cycleHolidays] =
    await Promise.all([
      prisma.scheduleAssignment.findMany({
        where: {
          scheduleVersionId: selectedVersion.id,
          wardId: staff.homeWardId,
        },
        include: {
          staff: true,
          ward: true,
        },
        orderBy: [{ staff: { staffCode: "asc" } }, { workDate: "asc" }],
      }),
      prisma.scheduleAssignment.findMany({
        where: {
          scheduleVersionId: selectedVersion.id,
          staffId: staff.id,
        },
        include: {
          staff: true,
          ward: true,
        },
        orderBy: [{ workDate: "asc" }],
      }),
      prisma.availabilityRequest.findMany({
        where: {
          cycleId: selectedVersion.cycleId,
          staffId: staff.id,
        },
      }),
      prisma.scheduleCycleHoliday.findMany({
        where: {
          cycleId: selectedVersion.cycleId,
        },
        select: {
          holidayDate: true,
        },
        orderBy: {
          holidayDate: "asc",
        },
      }),
    ]);

  if (wardAssignments.length === 0) {
    return emptyData(
      "no-assignments",
      "ยังไม่มีข้อมูลเวรในวอร์ดนี้",
      "พบตารางเวรที่เผยแพร่แล้ว แต่ยังไม่มี assignment ของวอร์ดนี้",
    );
  }

  const staffRows = buildScheduleMatrix({
    assignments: wardAssignments.map(toMyScheduleAssignment),
    staff: buildStaffList(wardAssignments, staff.id),
    daysInMonth,
  });
  const myAssignmentRows = myAssignments.map(toMyScheduleAssignment);
  const myCompensationAmount = calculateCompensationForAssignments(myAssignments)
    .flatMap((ward) => ward.staffSummaries)
    .filter((summary) => summary.staffId === staff.id)
    .reduce((sum, summary) => sum + summary.totalAmount, 0);
  const requestCounts = countAvailabilityRequests(availabilityRequests);

  return {
    status: "loaded",
    currentUserStaffId: staff.id,
    ward: {
      id: staff.homeWard.id,
      code: staff.homeWard.code,
      name: staff.homeWard.name,
    },
    cycle: {
      id: selectedVersion.cycle.id,
      month: selectedVersion.cycle.month,
      year: selectedVersion.cycle.year,
      monthLabel: formatMonthYear(
        selectedVersion.cycle.month,
        selectedVersion.cycle.year,
      ),
    },
    selectedVersionId: selectedVersion.id,
    versionOptions: sortedVersions.map((version) => ({
      id: version.id,
      label: `${formatMonthYear(version.cycle.month, version.cycle.year)} · v${version.versionNo} · ${formatVersionStatus(version.status)}`,
      status: version.status,
    })),
    canManageSchedule:
      session.roles.includes("admin") || session.roles.includes("ward_head"),
    daysInMonth,
    holidayDays: cycleHolidays.map((holiday) => holiday.holidayDate.getUTCDate()),
    staffRows,
    crossWardAssignments: myAssignmentRows.filter(
      (assignment) => assignment.wardId !== staff.homeWardId,
    ),
    summary: {
      myShiftCount: myAssignmentRows.length,
      myOffCount: requestCounts.off,
      myVacationCount: requestCounts.v,
      myLeaveCount: requestCounts.leave,
      myOtCount: myAssignmentRows.filter((assignment) => assignment.isOt).length,
      estimatedPayAmount: myCompensationAmount,
    },
    compensationSummary: buildWardCompensationSummary(staffRows),
  };
}

function sortVisibleVersions<
  T extends {
    status: string;
    createdAt: Date;
  },
>(versions: T[]) {
  return [...versions].sort((a, b) => {
    const statusPriority =
      versionStatusPriority(a.status) - versionStatusPriority(b.status);
    if (statusPriority !== 0) {
      return statusPriority;
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function versionStatusPriority(status: string) {
  return status === "published" ? 0 : 1;
}

function formatVersionStatus(status: string) {
  return status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง";
}

function emptyData(
  reason: MyScheduleEmptyData["reason"],
  title: string,
  description: string,
): MySchedulePageData {
  return {
    status: "empty",
    reason,
    title,
    description,
  };
}

function buildStaffList(
  assignments: Array<{
    staff: {
      id: string;
      staffCode: string;
      fullName: string;
      isHead: boolean;
      position: string | null;
      payPosition: string | null;
      otRate: unknown;
      shiftPayRate: unknown;
    };
  }>,
  currentUserStaffId: string,
): MyScheduleStaff[] {
  const staffById = new Map<string, MyScheduleStaff>();

  for (const assignment of assignments) {
    staffById.set(assignment.staff.id, {
      id: assignment.staff.id,
      staffCode: assignment.staff.staffCode,
      fullName: assignment.staff.fullName,
      isHead: assignment.staff.isHead,
      payPosition: assignment.staff.payPosition ?? assignment.staff.position ?? "",
      otRate: Number(assignment.staff.otRate ?? 0),
      shiftPayRate: Number(assignment.staff.shiftPayRate ?? 0),
      isCurrentUser: assignment.staff.id === currentUserStaffId,
    });
  }

  return Array.from(staffById.values());
}

function toMyScheduleAssignment(assignment: {
  id: string;
  staffId: string;
  wardId: string;
  workDate: Date;
  shiftCode: string;
  isOt: boolean;
  otShifts: string | null;
  payAmount: unknown;
  staff: {
    staffCode: string;
    fullName: string;
    isHead: boolean;
    position: string | null;
    payPosition: string | null;
    otRate: unknown;
    shiftPayRate: unknown;
  };
  ward: {
    code: string;
    name: string;
  };
}): MyScheduleAssignment {
  return {
    id: assignment.id,
    staffId: assignment.staffId,
    staffCode: assignment.staff.staffCode,
    fullName: assignment.staff.fullName,
    isHead: assignment.staff.isHead,
    payPosition: assignment.staff.payPosition ?? assignment.staff.position ?? "",
    otRate: Number(assignment.staff.otRate ?? 0),
    shiftPayRate: Number(assignment.staff.shiftPayRate ?? 0),
    wardId: assignment.wardId,
    wardCode: assignment.ward.code,
    wardName: assignment.ward.name,
    day: assignment.workDate.getDate(),
    shiftCode: assignment.shiftCode,
    isOt: assignment.isOt,
    otShifts: assignment.otShifts,
    payAmount: Number(assignment.payAmount ?? 0),
  };
}

function countAvailabilityRequests(
  requests: Array<{
    requestType: string;
  }>,
) {
  return requests.reduce(
    (result, request) => {
      const type = request.requestType.toLowerCase();
      if (type === "off") {
        result.off += 1;
      } else if (type === "v") {
        result.v += 1;
      } else if (request.requestType === "ล") {
        result.leave += 1;
      }
      return result;
    },
    { off: 0, v: 0, leave: 0 },
  );
}

function normalizeYear(year: number) {
  return year > 2400 ? year - 543 : year;
}
