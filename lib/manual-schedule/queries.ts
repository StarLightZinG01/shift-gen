import { formatMonthYear } from "@/lib/my-schedule/formatters";
import type { SessionPayload } from "@/lib/auth/session";
import {
  buildManualConstraintPolicy,
  buildCoverageWarningsFromViolations,
  validateManualScheduleConstraints,
} from "@/lib/manual-schedule/constraint-validation";
import { mergeStoredSpecialRuleSettings } from "@/lib/schedule-management/special-rules";
import type {
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
  session,
}: {
  versionId?: string;
  wardId?: string;
  session?: SessionPayload | null;
} = {}): Promise<ManualScheduleData> {
  const permittedWardId = await getPermittedWardId(session ?? null);
  if (permittedWardId === undefined) {
    return emptyData();
  }

  const allWardVersions = await prisma.scheduleWardVersion.findMany({
    where: {
      ...(permittedWardId ? { wardId: permittedWardId } : {}),
      status: {
        notIn: ["generating", "failed"],
      },
      scheduleVersion: {
        assignments: { some: {} },
      },
    },
    include: {
      ward: true,
      scheduleVersion: {
        include: {
          cycle: true,
          gaRun: {
            select: {
              objective: true,
              fitness: true,
              settingsSnapshot: true,
            },
          },
          gaBatch: {
            select: {
              hardScore: true,
              softScore: true,
              objective: true,
              fitness: true,
              runs: {
                select: {
                  id: true,
                  inputSnapshot: true,
                  objective: true,
                  fitness: true,
                  settingsSnapshot: true,
                },
              },
            },
          },
          parentVersion: {
            select: {
              gaRunId: true,
              gaRun: {
                select: {
                  objective: true,
                  fitness: true,
                  settingsSnapshot: true,
                },
              },
              gaBatch: {
                select: {
                  hardScore: true,
                  softScore: true,
                  objective: true,
                  fitness: true,
                  runs: {
                    select: {
                      id: true,
                      inputSnapshot: true,
                      objective: true,
                      fitness: true,
                      settingsSnapshot: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ ward: { code: "asc" } }, { versionNo: "desc" }],
  });

  if (allWardVersions.length === 0) {
    return emptyData();
  }

  const wards = Array.from(
    new Map(allWardVersions.map((item) => [item.ward.id, item.ward])).values(),
  );
  const selectedWard = wards.find((ward) => ward.id === wardId) ?? wards[0] ?? null;
  if (!selectedWard) {
    return emptyData();
  }
  const selectedWardVersions = allWardVersions.filter(
    (item) => item.wardId === selectedWard.id,
  );
  const decoratedVersions = selectedWardVersions.map((item) => ({
    ...item.scheduleVersion,
    versionNo: item.versionNo,
    source: item.source,
    status: item.status,
    parentVersionId: item.parentWardVersionId,
  }));
  const version =
    decoratedVersions.find((item) => item.id === versionId) ??
    decoratedVersions.find((item) => item.status === "published") ??
    decoratedVersions[0] ??
    null;

  if (!version) {
    return emptyData();
  }

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
    version.cycleId,
    wards.map((ward) => ward.id),
  );

  const [assignments, manualChanges, staffOptions, preparation, requests, gaSettings] = await Promise.all([
    prisma.scheduleAssignment.findMany({
      where: {
        scheduleVersionId: version.id,
      },
      include: {
        staff: {
          include: {
            homeWard: { select: { id: true } },
            wardPermissions: { select: { wardId: true } },
            externalSelections: {
              where: { cycleId: version.cycleId },
              select: { wardId: true },
            },
          },
        },
      },
      orderBy: [{ staff: { staffCode: "asc" } }, { workDate: "asc" }],
    }),
    prisma.scheduleManualChange.findMany({
      where: {
        scheduleVersionId: version.id,
        OR: [
          { oldWardId: selectedWard.id },
          { newWardId: selectedWard.id },
          { assignment: { wardId: selectedWard.id } },
        ],
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
    getEligibleStaffOptions(selectedWard.id, version.cycleId),
    prisma.wardCyclePreparation.findUnique({
      where: {
        cycleId_wardId: {
          cycleId: version.cycleId,
          wardId: selectedWard.id,
        },
      },
      select: {
        staffingRequirements: {
          select: {
            shiftCode: true,
            rnRequired: true,
            pnNaRequired: true,
            requiresIncharge: true,
            holidayRnRequired: true,
            holidayPnNaRequired: true,
            holidayRequiresIncharge: true,
          },
        },
        specialRuleSettings: {
          select: {
            ruleKey: true,
            enabled: true,
            parameters: true,
          },
        },
      },
    }),
    prisma.availabilityRequest.findMany({
      where: { cycleId: version.cycleId },
      select: {
        staffId: true,
        requestDate: true,
        requestType: true,
        preferredShift: true,
      },
    }),
    prisma.gaSetting.findFirst({
      where: { isActive: true },
      select: {
        enableMorningEveningDouble: true,
        enableNightEveningDouble: true,
        maxConsecutiveWorkDays: true,
        maxConsecutiveNights: true,
        maxTraineePerShift: true,
        maxShiftsPer7Days: true,
        morningRegularRequired: true,
      },
    }),
  ]);
  const violations = validateManualScheduleConstraints({
    wardId: selectedWard.id,
    wardLabel: `${selectedWard.code} - ${selectedWard.name}`,
    year: normalizeYear(version.cycle.year),
    month: version.cycle.month,
    daysInMonth,
    holidayDays,
    assignments: assignments.map((assignment) => ({
      staffId: assignment.staffId,
      staffCode: assignment.staff.staffCode,
      staffLabel: assignment.staff.fullName || assignment.staff.staffCode,
      wardId: assignment.wardId,
      day: assignment.workDate.getUTCDate(),
      shiftCode: assignment.shiftCode,
      otShifts: assignment.otShifts,
      staffCategory: assignment.staff.staffCategory,
      position: assignment.staff.position,
      payPosition: assignment.staff.payPosition,
      isHead: assignment.staff.isHead,
      isTrainee: assignment.staff.isTrainee,
      isNewNurse: assignment.staff.isNewNurse,
      canBeInCharge: assignment.staff.canBeInCharge,
      allowedWardIds: Array.from(new Set([
        assignment.staff.homeWard.id,
        ...assignment.staff.wardPermissions.map((permission) => permission.wardId),
        ...assignment.staff.externalSelections.map((selection) => selection.wardId),
      ])),
    })),
    requirements: preparation?.staffingRequirements ?? [],
    specialRules: mergeStoredSpecialRuleSettings(
      selectedWard.code,
      preparation?.specialRuleSettings ?? [],
    ),
    requests: requests.map((request) => ({
      staffId: request.staffId,
      day: request.requestDate.getUTCDate(),
      requestType: request.requestType,
      preferredShift: request.preferredShift,
    })),
    policy: buildManualConstraintPolicy(gaSettings),
  });
  const violationsByCell = groupViolationsByCell(violations);

  return {
    ...baseData(version, decoratedVersions, selectedWard.id),
    selectedWardId: selectedWard.id,
    selectedWardLabel: `${selectedWard.code} - ${selectedWard.name}`,
    wardOptions: buildWardOptionsFromWardVersions(
      wards,
      allWardVersions,
      latestManualChangesByWardId,
    ),
    staffOptions,
    rows: buildRows(
      assignments.filter((assignment) => assignment.wardId === selectedWard.id),
      daysInMonth,
      violationsByCell,
    ),
    daysInMonth,
    holidayDays,
    history: manualChanges.map(mapManualChange),
    coverageWarnings: buildCoverageWarningsFromViolations(violations),
    canPublish: version.status === "draft" && violations.length === 0,
    violations,
  };
}

async function getPermittedWardId(session: SessionPayload | null) {
  if (!session) {
    return undefined;
  }

  if (session.roles.includes("admin")) {
    return null;
  }

  if (!session.roles.includes("ward_head")) {
    return undefined;
  }

  const staff = await prisma.staff.findUnique({
    where: { userId: session.userId },
    select: { homeWardId: true, isHead: true },
  });

  return staff?.isHead ? staff.homeWardId : undefined;
}

async function getEligibleStaffOptions(
  wardId: string,
  cycleId: string,
): Promise<ManualScheduleStaffOption[]> {
  const staff = await prisma.staff.findMany({
    where: {
      OR: [
        { homeWardId: wardId },
        {
          externalSelections: {
            some: { wardId, cycleId },
          },
        },
      ],
    },
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
    isHead: member.isHead,
    payPosition: member.payPosition ?? "",
    staffCategory: member.staffCategory,
  }));
}

function findBatchRunForWard<T extends { inputSnapshot: unknown }>(
  runs: T[],
  wardId: string,
): T | null {
  for (const run of runs) {
    const snapshot = run.inputSnapshot;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      continue;
    }
    const wards = (snapshot as Record<string, unknown>).wards;
    if (
      Array.isArray(wards) &&
      wards.some(
        (ward) =>
          ward !== null &&
          typeof ward === "object" &&
          !Array.isArray(ward) &&
          (ward as Record<string, unknown>).id === wardId,
      )
    ) {
      return run;
    }
  }

  return null;
}

async function getLatestManualChangeByWard(cycleId: string, wardIds: string[]) {
  if (wardIds.length === 0) {
    return new Map<string, Date>();
  }

  const wardIdSet = new Set(wardIds);
  const changes = await prisma.scheduleManualChange.findMany({
    where: {
      scheduleVersion: { cycleId },
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

function buildWardOptionsFromWardVersions(
  wards: Array<{ id: string; code: string; name: string }>,
  wardVersions: Array<{
    wardId: string;
    status: string;
    scheduleVersion: Parameters<typeof buildWardOptions>[1];
  }>,
  latestManualChangesByWardId: Map<string, Date>,
): ManualScheduleWardOption[] {
  return wards.flatMap((ward) => {
    const candidates = wardVersions.filter((item) => item.wardId === ward.id);
    const selected =
      candidates.find((item) => item.status === "published") ?? candidates[0];

    return selected
      ? buildWardOptions(
          [ward],
          selected.scheduleVersion,
          latestManualChangesByWardId,
        )
      : [];
  });
}

function buildWardOptions(
  wards: Array<{
    id: string;
    code: string;
    name: string;
  }>,
  version: {
    createdAt: Date;
    gaRun?: GaScoreRunRecord | null;
    gaBatch?: GaScoreBatchRecord | null;
    parentVersion?: {
      gaRun?: GaScoreRunRecord | null;
      gaBatch?: GaScoreBatchRecord | null;
    } | null;
  },
  latestManualChangesByWardId: Map<string, Date>,
): ManualScheduleWardOption[] {
  const standaloneGaRun = version.gaRun ?? version.parentVersion?.gaRun ?? null;
  const gaBatch = version.gaBatch ?? version.parentVersion?.gaBatch ?? null;

  return wards.map((ward) => {
    const wardGaRun = standaloneGaRun ?? findBatchRunForWard(gaBatch?.runs ?? [], ward.id);
    const scoreData = resolveGaScoreData(wardGaRun, null);

    return {
      id: ward.id,
      code: ward.code,
      name: ward.name,
      hardScore: scoreData.hardScore,
      softScore: scoreData.softScore,
      isFeasible: scoreData.isFeasible,
      objective: scoreData.objective,
      fitness: scoreData.fitness,
      generatedAtLabel: formatDateTimeLabel(version.createdAt),
      latestEditedAtLabel: formatDateTimeLabel(latestManualChangesByWardId.get(ward.id) ?? null),
    };
  });
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
    gaRun?: GaScoreRunRecord | null;
    gaBatch?: GaScoreBatchRecord | null;
    parentVersion?: {
      gaRunId: string | null;
      gaRun?: GaScoreRunRecord | null;
      gaBatch?: GaScoreBatchRecord | null;
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
  selectedWardId: string | null,
): ManualScheduleData {
  const directGaRun = version.gaRun ?? null;
  const directGaBatch = version.gaBatch ?? null;
  const inheritedGaBatch = directGaBatch ?? version.parentVersion?.gaBatch ?? null;
  const wardGaRun = selectedWardId
    ? findBatchRunForWard(inheritedGaBatch?.runs ?? [], selectedWardId)
    : null;
  const scoreData = resolveGaScoreData(
    directGaRun ?? version.parentVersion?.gaRun ?? wardGaRun,
    null,
  );

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
      gaScore: scoreData.hasScore
        ? {
            scoringMethod: scoreData.scoringMethod,
            hardScore: scoreData.hardScore,
            softScore: scoreData.softScore,
            isFeasible: scoreData.isFeasible,
            objective: scoreData.objective,
            fitness: scoreData.fitness,
            sourceLabel: directGaRun || directGaBatch
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
    canPublish: version.status === "draft",
    history: [],
    coverageWarnings: [],
    violations: [],
  };
}

function readConstraintScores(settingsSnapshot: unknown) {
  const empty = {
    scoringMethod: null as string | null,
    hardScore: null as string | null,
    softScore: null as string | null,
    isFeasible: null as boolean | null,
  };

  if (!settingsSnapshot || typeof settingsSnapshot !== "object" || Array.isArray(settingsSnapshot)) {
    return empty;
  }

  const debug = (settingsSnapshot as Record<string, unknown>).worker_score_debug;
  if (!debug || typeof debug !== "object" || Array.isArray(debug)) {
    return empty;
  }

  const score = debug as Record<string, unknown>;
  const toScore = (value: unknown) =>
    value === null || value === undefined ? null : String(value);

  return {
    scoringMethod:
      typeof score.scoring_method === "string" ? score.scoring_method : null,
    hardScore: toScore(score.hard_score),
    softScore: toScore(score.soft_score),
    isFeasible:
      typeof score.is_feasible === "boolean" ? score.is_feasible : null,
  };
}

type GaScoreRunRecord = {
  objective: unknown;
  fitness: unknown;
  settingsSnapshot: unknown;
};

type GaScoreBatchRecord = {
  hardScore: unknown;
  softScore: unknown;
  objective: unknown;
  fitness: unknown;
  runs: Array<GaScoreRunRecord & { id: string; inputSnapshot: unknown }>;
};

function resolveGaScoreData(
  gaRun: GaScoreRunRecord | null,
  gaBatch: GaScoreBatchRecord | null,
) {
  if (gaBatch) {
    const hardScore = toNullableScore(gaBatch.hardScore);
    const softScore = toNullableScore(gaBatch.softScore);
    const storedObjective = toNullableScore(gaBatch.objective);
    return {
      hasScore: hardScore !== null || softScore !== null || storedObjective !== null,
      scoringMethod: "constraint_domination_v1",
      hardScore,
      softScore,
      isFeasible: hardScore === null ? null : Number(hardScore) === 0,
      objective: getDisplayedObjective({ hardScore, softScore }, storedObjective),
      fitness: toNullableScore(gaBatch.fitness),
    };
  }

  const constraintScores = readConstraintScores(gaRun?.settingsSnapshot);
  const storedObjective = toNullableScore(gaRun?.objective);
  return {
    hasScore: gaRun !== null,
    ...constraintScores,
    objective: getDisplayedObjective(constraintScores, storedObjective),
    fitness: toNullableScore(gaRun?.fitness),
  };
}

function toNullableScore(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function getDisplayedObjective(
  scores: {
    hardScore: string | null;
    softScore: string | null;
  },
  storedObjective: string | null,
) {
  if (scores.hardScore === null || scores.softScore === null) {
    return storedObjective;
  }

  const hardScore = Number(scores.hardScore);
  const softScore = Number(scores.softScore);

  if (!Number.isFinite(hardScore) || !Number.isFinite(softScore)) {
    return storedObjective;
  }

  return String(hardScore + softScore);
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
      payPosition: string | null;
      staffCategory: string;
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
      payPosition: assignment.staff.payPosition ?? "",
      staffCategory: assignment.staff.staffCategory,
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

function groupViolationsByCell(violations: ManualScheduleViolation[]) {
  const result = new Map<string, ManualScheduleViolation[]>();

  for (const violation of violations) {
    if (violation.highlightCell === false || !violation.staffId || !violation.day) {
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

function compareManualScheduleRows(a: ManualScheduleRow, b: ManualScheduleRow) {
  if (a.isHead !== b.isHead) {
    return a.isHead ? -1 : 1;
  }

  const positionOrder = getManualPositionOrder(a) - getManualPositionOrder(b);
  if (positionOrder !== 0) {
    return positionOrder;
  }

  return a.staffCode.localeCompare(b.staffCode, "th", { numeric: true });
}

function getManualPositionOrder(row: Pick<ManualScheduleRow, "payPosition" | "staffCategory">) {
  const position = row.payPosition.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const positions: Record<string, number> = {
    RNSUC: 0,
    RNICU: 1,
    RNANES: 2,
    RN: 3,
    PN: 4,
    NA: 5,
  };

  return positions[position] ?? positions[row.staffCategory] ?? 6;
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
