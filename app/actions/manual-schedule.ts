"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth/current-session";
import { recalculateAndSaveCompensationInTransaction } from "@/lib/compensation/save";
import { validateStoredManualSchedule } from "@/lib/manual-schedule/constraint-validation-data";
import {
  assertEditableShiftCode,
  splitShiftCode,
} from "@/lib/manual-schedule/validation";
import {
  createManualVersionFromParent,
  type ManualScheduleTransactionClient,
} from "@/lib/manual-schedule/versioning";
import { prisma } from "@/lib/prisma";
import { resolveScheduledCycleStatus } from "@/lib/schedule-rounds/cycle-status";

export type ManualScheduleActionState = {
  ok: boolean;
  message: string;
  versionId?: string;
  publishBlocked?: boolean;
};

export type ManualScheduleDraftAssignment = {
  staffId: string;
  day: number;
  shiftCode: string;
  otShifts?: string | null;
  reason?: string;
};

type ManualSession = {
  userId: string;
  roles: string[];
  homeWardId: string | null;
};

export async function saveManualScheduleAction(params: {
  baseVersionId: string;
  wardId: string;
  assignments: ManualScheduleDraftAssignment[];
  publish: boolean;
}): Promise<ManualScheduleActionState> {
  try {
    const session = await requireManualEditor();
    await assertCanEditWard(session, params.wardId);

    const baseVersion = await prisma.scheduleVersion.findUnique({
      where: { id: params.baseVersionId },
      include: {
        cycle: true,
        wardVersions: true,
      },
    });

    if (!baseVersion) {
      throw new Error("ไม่พบตารางเวรต้นฉบับ");
    }

    const daysInMonth = new Date(
      normalizeYear(baseVersion.cycle.year),
      baseVersion.cycle.month,
      0,
    ).getDate();
    const normalizedAssignments = normalizeDraftAssignments(
      params.assignments,
      daysInMonth,
    );

    if (normalizedAssignments.length === 0) {
      throw new Error("ไม่พบข้อมูลตารางเวรสำหรับบันทึก");
    }

    const uniqueStaffIds = Array.from(
      new Set(normalizedAssignments.map((assignment) => assignment.staffId)),
    );
    const existingStaffCount = await prisma.staff.count({
      where: { id: { in: uniqueStaffIds } },
    });

    if (existingStaffCount !== uniqueStaffIds.length) {
      throw new Error("พบบุคลากรที่ไม่มีอยู่ในระบบ กรุณารีเฟรชหน้าแล้วลองใหม่");
    }

    const baseWardVersion = baseVersion.wardVersions.find(
      (item) => item.wardId === params.wardId,
    );
    if (!baseWardVersion) {
      throw new Error("ไม่พบ version ตารางเวรของวอร์ดนี้");
    }

    const eligibleStaff = await prisma.staff.findMany({
      where: {
        id: { in: uniqueStaffIds },
        OR: [
          { homeWardId: params.wardId },
          {
            externalSelections: {
              some: {
                cycleId: baseVersion.cycleId,
                wardId: params.wardId,
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    if (eligibleStaff.length !== uniqueStaffIds.length) {
      throw new Error(
        "พบบุคลากรที่ไม่ได้อยู่ในวอร์ดหรือไม่ได้ถูกเลือกเป็นบุคลากรช่วยในรอบนี้",
      );
    }

    const nextByKey = new Map(
      normalizedAssignments.map((assignment) => [
        `${assignment.staffId}:${assignment.day}`,
        assignment,
      ]),
    );
    const changedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const manualVersion = await createManualVersionFromParent({
        tx,
        parentVersionId: baseVersion.id,
        wardId: params.wardId,
        createdBy: session.userId,
      });
      const previousAssignments = await tx.scheduleAssignment.findMany({
        where: {
          scheduleVersionId: baseVersion.id,
          wardId: params.wardId,
        },
      });
      const previousByKey = new Map(
        previousAssignments.map((assignment) => [
          `${assignment.staffId}:${assignment.workDate.getUTCDate()}`,
          assignment,
        ]),
      );

      await tx.scheduleAssignment.createMany({
        data: normalizedAssignments.map((assignment) => ({
          scheduleVersionId: manualVersion.id,
          staffId: assignment.staffId,
          wardId: params.wardId,
          workDate: new Date(
            Date.UTC(
              normalizeYear(baseVersion.cycle.year),
              baseVersion.cycle.month - 1,
              assignment.day,
            ),
          ),
          shiftCode: assignment.shiftCode,
          isOt: Boolean(assignment.otShifts),
          otShifts: assignment.otShifts,
          payAmount: 0,
          note: assignment.reason || null,
        })),
      });

      const changeRows = buildManualChangeRows({
        previousByKey,
        nextByKey,
        scheduleVersionId: manualVersion.id,
        wardId: params.wardId,
        changedBy: session.userId,
        changedAt,
        year: baseVersion.cycle.year,
        month: baseVersion.cycle.month,
      });

      if (changeRows.length > 0) {
        await tx.scheduleManualChange.createMany({ data: changeRows });
      }

      await recalculateAndSaveCompensationInTransaction(tx, manualVersion.id);

      const publishViolations = params.publish
        ? await validateStoredManualSchedule(tx, manualVersion.id, params.wardId)
        : [];
      if (params.publish) {
        if (publishViolations.length === 0) {
          await publishVersionInTransaction(
            tx,
            manualVersion.id,
            params.wardId,
            session.userId,
            true,
          );
        }
      }

      return { manualVersion, publishViolations };
    }, { isolationLevel: "Serializable" });

    revalidateManualPaths();
    const publishBlocked = params.publish && result.publishViolations.length > 0;

    return {
      ok: true,
      message: publishBlocked
        ? `บันทึกเป็นฉบับร่างแล้ว แต่ยังเผยแพร่ไม่ได้: ${formatPublishBlockMessage(result.publishViolations)}`
        : params.publish
          ? "บันทึกและเผยแพร่ตารางเวรสำเร็จ"
          : "บันทึกตารางเวรเป็นฉบับร่างสำเร็จ",
      versionId: result.manualVersion.id,
      publishBlocked,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function publishManualVersionAction(
  versionId: string,
  wardId: string,
): Promise<ManualScheduleActionState> {
  try {
    const session = await requireManualEditor();
    await assertCanEditWard(session, wardId);
    await prisma.$transaction(async (tx) => {
      await publishVersionInTransaction(tx, versionId, wardId, session.userId);
      await recalculateAndSaveCompensationInTransaction(tx, versionId);
    }, { isolationLevel: "Serializable" });
    revalidateManualPaths();

    return {
      ok: true,
      message: "ตั้งตารางเวอร์ชันนี้เป็นเวอร์ชันหลักของวอร์ดแล้ว",
      versionId,
    };
  } catch (error) {
    return actionError(error);
  }
}

async function publishVersionInTransaction(
  tx: ManualScheduleTransactionClient,
  versionId: string,
  wardId: string,
  changedBy: string,
  constraintsAlreadyValidated = false,
) {
  const version = await getEditableScheduleVersion(tx, versionId, wardId);

  if (["generating", "failed"].includes(version.wardVersion.status)) {
    throw new Error("ตารางเวอร์ชันนี้ยังไม่พร้อมตั้งเป็นเวอร์ชันหลัก");
  }

  if (!constraintsAlreadyValidated) {
    const violations = await validateStoredManualSchedule(tx, versionId, wardId);
    if (violations.length > 0) {
      throw new Error(`ยังเผยแพร่ไม่ได้: ${formatPublishBlockMessage(violations)}`);
    }
  }

  await tx.scheduleWardVersion.updateMany({
    where: {
      cycleId: version.cycleId,
      wardId,
      status: "published",
      NOT: { id: version.wardVersion.id },
    },
    data: {
      status: "draft",
      publishedAt: null,
    },
  });
  await tx.scheduleWardVersion.update({
    where: { id: version.wardVersion.id },
    data: {
      status: "published",
      publishedAt: new Date(),
    },
  });
  await tx.scheduleManualChange.create({
    data: {
      scheduleVersionId: versionId,
      actionType: "publish_version",
      newWardId: wardId,
      reason: "ตั้งเป็นเวอร์ชันหลักของวอร์ด",
      changedBy,
    },
  });
}

function formatPublishBlockMessage(
  violations: Array<{ message: string }>,
) {
  const firstMessage = violations[0]?.message ?? "ตารางยังมี Constraint ที่ไม่ผ่าน";
  const remaining = violations.length - 1;
  return remaining > 0
    ? `${firstMessage} และอีก ${remaining} รายการ`
    : firstMessage;
}

export async function deleteScheduleVersionAction(
  versionId: string,
  wardId: string,
): Promise<ManualScheduleActionState> {
  try {
    const session = await requireManualEditor();

    if (!session.roles.includes("admin")) {
      throw new Error("ลบตารางเวรได้เฉพาะผู้ดูแลระบบเท่านั้น");
    }

    const wardVersion = await prisma.scheduleWardVersion.findUnique({
      where: {
        scheduleVersionId_wardId: { scheduleVersionId: versionId, wardId },
      },
      include: { scheduleVersion: { select: { id: true, cycleId: true } } },
    });

    if (!wardVersion) {
      throw new Error("ไม่พบตารางเวรที่ต้องการลบ");
    }

    await prisma.$transaction(async (tx) => {
      await tx.scheduleAssignment.deleteMany({
        where: { scheduleVersionId: versionId, wardId },
      });
      await tx.wardCompensationSummary.deleteMany({
        where: { scheduleVersionId: versionId, wardId },
      });
      await tx.scheduleWardVersion.delete({ where: { id: wardVersion.id } });

      const remainingWardVersions = await tx.scheduleWardVersion.count({
        where: { scheduleVersionId: versionId },
      });
      if (remainingWardVersions === 0) {
        await tx.scheduleVersion.delete({ where: { id: versionId } });
      }

      if (wardVersion.status === "published") {
        const publishedWardCount = await tx.scheduleWardVersion.count({
          where: { cycleId: wardVersion.scheduleVersion.cycleId, status: "published" },
        });
        if (publishedWardCount === 0) {
          const cycle = await tx.scheduleCycle.findUnique({
            where: { id: wardVersion.scheduleVersion.cycleId },
            select: { requestOpenDate: true, dataLockDate: true },
          });
          if (cycle) {
            await tx.scheduleCycle.updateMany({
              where: { id: wardVersion.scheduleVersion.cycleId, status: "published" },
              data: {
                status: resolveScheduledCycleStatus(cycle),
                publishedAt: null,
              },
            });
          }
        }
      }
    });

    revalidateManualPaths();

    return {
      ok: true,
      message: "ลบตารางเวรออกจากระบบแล้ว",
    };
  } catch (error) {
    return actionError(error);
  }
}

async function requireManualEditor(): Promise<ManualSession> {
  const session = await getCurrentSession();

  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อน");
  }

  if (!session.roles.includes("admin") && !session.roles.includes("ward_head")) {
    throw new Error("บัญชีนี้ไม่มีสิทธิ์แก้ไขตารางเวร");
  }

  return {
    userId: session.userId,
    roles: session.roles,
    homeWardId: session.homeWardId,
  };
}

async function assertCanEditWard(session: ManualSession, wardId?: string) {
  if (session.roles.includes("admin")) {
    return;
  }

  if (
    session.roles.includes("ward_head") &&
    session.homeWardId &&
    wardId === session.homeWardId
  ) {
    return;
  }

  throw new Error("หัวหน้าวอร์ดแก้ไขได้เฉพาะวอร์ดหลักของตัวเอง");
}

async function getEditableScheduleVersion(
  tx: ManualScheduleTransactionClient,
  versionId: string,
  wardId: string,
) {
  const version = await tx.scheduleVersion.findUnique({
    where: {
      id: versionId,
    },
    select: {
      id: true,
      cycleId: true,
      source: true,
      status: true,
      wardVersions: {
        where: { wardId },
        select: { id: true, status: true },
        take: 1,
      },
    },
  });

  if (!version) {
    throw new Error("ไม่พบ version ตารางเวร");
  }

  const wardVersion = version.wardVersions[0];
  if (!wardVersion) {
    throw new Error("ไม่พบ version ตารางเวรของวอร์ดนี้");
  }

  return { ...version, wardVersion };
}

function normalizeDraftAssignments(
  assignments: ManualScheduleDraftAssignment[],
  daysInMonth: number,
) {
  const normalized = new Map<
    string,
    {
      staffId: string;
      day: number;
      shiftCode: string;
      otShifts: string | null;
      reason: string | null;
    }
  >();

  for (const assignment of assignments) {
    const staffId = assignment.staffId.trim();
    const day = Number(assignment.day);
    const shiftCode = assignment.shiftCode.trim();

    if (!staffId) {
      throw new Error("พบรายการเวรที่ไม่มีรหัสบุคลากร");
    }
    if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
      throw new Error(`วันที่ ${assignment.day} อยู่นอกช่วงของเดือน`);
    }

    assertEditableShiftCode(shiftCode);
    const key = `${staffId}:${day}`;
    if (normalized.has(key)) {
      throw new Error(`พบบุคลากรซ้ำในวันที่ ${day}`);
    }

    normalized.set(key, {
      staffId,
      day,
      shiftCode,
      otShifts: normalizeEditableOtShifts(shiftCode, assignment.otShifts),
      reason: assignment.reason?.trim() || null,
    });
  }

  return Array.from(normalized.values());
}

function buildManualChangeRows({
  previousByKey,
  nextByKey,
  scheduleVersionId,
  wardId,
  changedBy,
  changedAt,
  year,
  month,
}: {
  previousByKey: Map<
    string,
    {
      staffId: string;
      workDate: Date;
      shiftCode: string;
      otShifts: string | null;
    }
  >;
  nextByKey: Map<
    string,
    {
      staffId: string;
      day: number;
      shiftCode: string;
      otShifts: string | null;
      reason: string | null;
    }
  >;
  scheduleVersionId: string;
  wardId: string;
  changedBy: string;
  changedAt: Date;
  year: number;
  month: number;
}) {
  const keys = new Set([...previousByKey.keys(), ...nextByKey.keys()]);
  const rows: Array<{
    scheduleVersionId: string;
    actionType: string;
    oldStaffId: string | null;
    newStaffId: string | null;
    oldWardId: string | null;
    newWardId: string | null;
    oldWorkDate: Date | null;
    newWorkDate: Date | null;
    oldShiftCode: string | null;
    newShiftCode: string | null;
    reason: string | null;
    changedBy: string;
    changedAt: Date;
  }> = [];

  for (const key of keys) {
    const previous = previousByKey.get(key);
    const next = nextByKey.get(key);
    const previousShift = previous?.shiftCode ?? "0";
    const nextShift = next?.shiftCode ?? "0";
    const previousOt = normalizeEditableOtShifts(
      previousShift,
      previous?.otShifts,
    );
    const nextOt = normalizeEditableOtShifts(nextShift, next?.otShifts);

    if (previousShift === nextShift && previousOt === nextOt) {
      continue;
    }

    const day = next?.day ?? previous?.workDate.getUTCDate();
    if (!day) {
      continue;
    }
    const workDate = new Date(
      Date.UTC(normalizeYear(year), month - 1, day),
    );

    rows.push({
      scheduleVersionId,
      actionType: !previous
        ? "add_assignment"
        : nextShift === "0"
          ? "remove_assignment"
          : "update_shift",
      oldStaffId: previous?.staffId ?? null,
      newStaffId: next?.staffId ?? previous?.staffId ?? null,
      oldWardId: previous ? wardId : null,
      newWardId: next ? wardId : null,
      oldWorkDate: previous ? previous.workDate : null,
      newWorkDate: next ? workDate : null,
      oldShiftCode: previous?.shiftCode ?? null,
      newShiftCode: next?.shiftCode ?? null,
      reason: next?.reason ?? null,
      changedBy,
      changedAt,
    });
  }

  return rows;
}

function normalizeYear(year: number) {
  return year > 2400 ? year - 543 : year;
}

function normalizeEditableOtShifts(shiftCode: string, otShifts?: string | null) {
  const shiftParts = splitShiftCode(shiftCode).filter(isOtEligibleShift);
  const requestedParts = splitShiftCode(otShifts).filter(isOtEligibleShift);

  if (shiftParts.length === 0 || requestedParts.length === 0) {
    return null;
  }

  const shiftPartSet = new Set(shiftParts);
  const normalizedParts = requestedParts.filter((part, index, parts) =>
    shiftPartSet.has(part) && parts.indexOf(part) === index
  );

  if (normalizedParts.length === 0) {
    return null;
  }

  return normalizedParts.join("/");
}

function isOtEligibleShift(value: string) {
  return value === "ช" || value === "บ" || value === "ด";
}

function revalidateManualPaths() {
  revalidatePath("/schedule-rounds");
  revalidatePath("/home");
  revalidatePath("/home/manual-schedule");
  revalidatePath("/home/schedule-rounds");
  revalidatePath("/home/my-schedule");
}

function actionError(error: unknown): ManualScheduleActionState {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ",
  };
}
