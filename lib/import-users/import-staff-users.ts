import { hashPassword } from "@/lib/auth/password";
import { syncStaffUserRole } from "@/lib/auth/staff-role-sync";
import { prisma } from "@/lib/prisma";

import { hasAdminRole } from "./admin-collision";
import type {
  ImportStaffUsersOptions,
  ImportStaffUsersSummary,
  StaffImportRow,
} from "./types";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type ImportOneResult = {
  createdUser: boolean;
  updatedUser: boolean;
  createdStaff: boolean;
  updatedStaff: boolean;
  createdWards: number;
};

class ImportRowSkippedError extends Error {}

export async function importStaffUsers(
  rows: StaffImportRow[],
  options: ImportStaffUsersOptions = {},
): Promise<ImportStaffUsersSummary> {
  const summary: ImportStaffUsersSummary = {
    totalRows: rows.length,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    createdUsers: 0,
    updatedUsers: 0,
    createdStaff: 0,
    updatedStaff: 0,
    createdWards: 0,
    errors: [],
    skipped: [],
  };
  const passwordHashes = await preparePasswordHashes(rows, options);

  for (const row of rows) {
    try {
      const result = await prisma.$transaction((tx) =>
        importOneStaffUser(tx, row, options, passwordHashes.get(row.staffCode)),
      );

      summary.successCount += 1;
      summary.createdUsers += result.createdUser ? 1 : 0;
      summary.updatedUsers += result.updatedUser ? 1 : 0;
      summary.createdStaff += result.createdStaff ? 1 : 0;
      summary.updatedStaff += result.updatedStaff ? 1 : 0;
      summary.createdWards += result.createdWards;
    } catch (error) {
      if (error instanceof ImportRowSkippedError) {
        summary.skippedCount += 1;
        summary.skipped.push({
          rowNumber: row.rowNumber,
          staffCode: row.staffCode,
          message: error.message,
        });
        continue;
      }
      summary.failedCount += 1;
      summary.errors.push({
        rowNumber: row.rowNumber,
        staffCode: row.staffCode,
        message: error instanceof Error ? error.message : "ไม่สามารถนำเข้าแถวนี้ได้",
      });
    }
  }

  return summary;
}

async function preparePasswordHashes(
  rows: StaffImportRow[],
  options: ImportStaffUsersOptions,
) {
  const loginRows = rows.filter((row) => !row.generatedStaffCode);
  const existingUsers = await prisma.user.findMany({
    where: { username: { in: loginRows.map((row) => row.staffCode) } },
    select: { username: true },
  });
  const existingUsernames = new Set(existingUsers.map((user) => user.username));
  const rowsToHash = loginRows.filter(
    (row) => options.resetPassword || !existingUsernames.has(row.staffCode),
  );
  const hashes = new Map<string, string>();

  // Limit concurrent bcrypt work so a large hospital roster does not freeze the server.
  for (let index = 0; index < rowsToHash.length; index += 8) {
    const batch = rowsToHash.slice(index, index + 8);
    const batchHashes = await Promise.all(
      batch.map(async (row) => [
        row.staffCode,
        await hashPassword(`Nuh${row.staffCode}`),
      ] as const),
    );
    for (const [staffCode, passwordHash] of batchHashes) {
      hashes.set(staffCode, passwordHash);
    }
  }

  return hashes;
}

async function importOneStaffUser(
  tx: TransactionClient,
  row: StaffImportRow,
  options: ImportStaffUsersOptions,
  preparedPasswordHash?: string,
): Promise<ImportOneResult> {
  const adminAccount = await tx.user.findFirst({
    where: {
      OR: [
        { username: row.staffCode },
        { employeeCode: row.staffCode },
        { staff: { is: { staffCode: row.staffCode } } },
      ],
      roles: { some: { role: { name: "admin" } } },
    },
    select: {
      username: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  if (
    adminAccount &&
    hasAdminRole(adminAccount.roles.map((assignment) => assignment.role.name))
  ) {
    throw new ImportRowSkippedError(
      `ข้ามแถวนี้ เนื่องจากรหัส ${row.staffCode} ตรงกับบัญชี Admin (${adminAccount.username})`,
    );
  }

  let createdWards = 0;
  const homeWardResult = await findOrCreateWard(tx, row.homeWard);
  createdWards += homeWardResult.created ? 1 : 0;

  let user: { id: string } | null = null;
  let createdUser = false;
  let updatedUser = false;

  if (!row.generatedStaffCode) {
    const existingUser = await tx.user.findUnique({
      where: { username: row.staffCode },
    });
    const passwordHash =
      preparedPasswordHash ??
      (!options.resetPassword && existingUser?.passwordHash);

    if (!passwordHash) {
      throw new Error(`ไม่สามารถเตรียมรหัสผ่านสำหรับ ${row.staffCode} ได้`);
    }

    user = await tx.user.upsert({
      where: { username: row.staffCode },
      update: {
        displayName: row.fullName,
        employeeCode: row.staffCode,
        status: "active",
        sessionVersion: { increment: 1 },
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
    createdUser = !existingUser;
    updatedUser = Boolean(existingUser);

    await syncStaffUserRole(tx, user.id, row.isHead);
  }

  const existingStaff = await tx.staff.findUnique({
    where: { staffCode: row.staffCode },
  });
  const staffData = {
    fullName: row.fullName,
    userId: user?.id ?? null,
    homeWardId: homeWardResult.ward.id,
    position: row.position,
    payPosition: row.payPosition,
    staffCategory: row.staffCategory,
    otRate: row.otRate,
    shiftPayRate: row.shiftPayRate,
    isHead: row.isHead,
    isTrainee: row.isNewNurse,
    isNewNurse: row.isNewNurse,
    canBeInCharge: row.canBeInCharge,
  } as const;
  const staff = await tx.staff.upsert({
    where: { staffCode: row.staffCode },
    update: staffData,
    create: { staffCode: row.staffCode, ...staffData },
  });

  await tx.staffWardPermission.upsert({
    where: {
      staffId_wardId: {
        staffId: staff.id,
        wardId: homeWardResult.ward.id,
      },
    },
    update: {},
    create: { staffId: staff.id, wardId: homeWardResult.ward.id },
  });

  return {
    createdUser,
    updatedUser,
    createdStaff: !existingStaff,
    updatedStaff: Boolean(existingStaff),
    createdWards,
  };
}

async function findOrCreateWard(tx: TransactionClient, wardName: string) {
  const code = wardName.trim().replace(/\s+/g, "_").toUpperCase();
  const existingWard = await tx.ward.findUnique({ where: { code } });
  if (existingWard) return { ward: existingWard, created: false };

  const ward = await tx.ward.create({ data: { code, name: wardName } });
  return { ward, created: true };
}
