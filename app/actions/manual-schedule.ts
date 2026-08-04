"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth/session";
import { recalculateAndSaveCompensation } from "@/lib/compensation/save";
import {
  assertEditableShiftCode,
  isWorkShift,
  splitShiftCode,
} from "@/lib/manual-schedule/validation";
import {
  createManualVersionFromParent,
} from "@/lib/manual-schedule/versioning";
import { prisma } from "@/lib/prisma";

export type ManualScheduleActionState = {
  ok: boolean;
  message: string;
  versionId?: string;
};

type ManualSession = {
  userId: string;
  roles: string[];
  homeWardId: string | null;
};

export async function createManualVersionAction(
  parentVersionId: string,
): Promise<ManualScheduleActionState> {
  try {
    const session = await requireManualEditor();
    const manualVersion = await createManualVersionFromParent({
      parentVersionId,
      createdBy: session.userId,
    });

    revalidateManualPaths();

    return {
      ok: true,
      message: "สร้าง manual version สำเร็จ",
      versionId: manualVersion.id,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelManualVersionAction(
  versionId: string,
): Promise<ManualScheduleActionState> {
  try {
    const session = await requireManualEditor();
    const version = await getEditableScheduleVersion(versionId);
    const targetVersion = await prisma.scheduleVersion.findUnique({
      where: {
        id: version.id,
      },
      select: {
        id: true,
        cycleId: true,
        parentVersionId: true,
      },
    });

    if (!targetVersion?.parentVersionId) {
      throw new Error("ไม่พบเวอร์ชันต้นฉบับสำหรับยกเลิกการแก้ไข");
    }

    if (!session.roles.includes("admin")) {
      if (!session.homeWardId) {
        throw new Error("ไม่พบวอร์ดหลักของบัญชีนี้");
      }

      const editableWard = await prisma.scheduleAssignment.findFirst({
        where: {
          scheduleVersionId: targetVersion.id,
          wardId: session.homeWardId,
        },
        select: {
          id: true,
        },
      });

      if (!editableWard) {
        throw new Error("หัวหน้าวอร์ดยกเลิกได้เฉพาะฉบับแก้ไขของวอร์ดตัวเอง");
      }
    }

    await prisma.scheduleVersion.delete({
      where: {
        id: targetVersion.id,
      },
    });

    revalidateManualPaths();

    return {
      ok: true,
      message: "ยกเลิกฉบับแก้ไขและกลับไปใช้ตารางต้นฉบับแล้ว",
      versionId: targetVersion.parentVersionId,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateAssignmentShiftAction(params: {
  assignmentId: string;
  newShiftCode: string;
  otShifts?: string | null;
  reason?: string;
}): Promise<ManualScheduleActionState> {
  try {
    const session = await requireManualEditor();
    assertEditableShiftCode(params.newShiftCode);
    const otShifts = normalizeEditableOtShifts(params.newShiftCode, params.otShifts);

    const assignment = await prisma.scheduleAssignment.findUnique({
      where: {
        id: params.assignmentId,
      },
      include: {
        scheduleVersion: true,
      },
    });

    if (!assignment) {
      throw new Error("ไม่พบ assignment ที่ต้องการแก้ไข");
    }

    await assertCanEditWard(session);
    await getEditableScheduleVersion(assignment.scheduleVersionId);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.scheduleAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          shiftCode: params.newShiftCode,
          isOt: Boolean(otShifts),
          otShifts,
          payAmount: 0,
        },
      });

      await tx.scheduleManualChange.create({
        data: {
          scheduleVersionId: assignment.scheduleVersionId,
          assignmentId: assignment.id,
          actionType: isWorkShift(params.newShiftCode)
            ? "update_shift"
            : "remove_assignment",
          oldStaffId: assignment.staffId,
          newStaffId: assignment.staffId,
          oldWardId: assignment.wardId,
          newWardId: assignment.wardId,
          oldWorkDate: assignment.workDate,
          newWorkDate: assignment.workDate,
          oldShiftCode: assignment.shiftCode,
          newShiftCode: params.newShiftCode,
          reason: params.reason?.trim() || null,
          changedBy: session.userId,
        },
      });

      return result;
    });

    await publishEditedVersion(updated.scheduleVersionId);
    await recalculateAndSaveCompensation(updated.scheduleVersionId);
    revalidateManualPaths();

    return {
      ok: true,
      message: "บันทึกการแก้ไขเวรสำเร็จ",
      versionId: updated.scheduleVersionId,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function addAssignmentAction(params: {
  scheduleVersionId: string;
  wardId: string;
  staffId: string;
  day: number;
  shiftCode: string;
  otShifts?: string | null;
  reason?: string;
}): Promise<ManualScheduleActionState> {
  try {
    const session = await requireManualEditor();
    assertEditableShiftCode(params.shiftCode);
    const otShifts = normalizeEditableOtShifts(params.shiftCode, params.otShifts);
    await assertCanEditWard(session);
    const version = await getEditableScheduleVersion(params.scheduleVersionId);

    const cycle = await prisma.scheduleCycle.findUnique({
      where: {
        id: version.cycleId,
      },
    });

    if (!cycle) {
      throw new Error("ไม่พบรอบจัดตาราง");
    }

    const workDate = new Date(
      Date.UTC(normalizeYear(cycle.year), cycle.month - 1, params.day),
    );
    const existing = await prisma.scheduleAssignment.findFirst({
      where: {
        scheduleVersionId: params.scheduleVersionId,
        staffId: params.staffId,
        wardId: params.wardId,
        workDate,
      },
    });

    const assignment = await prisma.$transaction(async (tx) => {
      const result = existing
        ? await tx.scheduleAssignment.update({
            where: {
              id: existing.id,
            },
            data: {
              wardId: params.wardId,
              shiftCode: params.shiftCode,
              isOt: Boolean(otShifts),
              otShifts,
              payAmount: 0,
            },
          })
        : await tx.scheduleAssignment.create({
            data: {
              scheduleVersionId: params.scheduleVersionId,
              staffId: params.staffId,
              wardId: params.wardId,
              workDate,
              shiftCode: params.shiftCode,
              isOt: Boolean(otShifts),
              otShifts,
              payAmount: 0,
              note: "Manual edit",
            },
          });

      await tx.scheduleManualChange.create({
        data: {
          scheduleVersionId: params.scheduleVersionId,
          assignmentId: result.id,
          actionType: "add_assignment",
          newStaffId: params.staffId,
          newWardId: params.wardId,
          newWorkDate: workDate,
          newShiftCode: params.shiftCode,
          reason: params.reason?.trim() || null,
          changedBy: session.userId,
        },
      });

      return result;
    });

    await publishEditedVersion(params.scheduleVersionId);
    await recalculateAndSaveCompensation(params.scheduleVersionId);
    revalidateManualPaths();

    return {
      ok: true,
      message: "เพิ่มเวรสำเร็จ",
      versionId: assignment.scheduleVersionId,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeAssignmentAction(params: {
  assignmentId: string;
  reason?: string;
}) {
  return updateAssignmentShiftAction({
    assignmentId: params.assignmentId,
    newShiftCode: "0",
    otShifts: null,
    reason: params.reason,
  });
}

export async function replaceAssignmentStaffAction(params: {
  assignmentId: string;
  newStaffId: string;
  reason?: string;
}): Promise<ManualScheduleActionState> {
  try {
    const session = await requireManualEditor();
    const assignment = await prisma.scheduleAssignment.findUnique({
      where: {
        id: params.assignmentId,
      },
      include: {
        scheduleVersion: true,
      },
    });

    if (!assignment) {
      throw new Error("ไม่พบ assignment ที่ต้องการแก้ไข");
    }

    await assertCanEditWard(session);
    await getEditableScheduleVersion(assignment.scheduleVersionId);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.scheduleAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          staffId: params.newStaffId,
          payAmount: 0,
        },
      });

      await tx.scheduleManualChange.create({
        data: {
          scheduleVersionId: assignment.scheduleVersionId,
          assignmentId: assignment.id,
          actionType: "replace_staff",
          oldStaffId: assignment.staffId,
          newStaffId: params.newStaffId,
          oldWardId: assignment.wardId,
          newWardId: assignment.wardId,
          oldWorkDate: assignment.workDate,
          newWorkDate: assignment.workDate,
          oldShiftCode: assignment.shiftCode,
          newShiftCode: assignment.shiftCode,
          reason: params.reason?.trim() || null,
          changedBy: session.userId,
        },
      });

      return result;
    });

    await publishEditedVersion(updated.scheduleVersionId);
    await recalculateAndSaveCompensation(updated.scheduleVersionId);
    revalidateManualPaths();

    return {
      ok: true,
      message: "เปลี่ยนบุคลากรสำเร็จ",
      versionId: updated.scheduleVersionId,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function publishManualVersionAction(
  versionId: string,
): Promise<ManualScheduleActionState> {
  try {
    const session = await requireManualEditor();
    const version = await getEditableScheduleVersion(versionId);

    await prisma.$transaction(async (tx) => {
      await tx.scheduleVersion.updateMany({
        where: {
          cycleId: version.cycleId,
          status: "published",
        },
        data: {
          status: "draft",
          publishedAt: null,
        },
      });
      await tx.scheduleVersion.update({
        where: {
          id: versionId,
        },
        data: {
          status: "published",
          publishedAt: new Date(),
        },
      });
      await tx.scheduleCycle.update({
        where: {
          id: version.cycleId,
        },
        data: {
          status: "published",
          publishedAt: new Date(),
        },
      });
      await tx.scheduleManualChange.create({
        data: {
          scheduleVersionId: versionId,
          actionType: "publish_version",
          reason: "เผยแพร่ manual version",
          changedBy: session.userId,
        },
      });
    });

    await recalculateAndSaveCompensation(versionId);
    revalidateManualPaths();

    return {
      ok: true,
      message: "เผยแพร่ manual version สำเร็จ",
      versionId,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteScheduleVersionAction(
  versionId: string,
): Promise<ManualScheduleActionState> {
  try {
    const session = await requireManualEditor();

    if (!session.roles.includes("admin")) {
      throw new Error("ลบตารางเวรได้เฉพาะผู้ดูแลระบบเท่านั้น");
    }

    const version = await prisma.scheduleVersion.findUnique({
      where: {
        id: versionId,
      },
      select: {
        id: true,
        cycleId: true,
        status: true,
      },
    });

    if (!version) {
      throw new Error("ไม่พบตารางเวรที่ต้องการลบ");
    }

    await prisma.$transaction(async (tx) => {
      await tx.scheduleVersion.delete({
        where: {
          id: version.id,
        },
      });

      if (version.status === "published") {
        const publishedVersion = await tx.scheduleVersion.findFirst({
          where: {
            cycleId: version.cycleId,
            status: "published",
          },
          select: {
            id: true,
          },
        });

        if (!publishedVersion) {
          await tx.scheduleCycle.update({
            where: {
              id: version.cycleId,
            },
            data: {
              status: "locked",
              publishedAt: null,
            },
          });
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

async function assertCanEditWard(session: ManualSession) {
  if (session.roles.includes("admin") || session.roles.includes("ward_head")) {
    return;
  }

  throw new Error("หัวหน้าวอร์ดแก้ไขได้เฉพาะวอร์ดหลักของตัวเอง");
}

async function getEditableScheduleVersion(versionId: string) {
  const version = await prisma.scheduleVersion.findUnique({
    where: {
      id: versionId,
    },
    select: {
      id: true,
      cycleId: true,
      source: true,
      status: true,
    },
  });

  if (!version) {
    throw new Error("ไม่พบ version ตารางเวร");
  }

  return version;
}

async function publishEditedVersion(versionId: string) {
  const version = await getEditableScheduleVersion(versionId);

  await prisma.$transaction(async (tx) => {
    await tx.scheduleVersion.updateMany({
      where: {
        cycleId: version.cycleId,
        status: "published",
        NOT: {
          id: versionId,
        },
      },
      data: {
        status: "draft",
        publishedAt: null,
      },
    });

    await tx.scheduleVersion.update({
      where: {
        id: versionId,
      },
      data: {
        status: "published",
        publishedAt: new Date(),
      },
    });

    await tx.scheduleCycle.update({
      where: {
        id: version.cycleId,
      },
      data: {
        status: "published",
        publishedAt: new Date(),
      },
    });
  });
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
