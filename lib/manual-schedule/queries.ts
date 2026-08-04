import { formatMonthYear } from "@/lib/my-schedule/formatters";
import { splitShiftCode } from "@/lib/manual-schedule/validation";
import type {
  CoverageWarning,
  ManualChangeHistoryRow,
  ManualScheduleData,
  ManualScheduleViolation,
  ManualScheduleRow,
  ManualScheduleWardOption,
  ManualScheduleStaffOption,
} from "@/lib/manual-schedule/types";
import { prisma } from "@/lib/prisma";

export async function getManualScheduleData({
  versionId,
  wardId,
}: {
  versionId?: string;
  wardId?: string;
} = {}): Promise<ManualScheduleData> {
  const versions = await prisma.scheduleVersion.findMany({
    where: {
      assignments: {
        some: {},
      },
    },
    include: {
      cycle: true,
      gaRun: {
        select: {
          objective: true,
          fitness: true,
        },
      },
      parentVersion: {
        select: {
          gaRunId: true,
          gaRun: {
            select: {
              objective: true,
              fitness: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  const version =
    versions.find((item) => item.id === versionId) ??
    versions.find((item) => item.status === "published") ??
    versions[0] ??
    null;

  if (!version) {
    return emptyData();
  }

  const wards = await prisma.ward.findMany({
    where: {
      assignments: {
        some: {
          scheduleVersionId: version.id,
        },
      },
    },
    orderBy: {
      code: "asc",
    },
  });
  const selectedWard = wards.find((ward) => ward.id === wardId) ?? wards[0] ?? null;
  const daysInMonth = new Date(normalizeYear(version.cycle.year), version.cycle.month, 0).getDate();
  const cycleHolidays = await prisma.scheduleCycleHoliday.findMany({
    where: {
      cycleId: version.cycleId,
    },
    select: {
      holidayDate: true,
    },
  });
  const holidayDays = cycleHolidays.map((holiday) => holiday.holidayDate.getUTCDate());
  const latestManualChangesByWardId = await getLatestManualChangeByWard(
    version.id,
    wards.map((ward) => ward.id),
  );

  if (!selectedWard) {
    return {
      ...baseData(version, versions),
      selectedWardId: null,
      selectedWardLabel: "ยังไม่มีวอร์ดในตารางนี้",
      daysInMonth,
      holidayDays,
    };
  }

  const violationGaRunId = version.gaRunId ?? version.parentVersion?.gaRunId ?? null;
  const [assignments, manualChanges, staffOptions, violations] = await Promise.all([
    prisma.scheduleAssignment.findMany({
      where: {
        scheduleVersionId: version.id,
        wardId: selectedWard.id,
      },
      include: {
        staff: true,
      },
      orderBy: [{ staff: { staffCode: "asc" } }, { workDate: "asc" }],
    }),
    prisma.scheduleManualChange.findMany({
      where: {
        scheduleVersionId: version.id,
      },
      include: {
        changer: true,
        assignment: {
          include: {
            staff: true,
          },
        },
      },
      orderBy: {
        changedAt: "desc",
      },
      take: 20,
    }),
    getEligibleStaffOptions(),
    violationGaRunId
      ? getGaViolations({
          gaRunId: violationGaRunId,
          wardId: selectedWard.id,
        })
      : Promise.resolve([]),
  ]);
  const violationsByCell = groupViolationsByCell(violations);

  return {
    ...baseData(version, versions),
    selectedWardId: selectedWard.id,
    selectedWardLabel: `${selectedWard.code} - ${selectedWard.name}`,
    wardOptions: buildWardOptions(wards, version, latestManualChangesByWardId),
    staffOptions,
    rows: buildRows(assignments, daysInMonth, violationsByCell),
    daysInMonth,
    holidayDays,
    history: manualChanges.map(mapManualChange),
    coverageWarnings: buildCoverageWarnings(assignments),
    violations,
  };
}

async function getEligibleStaffOptions(): Promise<ManualScheduleStaffOption[]> {
  const staff = await prisma.staff.findMany({
    include: {
      homeWard: true,
    },
    orderBy: {
      staffCode: "asc",
    },
  });

  return staff.map((member) => ({
    id: member.id,
    staffCode: member.staffCode,
    fullName: member.fullName,
    homeWardCode: member.homeWard?.code ?? "-",
  }));
}

async function getLatestManualChangeByWard(versionId: string, wardIds: string[]) {
  if (wardIds.length === 0) {
    return new Map<string, Date>();
  }

  const wardIdSet = new Set(wardIds);
  const changes = await prisma.scheduleManualChange.findMany({
    where: {
      scheduleVersionId: versionId,
      OR: [
        {
          oldWardId: {
            in: wardIds,
          },
        },
        {
          newWardId: {
            in: wardIds,
          },
        },
        {
          assignment: {
            wardId: {
              in: wardIds,
            },
          },
        },
      ],
    },
    include: {
      assignment: {
        select: {
          wardId: true,
        },
      },
    },
    orderBy: {
      changedAt: "desc",
    },
  });
  const latestByWard = new Map<string, Date>();

  for (const change of changes) {
    const relatedWardIds = [
      change.newWardId,
      change.oldWardId,
      change.assignment?.wardId,
    ].filter(
      (wardId): wardId is string =>
        typeof wardId === "string" && wardIdSet.has(wardId),
    );

    for (const wardId of relatedWardIds) {
      if (!latestByWard.has(wardId)) {
        latestByWard.set(wardId, change.changedAt);
      }
    }
  }

  return latestByWard;
}

function buildWardOptions(
  wards: Array<{
    id: string;
    code: string;
    name: string;
  }>,
  version: {
    createdAt: Date;
    gaRun?: {
      objective: unknown;
      fitness: unknown;
    } | null;
    parentVersion?: {
      gaRun?: {
        objective: unknown;
        fitness: unknown;
      } | null;
    } | null;
  },
  latestManualChangesByWardId: Map<string, Date>,
): ManualScheduleWardOption[] {
  const gaScoreRun = version.gaRun ?? version.parentVersion?.gaRun ?? null;

  return wards.map((ward) => ({
    id: ward.id,
    code: ward.code,
    name: ward.name,
    objective: gaScoreRun?.objective === null || gaScoreRun?.objective === undefined
      ? null
      : String(gaScoreRun.objective),
    fitness: gaScoreRun?.fitness === null || gaScoreRun?.fitness === undefined
      ? null
      : String(gaScoreRun.fitness),
    generatedAtLabel: formatDateTimeLabel(version.createdAt),
    latestEditedAtLabel: formatDateTimeLabel(latestManualChangesByWardId.get(ward.id) ?? null),
  }));
}

function emptyData(): ManualScheduleData {
  return {
    version: null,
    selectedWardId: null,
    selectedWardLabel: "ยังไม่มีตารางเวร",
    versionOptions: [],
    wardOptions: [],
    staffOptions: [],
    rows: [],
    daysInMonth: 0,
    holidayDays: [],
    canEdit: false,
    canCreateManualVersion: false,
    canPublish: false,
    history: [],
    coverageWarnings: [],
    violations: [],
  };
}

function baseData(
  version: {
    id: string;
    cycleId: string;
    versionNo: number;
    source: string;
    status: string;
    parentVersionId: string | null;
    createdAt: Date;
    cycle: {
      month: number;
      year: number;
    };
    gaRunId: string | null;
    gaRun?: {
      objective: unknown;
      fitness: unknown;
    } | null;
    parentVersion?: {
      gaRunId: string | null;
      gaRun?: {
        objective: unknown;
        fitness: unknown;
      } | null;
    } | null;
  },
  versions: Array<{
    id: string;
    versionNo: number;
    source: string;
    status: string;
    cycle: {
      month: number;
      year: number;
    };
  }>,
): ManualScheduleData {
  const gaScoreRun = version.gaRun ?? version.parentVersion?.gaRun ?? null;

  return {
    version: {
      id: version.id,
      cycleId: version.cycleId,
      cycleLabel: formatMonthYear(version.cycle.month, version.cycle.year),
      month: version.cycle.month,
      year: version.cycle.year,
      versionNo: version.versionNo,
      source: version.source,
      status: version.status,
      parentVersionId: version.parentVersionId,
      gaScore: gaScoreRun
        ? {
            objective:
              gaScoreRun.objective === null ? null : String(gaScoreRun.objective),
            fitness: gaScoreRun.fitness === null ? null : String(gaScoreRun.fitness),
            sourceLabel: version.gaRun
              ? "คะแนนจาก GA ของตารางนี้"
              : "คะแนนจาก GA ของตารางต้นฉบับ",
          }
        : null,
    },
    selectedWardId: null,
    selectedWardLabel: "",
    versionOptions: versions.map((item) => ({
      id: item.id,
      label: `${formatMonthYear(item.cycle.month, item.cycle.year)} · v${item.versionNo} · ${formatSource(item.source)} · ${formatStatus(item.status)}`,
      source: item.source,
      status: item.status,
    })),
    wardOptions: [],
    staffOptions: [],
    rows: [],
    daysInMonth: 0,
    holidayDays: [],
    canEdit: true,
    canCreateManualVersion: false,
    canPublish: false,
    history: [],
    coverageWarnings: [],
    violations: [],
  };
}

function buildRows(
  assignments: Array<{
    id: string;
    staffId: string;
    workDate: Date;
    shiftCode: string;
    isOt: boolean;
    otShifts: string | null;
    staff: {
      staffCode: string;
      fullName: string;
      isHead: boolean;
    };
  }>,
  daysInMonth: number,
  violationsByCell: Map<string, ManualScheduleViolation[]> = new Map(),
): ManualScheduleRow[] {
  const rows = new Map<string, ManualScheduleRow>();
  const editedAssignmentIds = new Set<string>();

  for (const assignment of assignments) {
    const row = rows.get(assignment.staffId) ?? {
      staffId: assignment.staffId,
      staffCode: assignment.staff.staffCode,
      fullName: assignment.staff.fullName,
      isHead: assignment.staff.isHead,
      cells: Array.from({ length: daysInMonth }, (_, index) => ({
        assignmentId: null,
        staffId: assignment.staffId,
        staffCode: assignment.staff.staffCode,
        fullName: assignment.staff.fullName,
        day: index + 1,
        shiftCode: "0",
        isOt: false,
        otShifts: null,
        isEdited: false,
        violations: violationsByCell.get(cellViolationKey(assignment.staffId, index + 1)) ?? [],
      })),
    };
    const day = assignment.workDate.getDate();
    const normalized = normalizeOtAssignment(
      assignment.shiftCode,
      assignment.isOt,
      assignment.otShifts,
    );
    row.cells[day - 1] = {
      ...row.cells[day - 1],
      assignmentId: assignment.id,
      shiftCode: normalized.shiftCode,
      isOt: normalized.isOt,
      otShifts: normalized.otShifts,
      isEdited: editedAssignmentIds.has(assignment.id),
      violations: violationsByCell.get(cellViolationKey(assignment.staffId, day)) ?? [],
    };
    rows.set(assignment.staffId, row);
  }

  return Array.from(rows.values()).sort(compareManualScheduleRows);
}

function normalizeOtAssignment(
  shiftCode: string,
  isOt: boolean,
  otShifts: string | null,
) {
  const inlineOtShifts = extractInlineOtShifts(shiftCode);
  const normalizedOtShifts = otShifts ?? inlineOtShifts;

  return {
    shiftCode: stripInlineOt(shiftCode),
    isOt: isOt || Boolean(normalizedOtShifts),
    otShifts: normalizedOtShifts,
  };
}

function stripInlineOt(value: string) {
  return (value || "0").replace(/OT/gi, "");
}

function extractInlineOtShifts(value: string) {
  const matches = Array.from((value || "").matchAll(/([^\s/]+?)OT/gi))
    .map((match) => stripInlineOt(match[1]))
    .filter(Boolean);

  if (matches.length === 0) {
    return null;
  }

  return matches.join("/");
}

async function getGaViolations({
  gaRunId,
  wardId,
}: {
  gaRunId: string;
  wardId: string;
}): Promise<ManualScheduleViolation[]> {
  const rows = await prisma.gaViolation.findMany({
    where: {
      gaRunId,
      NOT: [
        {
          constraintCode: "double_shift",
        },
        {
          severity: "info",
        },
      ],
      OR: [
        { wardId },
        {
          wardId: null,
          staff: {
            homeWardId: wardId,
          },
        },
      ],
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
          name: true,
        },
      },
    },
    orderBy: [
      { severity: "asc" },
      { violationDate: "asc" },
      { constraintCode: "asc" },
    ],
  });

  return rows.map((row) => ({
    id: row.id,
    day: row.violationDate?.getUTCDate() ?? null,
    staffId: row.staffId,
    staffLabel: row.staff?.fullName ?? null,
    wardId: row.wardId,
    wardLabel: row.ward ? `${row.ward.code} - ${row.ward.name}` : null,
    constraintCode: row.constraintCode,
    constraintLabel: formatConstraintLabel(row.constraintCode),
    severity: row.severity,
    message: row.message,
  }));
}

function groupViolationsByCell(violations: ManualScheduleViolation[]) {
  const result = new Map<string, ManualScheduleViolation[]>();

  for (const violation of violations) {
    if (!violation.staffId || !violation.day) {
      continue;
    }

    const key = cellViolationKey(violation.staffId, violation.day);
    result.set(key, [...(result.get(key) ?? []), violation]);
  }

  return result;
}

function cellViolationKey(staffId: string, day: number) {
  return `${staffId}:${day}`;
}

function formatConstraintLabel(code: string) {
  const labels: Record<string, string> = {
    coverage_under: "กำลังคนต่ำกว่าที่กำหนด",
    coverage_over: "กำลังคนเกินที่กำหนด",
    one_shift_per_day: "บุคลากรมีเวรซ้ำในวันเดียว",
    requested_off_assignment: "จัดเวรทับวันลา/วันหยุดที่ขอ",
    unavailable_assignment: "จัดเวรในวันที่เข้าเวรไม่ได้",
    weekly_max_shifts: "เวรเกิน 10 เวรใน 7 วัน",
    max_consecutive_work_days: "ทำงานติดกันเกินกำหนด",
    consecutive_work_days: "ทำงานติดกันเกินกำหนด",
    rest_period: "พักหลังเวรไม่พอ",
    short_rest_warning: "พักระหว่างเวรน้อยกว่าเกณฑ์",
    insufficient_rest: "พักระหว่างเวรน้อยกว่าเกณฑ์",
    continuous_24h_warning: "เสี่ยงทำงานต่อเนื่อง 24 ชั่วโมง",
    work_24h: "ทำงานต่อเนื่อง 24 ชั่วโมง",
    trainee_per_shift: "พยาบาลฝึกหัดเกินต่อกะ",
    forbidden_sequence: "ลำดับเวรต้องห้าม",
    evening_to_night: "บ่ายต่อดึก",
    invalid_ward_assignment: "จัดคนผิดวอร์ดที่ขึ้นได้",
    head_invalid_assignment: "หัวหน้าวอร์ดถูกจัดกะที่ไม่อนุญาต",
    head_emergency_warning: "ใช้หัวหน้าช่วยเวรโดยไม่จำเป็น",
    head_emergency_assignment: "ใช้หัวหน้าช่วยเวรฉุกเฉิน",
    morning_regular_required: "เวรเช้าไม่มีเวรปกติ",
    ot_shift_must_be_assigned: "OT ไม่ตรงกับเวรที่จัด",
    no_duplicate_regular_ot: "เวรปกติและ OT ซ้ำกัน",
    max_ot_per_staff: "OT เกินเป้าหมายต่อคน",
    preferred_shift_request: "ไม่ได้จัดตามคำขอเข้าเวร",
    validation_error: "ข้อผิดพลาดจากการตรวจผล GA",
  };

  return labels[code] ?? code;
}

function compareManualScheduleRows(a: ManualScheduleRow, b: ManualScheduleRow) {
  if (a.isHead !== b.isHead) {
    return a.isHead ? -1 : 1;
  }

  return a.staffCode.localeCompare(b.staffCode);
}

function buildCoverageWarnings(
  assignments: Array<{
    workDate: Date;
    shiftCode: string;
  }>,
): CoverageWarning[] {
  const countByDayShift = new Map<string, number>();

  for (const assignment of assignments) {
    const day = assignment.workDate.getDate();
    for (const shiftCode of splitShiftCode(assignment.shiftCode)) {
      if (shiftCode === "ช" || shiftCode === "บ" || shiftCode === "ด") {
        const key = `${day}:${shiftCode}`;
        countByDayShift.set(key, (countByDayShift.get(key) ?? 0) + 1);
      }
    }
  }

  return Array.from(countByDayShift.entries())
    .filter(([, count]) => count === 0)
    .map(([key]) => {
      const [day, shiftCode] = key.split(":");
      return {
        day: Number(day),
        shiftCode,
        message: `วันที่ ${day} เวร ${shiftCode} ยังไม่มีกำลังคน`,
      };
    });
}

function mapManualChange(change: {
  id: string;
  actionType: string;
  oldWorkDate: Date | null;
  newWorkDate: Date | null;
  oldShiftCode: string | null;
  newShiftCode: string | null;
  reason: string | null;
  changedAt: Date;
  changer: {
    displayName: string;
  } | null;
  assignment: {
    staff: {
      staffCode: string;
      fullName: string;
    };
  } | null;
}): ManualChangeHistoryRow {
  const date = change.newWorkDate ?? change.oldWorkDate;
  return {
    id: change.id,
    actionType: formatActionType(change.actionType),
    staffLabel: change.assignment
      ? `${change.assignment.staff.staffCode} ${change.assignment.staff.fullName}`
      : "-",
    dateLabel: date ? `วันที่ ${date.getDate()}` : "-",
    oldShiftCode: change.oldShiftCode,
    newShiftCode: change.newShiftCode,
    reason: change.reason,
    changedBy: change.changer?.displayName ?? "-",
    changedAtLabel: formatDateTimeLabel(change.changedAt),
  };
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

function formatActionType(value: string) {
  const labels: Record<string, string> = {
    update_shift: "แก้ไขเวร",
    add_assignment: "เพิ่มเวร",
    remove_assignment: "ลบเวร",
    replace_staff: "เปลี่ยนบุคลากร",
    publish_version: "เผยแพร่ตาราง",
  };

  return labels[value] ?? value;
}

function formatSource(value: string) {
  return value === "manual" ? "Manual" : "GA";
}

function formatStatus(value: string) {
  return value === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง";
}

function normalizeYear(year: number) {
  return year > 2400 ? year - 543 : year;
}
