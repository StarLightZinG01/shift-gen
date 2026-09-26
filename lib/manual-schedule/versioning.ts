import { prisma } from "@/lib/prisma";

import { getNextManualVersionNumber } from "./version-number";

export type ManualScheduleTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

export async function createManualVersionFromParent({
  tx,
  parentVersionId,
  wardId,
  createdBy,
}: {
  tx: ManualScheduleTransactionClient;
  parentVersionId: string;
  wardId: string;
  createdBy: string;
}) {
  const parentVersion = await tx.scheduleVersion.findUnique({
    where: {
      id: parentVersionId,
    },
    include: {
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
      versionNo: getNextManualVersionNumber(nextVersion._max.versionNo),
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
      versionNo: getNextManualVersionNumber(nextWardVersion._max.versionNo),
      source: "manual",
      status: "draft",
      createdBy,
    },
  });

  return { ...manualVersion, wardVersion };
}
