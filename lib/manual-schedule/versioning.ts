import { prisma } from "@/lib/prisma";

export async function createManualVersionFromParent({
  parentVersionId,
  createdBy,
}: {
  parentVersionId: string;
  createdBy: string;
}) {
  return prisma.$transaction(async (tx) => {
    const parentVersion = await tx.scheduleVersion.findUnique({
      where: {
        id: parentVersionId,
      },
      include: {
        assignments: true,
      },
    });

    if (!parentVersion) {
      throw new Error("ไม่พบ version ตารางเวรต้นทาง");
    }

    const nextVersion = await tx.scheduleVersion.aggregate({
      where: {
        cycleId: parentVersion.cycleId,
      },
      _max: {
        versionNo: true,
      },
    });
    const manualVersion = await tx.scheduleVersion.create({
      data: {
        cycleId: parentVersion.cycleId,
        parentVersionId: parentVersion.id,
        versionNo: (nextVersion._max.versionNo ?? 0) + 1,
        source: "manual",
        status: "draft",
        createdBy,
      },
    });

    if (parentVersion.assignments.length > 0) {
      await tx.scheduleAssignment.createMany({
        data: parentVersion.assignments.map((assignment) => ({
          scheduleVersionId: manualVersion.id,
          staffId: assignment.staffId,
          wardId: assignment.wardId,
          workDate: assignment.workDate,
          shiftCode: assignment.shiftCode,
          isOt: assignment.isOt,
          otShifts: assignment.otShifts,
          payAmount: assignment.payAmount,
          note: assignment.note,
        })),
      });
    }

    return manualVersion;
  });
}

export async function assertDraftEditableVersion(versionId: string) {
  const version = await prisma.scheduleVersion.findUnique({
    where: {
      id: versionId,
    },
    select: {
      id: true,
      source: true,
      status: true,
      cycleId: true,
    },
  });

  if (!version) {
    throw new Error("ไม่พบ version ตารางเวร");
  }

  if (version.status !== "draft") {
    throw new Error("แก้ไขได้เฉพาะ version ฉบับร่างเท่านั้น");
  }

  if (version.source !== "manual") {
    throw new Error("กรุณาสร้าง manual version ก่อนแก้ไขตาราง");
  }

  return version;
}
