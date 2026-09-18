import { prisma } from "@/lib/prisma";

export async function createManualVersionFromParent({
  parentVersionId,
  wardId,
  createdBy,
}: {
  parentVersionId: string;
  wardId: string;
  createdBy: string;
}) {
  return prisma.$transaction(async (tx) => {
    const parentVersion = await tx.scheduleVersion.findUnique({
      where: {
        id: parentVersionId,
      },
      include: {
        assignments: { where: { wardId } },
        wardVersions: { where: { wardId }, take: 1 },
      },
    });

    if (!parentVersion) {
      throw new Error("ไม่พบ version ตารางเวรต้นทาง");
    }

    const parentWardVersion = parentVersion.wardVersions[0];
    if (!parentWardVersion) {
      throw new Error("ไม่พบ version ของวอร์ดที่ต้องการแก้ไข");
    }

    const [nextVersion, nextWardVersion] = await Promise.all([
      tx.scheduleVersion.aggregate({
        where: { cycleId: parentVersion.cycleId },
        _max: { versionNo: true },
      }),
      tx.scheduleWardVersion.aggregate({
        where: { cycleId: parentVersion.cycleId, wardId },
        _max: { versionNo: true },
      }),
    ]);
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
    const wardVersion = await tx.scheduleWardVersion.create({
      data: {
        scheduleVersionId: manualVersion.id,
        cycleId: parentVersion.cycleId,
        wardId,
        parentWardVersionId: parentWardVersion.id,
        versionNo: (nextWardVersion._max.versionNo ?? 0) + 1,
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

    return { ...manualVersion, wardVersion };
  });
}
