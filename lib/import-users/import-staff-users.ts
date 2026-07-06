import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

import type {
  ImportRowError,
  ImportStaffUsersOptions,
  ImportStaffUsersSummary,
  StaffImportRow,
} from "./types";

type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

type ImportOneResult = {
  createdUser: boolean;
  updatedUser: boolean;
  createdStaff: boolean;
  updatedStaff: boolean;
  createdWards: number;
};

export async function importStaffUsers(
  rows: StaffImportRow[],
  options: ImportStaffUsersOptions = {},
): Promise<ImportStaffUsersSummary> {
  const summary: ImportStaffUsersSummary = {
    totalRows: rows.length,
    successCount: 0,
    failedCount: 0,
    createdUsers: 0,
    updatedUsers: 0,
    createdStaff: 0,
    updatedStaff: 0,
    createdWards: 0,
    errors: [],
  };

  for (const row of rows) {
    try {
      const result = await prisma.$transaction((tx) =>
        importOneStaffUser(tx, row, options),
      );

      summary.successCount += 1;
      summary.createdUsers += result.createdUser ? 1 : 0;
      summary.updatedUsers += result.updatedUser ? 1 : 0;
      summary.createdStaff += result.createdStaff ? 1 : 0;
      summary.updatedStaff += result.updatedStaff ? 1 : 0;
      summary.createdWards += result.createdWards;
    } catch (error) {
      summary.failedCount += 1;
      summary.errors.push({
        rowNumber: row.rowNumber,
        staffCode: row.staffCode,
        message:
          error instanceof Error ? error.message : "ไม่สามารถ import แถวนี้ได้",
      });
    }
  }

  return summary;
}

async function importOneStaffUser(
  tx: TransactionClient,
  row: StaffImportRow,
  options: ImportStaffUsersOptions,
): Promise<ImportOneResult> {
  let createdWards = 0;
  const roleName = getRoleName(row);
  const role = await tx.role.upsert({
    where: { name: roleName },
    update: {},
    create: {
      name: roleName,
      description: `Imported role: ${roleName}`,
    },
  });

  const homeWardResult = await findOrCreateWard(tx, row.homeWard);
  createdWards += homeWardResult.created ? 1 : 0;

  const existingUser = await tx.user.findUnique({
    where: { username: row.staffCode },
  });
  const passwordHash =
    !existingUser || options.resetPassword
      ? await hashPassword(`Nuh${row.staffCode}`)
      : existingUser.passwordHash;

  const user = await tx.user.upsert({
    where: { username: row.staffCode },
    update: {
      displayName: row.fullName,
      employeeCode: row.staffCode,
      status: "active",
      passwordHash,
    },
    create: {
      username: row.staffCode,
      employeeCode: row.staffCode,
      displayName: row.fullName,
      status: "active",
      passwordHash,
    },
  });

  const existingStaff = await tx.staff.findUnique({
    where: { staffCode: row.staffCode },
  });

  const staff = await tx.staff.upsert({
    where: { staffCode: row.staffCode },
    update: {
      fullName: row.fullName,
      userId: user.id,
      homeWardId: homeWardResult.ward.id,
      position: row.position,
      payPosition: row.payPosition,
      otRate: row.otRate,
      shiftPayRate: row.shiftPayRate,
      isHead: row.isHead,
      isTrainee: row.isTrainee,
    },
    create: {
      staffCode: row.staffCode,
      fullName: row.fullName,
      userId: user.id,
      homeWardId: homeWardResult.ward.id,
      position: row.position,
      payPosition: row.payPosition,
      otRate: row.otRate,
      shiftPayRate: row.shiftPayRate,
      isHead: row.isHead,
      isTrainee: row.isTrainee,
    },
  });

  await tx.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  const allowedWardNames = uniqueStrings([row.homeWard, ...row.allowedWards]);

  for (const wardName of allowedWardNames) {
    const wardResult = await findOrCreateWard(tx, wardName);
    createdWards += wardResult.created ? 1 : 0;

    await tx.staffWardPermission.upsert({
      where: {
        staffId_wardId: {
          staffId: staff.id,
          wardId: wardResult.ward.id,
        },
      },
      update: {},
      create: {
        staffId: staff.id,
        wardId: wardResult.ward.id,
      },
    });
  }

  return {
    createdUser: !existingUser,
    updatedUser: Boolean(existingUser),
    createdStaff: !existingStaff,
    updatedStaff: Boolean(existingStaff),
    createdWards,
  };
}

async function findOrCreateWard(tx: TransactionClient, wardName: string) {
  const code = makeWardCode(wardName);
  const existingWard = await tx.ward.findUnique({ where: { code } });

  if (existingWard) {
    return { ward: existingWard, created: false };
  }

  const ward = await tx.ward.create({
    data: {
      code,
      name: wardName,
    },
  });

  return { ward, created: true };
}

function getRoleName(row: StaffImportRow) {
  if (row.role) {
    return row.role;
  }

  return row.isHead ? "ward_head" : "nurse";
}

function makeWardCode(wardName: string) {
  return wardName.trim().replace(/\s+/g, "_").toUpperCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function mergeImportErrors(
  summary: ImportStaffUsersSummary,
  errors: ImportRowError[],
): ImportStaffUsersSummary {
  return {
    ...summary,
    totalRows: summary.totalRows + errors.length,
    failedCount: summary.failedCount + errors.length,
    errors: [...errors, ...summary.errors],
  };
}
