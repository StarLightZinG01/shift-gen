import { calculateCompensationForAssignments } from "@/lib/compensation/calculate";
import type { WardCompensationResult } from "@/lib/compensation/types";
import { prisma } from "@/lib/prisma";

export async function recalculateAndSaveCompensation(scheduleVersionId: string) {
  const assignments = await prisma.scheduleAssignment.findMany({
    where: {
      scheduleVersionId,
    },
    include: {
      staff: true,
      ward: true,
    },
  });

  const wards = calculateCompensationForAssignments(assignments);

  await prisma.$transaction(async (tx) => {
    await tx.wardCompensationSummary.deleteMany({
      where: {
        scheduleVersionId,
      },
    });

    for (const ward of wards) {
      const summary = await tx.wardCompensationSummary.create({
        data: {
          scheduleVersionId,
          wardId: ward.wardId,
          totalOtAmount: ward.totalOtAmount,
          totalRegularShiftAmount: ward.totalRegularShiftAmount,
          totalAmount: ward.totalAmount,
        },
      });

      if (ward.items.length > 0) {
        await tx.compensationSummaryItem.createMany({
          data: ward.items.map((item) => ({
            summaryId: summary.id,
            category: item.category,
            staffType: item.staffType,
            rate: item.rate,
            quantity: item.quantity,
            amount: item.amount,
          })),
        });
      }
    }
  });

  return buildResult(scheduleVersionId, wards);
}

function buildResult(scheduleVersionId: string, wards: WardCompensationResult[]) {
  return {
    scheduleVersionId,
    wardCount: wards.length,
    totalAmount: wards.reduce((sum, ward) => sum + ward.totalAmount, 0),
  };
}
