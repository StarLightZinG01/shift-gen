import { prisma } from "@/lib/prisma";

import type { ShiftStaffingRequirement } from "./types";

export type SaveScheduleManagementInput = {
  cycleId: string;
  wardId: string;
  userId: string;
  staffRows: SaveStaffRowInput[];
  staffingRequirements: {
    morning: ShiftStaffingRequirement;
    afternoon: ShiftStaffingRequirement;
    night: ShiftStaffingRequirement;
  };
};

export type SaveStaffRowInput = {
  rowKey: string;
  rowType: "home" | "new" | "external";
  staffId: string | null;
  code: string;
  fullName: string;
  payPosition: string;
  otRate: number;
  shiftPayRate: number;
  isHead: boolean;
  isTrainee: boolean;
};

export async function saveScheduleManagementData({
  cycleId,
  wardId,
  userId,
  staffRows,
  staffingRequirements,
}: SaveScheduleManagementInput) {
  return prisma.$transaction(async (tx) => {
    const preparationStatus = getPreparationStatus(staffRows, staffingRequirements);

    for (const row of staffRows) {
      if (row.rowType === "home") {
        await updateHomeStaff(tx, wardId, row);
      }

      if (row.rowType === "new") {
        await createHomeStaff(tx, wardId, row);
      }

      if (row.rowType === "external") {
        await upsertExternalStaffSelection(tx, {
          cycleId,
          wardId,
          userId,
          staffId: row.staffId,
        });
      }
    }

    const preparation = await tx.wardCyclePreparation.upsert({
      where: {
        cycleId_wardId: {
          cycleId,
          wardId,
        },
      },
      update: {
        status: preparationStatus,
        submittedBy: userId,
        submittedAt: new Date(),
      },
      create: {
        cycleId,
        wardId,
        status: preparationStatus,
        submittedBy: userId,
        submittedAt: new Date(),
      },
    });

    await Promise.all([
      upsertStaffingRequirement(tx, preparation.id, "morning", staffingRequirements.morning),
      upsertStaffingRequirement(
        tx,
        preparation.id,
        "afternoon",
        staffingRequirements.afternoon,
      ),
      upsertStaffingRequirement(tx, preparation.id, "night", staffingRequirements.night),
    ]);

    return preparation;
  });
}

function getPreparationStatus(
  staffRows: SaveStaffRowInput[],
  staffingRequirements: SaveScheduleManagementInput["staffingRequirements"],
) {
  const hasStaff = staffRows.length > 0;
  const hasHead = staffRows.some((row) => row.isHead);
  const hasValidStaffing =
    isValidRequirement(staffingRequirements.morning) &&
    isValidRequirement(staffingRequirements.afternoon) &&
    isValidRequirement(staffingRequirements.night);
  const hasCompleteStaff = staffRows.every(
    (row) =>
      row.code.trim() &&
      row.fullName.trim() &&
      row.payPosition.trim() &&
      Number.isFinite(row.otRate) &&
      Number.isFinite(row.shiftPayRate),
  );

  return hasStaff && hasHead && hasValidStaffing && hasCompleteStaff
    ? "submitted"
    : "needs_fix";
}

function isValidRequirement(requirement: ShiftStaffingRequirement) {
  return requirement.min >= 0 && requirement.max >= 0 && requirement.min <= requirement.max;
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function updateHomeStaff(
  tx: TransactionClient,
  wardId: string,
  row: SaveStaffRowInput,
) {
  if (!row.staffId) {
    throw new Error("ไม่พบรหัสอ้างอิงบุคลากรเดิม");
  }

  await tx.staff.updateMany({
    where: {
      id: row.staffId,
      homeWardId: wardId,
    },
    data: {
      staffCode: row.code,
      fullName: row.fullName,
      payPosition: row.payPosition,
      otRate: row.otRate.toFixed(2),
      shiftPayRate: row.shiftPayRate.toFixed(2),
      isHead: row.isHead,
      isTrainee: row.isTrainee,
    },
  });
}

async function createHomeStaff(
  tx: TransactionClient,
  wardId: string,
  row: SaveStaffRowInput,
) {
  await tx.staff.create({
    data: {
      staffCode: row.code,
      fullName: row.fullName,
      homeWardId: wardId,
      position: row.payPosition,
      payPosition: row.payPosition,
      otRate: row.otRate.toFixed(2),
      shiftPayRate: row.shiftPayRate.toFixed(2),
      isHead: row.isHead,
      isTrainee: row.isTrainee,
    },
  });
}

async function upsertExternalStaffSelection(
  tx: TransactionClient,
  input: {
    cycleId: string;
    wardId: string;
    userId: string;
    staffId: string | null;
  },
) {
  if (!input.staffId) {
    throw new Error("ไม่พบรหัสอ้างอิงบุคลากรช่วยวอร์ด");
  }

  const permission = await tx.staffWardPermission.findUnique({
    where: {
      staffId_wardId: {
        staffId: input.staffId,
        wardId: input.wardId,
      },
    },
  });

  if (!permission) {
    throw new Error("บุคลากรคนนี้ยังไม่มีสิทธิ์ขึ้นเวรวอร์ดนี้");
  }

  await tx.wardCycleExternalStaff.upsert({
    where: {
      cycleId_wardId_staffId: {
        cycleId: input.cycleId,
        wardId: input.wardId,
        staffId: input.staffId,
      },
    },
    update: {
      selectedBy: input.userId,
      selectedAt: new Date(),
    },
    create: {
      cycleId: input.cycleId,
      wardId: input.wardId,
      staffId: input.staffId,
      selectedBy: input.userId,
    },
  });
}

async function upsertStaffingRequirement(
  tx: TransactionClient,
  wardCycleId: string,
  shiftCode: string,
  requirement: ShiftStaffingRequirement,
) {
  await tx.staffingRequirement.upsert({
    where: {
      wardCycleId_shiftCode: {
        wardCycleId,
        shiftCode,
      },
    },
    update: {
      minStaff: requirement.min,
      maxStaff: requirement.max,
    },
    create: {
      wardCycleId,
      shiftCode,
      minStaff: requirement.min,
      maxStaff: requirement.max,
    },
  });
}
