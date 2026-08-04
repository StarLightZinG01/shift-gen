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
  homeWard: string;
  payPosition: string;
  otRate: number;
  shiftPayRate: number;
  isHead: boolean;
  isTrainee: boolean;
  off: string;
  vacation: string;
  leave: string;
  academic: string;
  preferredShifts: string;
};

export async function saveScheduleManagementData({
  cycleId,
  wardId,
  userId,
  staffRows,
  staffingRequirements,
}: SaveScheduleManagementInput) {
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.scheduleCycle.findUnique({
      where: {
        id: cycleId,
      },
      select: {
        month: true,
        year: true,
      },
    });

    if (!cycle) {
      throw new Error("ไม่พบรอบจัดตารางสำหรับบันทึกคำขอวัน off/V/ล");
    }

    const preparationStatus = getPreparationStatus(staffRows, staffingRequirements);
    const savedRows: Array<SaveStaffRowInput & { savedStaffId: string }> = [];

    for (const row of staffRows) {
      let savedStaffId = row.staffId;

      if (row.rowType === "home") {
        savedStaffId = await updateHomeStaff(tx, wardId, row);
      }

      if (row.rowType === "new") {
        savedStaffId = await createHomeStaff(tx, wardId, row);
      }

      if (row.rowType === "external") {
        await upsertExternalStaffSelection(tx, {
          cycleId,
          wardId,
          userId,
          staffId: row.staffId,
        });
      }

      if (!savedStaffId) {
        throw new Error("ไม่พบรหัสอ้างอิงบุคลากรสำหรับบันทึกข้อมูล");
      }

      savedRows.push({
        ...row,
        savedStaffId,
      });

      await replaceStaffAvailabilityRequests(tx, {
        cycleId,
        staffId: savedStaffId,
        cycleMonth: cycle.month,
        cycleYear: cycle.year,
        off: row.off,
        vacation: row.vacation,
        leave: row.leave,
        academic: row.academic,
        preferredShifts: row.preferredShifts,
      });
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

    await replaceWardStaffSnapshots(
      tx,
      preparation.id,
      savedRows.filter((row) => row.rowType !== "external"),
    );
    await syncExternalStaffSelections(tx, {
      cycleId,
      wardId,
      staffIds: savedRows
        .filter((row) => row.rowType === "external")
        .map((row) => row.savedStaffId),
    });

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

  return row.staffId;
}

async function createHomeStaff(
  tx: TransactionClient,
  wardId: string,
  row: SaveStaffRowInput,
) {
  const existingStaff = await tx.staff.findUnique({
    where: {
      staffCode: row.code,
    },
    select: {
      id: true,
      homeWardId: true,
    },
  });

  if (existingStaff) {
    if (existingStaff.homeWardId !== wardId) {
      throw new Error(
        `รหัสบุคลากร ${row.code} มีอยู่ในวอร์ดอื่นแล้ว หากต้องการใช้คนนี้ให้เพิ่มผ่านบุคลากรช่วยวอร์ด`,
      );
    }

    await tx.staff.update({
      where: {
        id: existingStaff.id,
      },
      data: {
        fullName: row.fullName,
        position: row.payPosition,
        payPosition: row.payPosition,
        otRate: row.otRate.toFixed(2),
        shiftPayRate: row.shiftPayRate.toFixed(2),
        isHead: row.isHead,
        isTrainee: row.isTrainee,
      },
    });

    return existingStaff.id;
  }

  const staff = await tx.staff.create({
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

  return staff.id;
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

async function syncExternalStaffSelections(
  tx: TransactionClient,
  input: {
    cycleId: string;
    wardId: string;
    staffIds: string[];
  },
) {
  await tx.wardCycleExternalStaff.deleteMany({
    where: {
      cycleId: input.cycleId,
      wardId: input.wardId,
      ...(input.staffIds.length > 0
        ? {
            staffId: {
              notIn: input.staffIds,
            },
          }
        : {}),
    },
  });
}

async function replaceWardStaffSnapshots(
  tx: TransactionClient,
  wardCycleId: string,
  rows: Array<SaveStaffRowInput & { savedStaffId: string }>,
) {
  await tx.wardStaffSnapshot.deleteMany({
    where: {
      wardCycleId,
    },
  });

  if (rows.length === 0) {
    return;
  }

  await tx.wardStaffSnapshot.createMany({
    data: rows.map((row) => ({
      wardCycleId,
      staffId: row.savedStaffId,
      staffCode: row.code,
      fullName: row.fullName,
      homeWardName: row.homeWard,
      allowedWardsText: row.homeWard,
      position: row.payPosition,
      payPosition: row.payPosition,
      otRate: row.otRate.toFixed(2),
      shiftPayRate: row.shiftPayRate.toFixed(2),
      isHead: row.isHead,
      isTrainee: row.isTrainee,
    })),
  });
}

async function replaceStaffAvailabilityRequests(
  tx: TransactionClient,
  input: {
    cycleId: string;
    staffId: string | null;
    cycleMonth: number;
    cycleYear: number;
    off: string;
    vacation: string;
    leave: string;
    academic: string;
    preferredShifts: string;
  },
) {
  if (!input.staffId) {
    throw new Error("ไม่พบรหัสบุคลากรสำหรับบันทึกคำขอวัน off/V/ล");
  }

  const daysByType = {
    Off: parseRequestDays(input.off, "O (off)", input.cycleMonth, input.cycleYear),
    V: parseRequestDays(input.vacation, "V", input.cycleMonth, input.cycleYear),
    ล: parseRequestDays(input.leave, "ล", input.cycleMonth, input.cycleYear),
    ว: parseRequestDays(input.academic, "ว", input.cycleMonth, input.cycleYear),
  };
  const preferredShiftRequests = parsePreferredShiftRequests(
    input.preferredShifts,
    input.cycleMonth,
    input.cycleYear,
  );
  const usedDays = new Map<number, string>();

  for (const [requestType, days] of Object.entries(daysByType)) {
    for (const day of days) {
      const existingType = usedDays.get(day);
      if (existingType) {
        throw new Error(
          `วันที่ ${day} ถูกใส่ซ้ำทั้ง ${existingType} และ ${requestType}`,
        );
      }
      usedDays.set(day, requestType);
    }
  }

  for (const request of preferredShiftRequests) {
    const existingType = usedDays.get(request.day);
    if (existingType) {
      throw new Error(
        `วันที่ ${request.day} ถูกใส่ซ้ำทั้ง ${existingType} และ วันที่อยากเข้าเวร`,
      );
    }
    usedDays.set(request.day, "วันที่อยากเข้าเวร");
  }

  await tx.availabilityRequest.deleteMany({
    where: {
      cycleId: input.cycleId,
      staffId: input.staffId,
      requestType: {
        in: ["Off", "V", "ล", "ว", "PreferredShift"],
      },
    },
  });

  const requests = Object.entries(daysByType).flatMap(([requestType, days]) =>
    days.map((day) => ({
      cycleId: input.cycleId,
      staffId: input.staffId!,
      requestType,
      requestDate: buildCycleDate(input.cycleYear, input.cycleMonth, day),
      reason: "แก้ไขจากหน้าเตรียมข้อมูลวอร์ด",
      preferredShift: null,
      status: "submitted",
    })),
  );
  const preferredRequests = preferredShiftRequests.map((request) => ({
    cycleId: input.cycleId,
    staffId: input.staffId!,
    requestType: "PreferredShift",
    requestDate: buildCycleDate(input.cycleYear, input.cycleMonth, request.day),
    reason: "แก้ไขจากหน้าเตรียมข้อมูลวอร์ด",
    preferredShift: request.shift,
    status: "submitted",
  }));

  if (requests.length > 0 || preferredRequests.length > 0) {
    await tx.availabilityRequest.createMany({
      data: [...requests, ...preferredRequests],
    });
  }
}

function parseRequestDays(
  value: string,
  label: string,
  cycleMonth: number,
  cycleYear: number,
) {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "0" || trimmed === "-") {
    return [];
  }

  const daysInMonth = new Date(normalizeYear(cycleYear), cycleMonth, 0).getDate();
  const days = trimmed
    .replace(/[，、]/g, ",")
    .split(/[,\s]+/)
    .filter(Boolean)
    .flatMap((part) => expandDayPart(part, label));
  const uniqueDays = Array.from(new Set(days)).sort((a, b) => a - b);

  for (const day of uniqueDays) {
    if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
      throw new Error(`${label} มีวันที่ไม่ถูกต้อง: ${day}`);
    }
  }

  return uniqueDays;
}

function parsePreferredShiftRequests(
  value: string,
  cycleMonth: number,
  cycleYear: number,
) {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "0" || trimmed === "-") {
    return [];
  }

  const daysInMonth = new Date(normalizeYear(cycleYear), cycleMonth, 0).getDate();
  const requests = trimmed
    .replace(/[，、]/g, ",")
    .split(/[,;\n\r]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(\d{1,2})\s*(?::|=|\s)\s*(ช\/บ|ด\/บ|ช|บ|ด)$/);

      if (!match) {
        throw new Error(
          `วันที่อยากเข้าเวรต้องอยู่ในรูปแบบ วัน:กะ เช่น 20:ช หรือ 21:ด`,
        );
      }

      const day = Number(match[1]);
      const shift = match[2];

      if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
        throw new Error(`วันที่อยากเข้าเวรมีวันที่ไม่ถูกต้อง: ${day}`);
      }

      return { day, shift };
    });

  const seenDays = new Set<number>();
  for (const request of requests) {
    if (seenDays.has(request.day)) {
      throw new Error(`วันที่อยากเข้าเวรมีวันที่ซ้ำ: ${request.day}`);
    }
    seenDays.add(request.day);
  }

  return requests.sort((a, b) => a.day - b.day);
}

function expandDayPart(part: string, label: string) {
  const rangeMatch = part.match(/^(\d{1,2})-(\d{1,2})$/);

  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);

    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
      throw new Error(`${label} มีช่วงวันที่ไม่ถูกต้อง: ${part}`);
    }

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  const day = Number(part);

  if (!Number.isInteger(day)) {
    throw new Error(`${label} มีวันที่ไม่ถูกต้อง: ${part}`);
  }

  return [day];
}

function buildCycleDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(normalizeYear(year), month - 1, day));
}

function normalizeYear(year: number) {
  return year > 2400 ? year - 543 : year;
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
