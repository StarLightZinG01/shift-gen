"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hashPassword } from "@/lib/auth/password";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type {
  UserManagementRole,
  UserManagementRow,
} from "@/lib/schedule-rounds/types";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type SaveManagedUserResult =
  | {
      status: "success";
      message: string;
      user: UserManagementRow;
    }
  | {
      status: "error";
      message: string;
      user: null;
    };

const managedUserSchema = z
  .object({
    userId: z.string().uuid().nullable(),
    username: z.string().trim().min(1, "กรุณากรอก username"),
    displayName: z.string().trim().min(1, "กรุณากรอกชื่อที่แสดง"),
    employeeCode: z.string().trim().optional(),
    status: z.enum(["active", "inactive"]),
    role: z.enum(["nurse", "ward_head", "admin"]),
    password: z.string().optional(),
    staffCode: z.string().trim().optional(),
    homeWardId: z.string().uuid().nullable(),
    allowedWardIds: z.array(z.string().uuid()),
    position: z.string().trim().optional(),
    payPosition: z.string().trim().optional(),
    otRate: z.coerce.number().min(0, "ค่า OT ต้องไม่น้อยกว่า 0"),
    shiftPayRate: z.coerce.number().min(0, "ค่าเวรต้องไม่น้อยกว่า 0"),
    isTrainee: z.boolean(),
  })
  .superRefine((data, context) => {
    const isCreate = !data.userId;

    if (isCreate && (!data.password || data.password.length < 8)) {
      context.addIssue({
        code: "custom",
        message: "ผู้ใช้ใหม่ต้องมีรหัสผ่านอย่างน้อย 8 ตัวอักษร",
        path: ["password"],
      });
    }

    if (data.password && data.password.length > 0 && data.password.length < 8) {
      context.addIssue({
        code: "custom",
        message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
        path: ["password"],
      });
    }

    if (data.role !== "admin") {
      if (!data.staffCode?.trim()) {
        context.addIssue({
          code: "custom",
          message: "กรุณากรอกรหัสบุคลากร",
          path: ["staffCode"],
        });
      }

      if (!data.homeWardId) {
        context.addIssue({
          code: "custom",
          message: "กรุณาเลือกวอร์ดหลัก",
          path: ["homeWardId"],
        });
      }
    }
  });

export async function saveManagedUserAction(
  input: unknown,
): Promise<SaveManagedUserResult> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      status: "error",
      message: "บัญชีนี้ไม่มีสิทธิ์จัดการผู้ใช้",
      user: null,
    };
  }

  const parsed = managedUserSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลผู้ใช้ไม่ถูกต้อง",
      user: null,
    };
  }

  const data = parsed.data;
  const employeeCode = data.employeeCode || null;

  try {
    const savedUserId = await prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: {
          name: data.role,
        },
        update: {
          description: getRoleLabel(data.role),
        },
        create: {
          name: data.role,
          description: getRoleLabel(data.role),
        },
      });

      const passwordData =
        data.password && data.password.length > 0
          ? {
              passwordHash: await hashPassword(data.password),
            }
          : {};

      const user = data.userId
        ? await tx.user.update({
            where: {
              id: data.userId,
            },
            data: {
              username: data.username,
              displayName: data.displayName,
              employeeCode,
              status: data.status,
              ...passwordData,
            },
          })
        : await tx.user.create({
            data: {
              username: data.username,
              displayName: data.displayName,
              employeeCode,
              status: data.status,
              passwordHash: await hashPassword(data.password ?? ""),
            },
          });

      await tx.userRole.deleteMany({
        where: {
          userId: user.id,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });

      if (data.role === "admin") {
        await tx.staff.updateMany({
          where: {
            userId: user.id,
          },
          data: {
            userId: null,
            isHead: false,
          },
        });

        return user.id;
      }

      const homeWardId = data.homeWardId;
      const staffCode = data.staffCode?.trim() || data.username;

      if (!homeWardId) {
        throw new Error("กรุณาเลือกวอร์ดหลัก");
      }

      const existingStaff = await tx.staff.findFirst({
        where: {
          OR: [
            {
              userId: user.id,
            },
            {
              staffCode,
            },
          ],
        },
      });
      const previousHomeWardId = existingStaff?.homeWardId ?? null;

      const staffData = {
        userId: user.id,
        staffCode,
        fullName: data.displayName,
        homeWardId,
        position: data.position || null,
        payPosition: data.payPosition || null,
        otRate: data.otRate.toFixed(2),
        shiftPayRate: data.shiftPayRate.toFixed(2),
        isHead: data.role === "ward_head",
        isTrainee: data.isTrainee,
      };

      const staff = existingStaff
        ? await tx.staff.update({
            where: {
              id: existingStaff.id,
            },
            data: staffData,
          })
        : await tx.staff.create({
            data: staffData,
          });

      await tx.staffWardPermission.deleteMany({
        where: {
          staffId: staff.id,
        },
      });

      const allowedWardIds = Array.from(new Set(data.allowedWardIds)).filter(
        (wardId) => wardId !== homeWardId,
      );

      if (allowedWardIds.length > 0) {
        await tx.staffWardPermission.createMany({
          data: allowedWardIds.map((wardId) => ({
            staffId: staff.id,
            wardId,
            createdBy: session.userId,
          })),
          skipDuplicates: true,
        });
      }

      await syncStaffToCurrentCycleSnapshot(tx, {
        staffId: staff.id,
        staffCode: staff.staffCode,
        fullName: staff.fullName,
        homeWardId,
        previousHomeWardId,
        allowedWardIds,
        position: staff.position,
        payPosition: staff.payPosition,
        otRate: staff.otRate.toString(),
        shiftPayRate: staff.shiftPayRate.toString(),
        isHead: staff.isHead,
        isTrainee: staff.isTrainee,
      });

      return user.id;
    });

    const user = await getManagedUserRow(savedUserId);

    revalidatePath("/home/schedule-rounds");
    revalidatePath("/schedule-rounds");

    return {
      status: "success",
      message: data.userId ? "อัปเดตผู้ใช้สำเร็จ" : "เพิ่มผู้ใช้สำเร็จ",
      user,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "ไม่สามารถบันทึกผู้ใช้ได้",
      user: null,
    };
  }
}

async function syncStaffToCurrentCycleSnapshot(
  tx: TransactionClient,
  input: {
    staffId: string;
    staffCode: string;
    fullName: string;
    homeWardId: string;
    previousHomeWardId: string | null;
    allowedWardIds: string[];
    position: string | null;
    payPosition: string | null;
    otRate: string;
    shiftPayRate: string;
    isHead: boolean;
    isTrainee: boolean;
  },
) {
  const cycle =
    (await tx.scheduleCycle.findFirst({
      where: {
        status: {
          in: ["preparing", "open", "locked"],
        },
      },
      orderBy: [
        {
          year: "desc",
        },
        {
          month: "desc",
        },
      ],
    })) ??
    (await tx.scheduleCycle.findFirst({
      orderBy: [
        {
          year: "desc",
        },
        {
          month: "desc",
        },
      ],
    }));

  if (!cycle) {
    return;
  }

  if (input.previousHomeWardId && input.previousHomeWardId !== input.homeWardId) {
    const previousPreparation = await tx.wardCyclePreparation.findUnique({
      where: {
        cycleId_wardId: {
          cycleId: cycle.id,
          wardId: input.previousHomeWardId,
        },
      },
      select: {
        id: true,
      },
    });

    if (previousPreparation) {
      await tx.wardStaffSnapshot.deleteMany({
        where: {
          wardCycleId: previousPreparation.id,
          staffId: input.staffId,
        },
      });
    }
  }

  const preparation = await tx.wardCyclePreparation.findUnique({
    where: {
      cycleId_wardId: {
        cycleId: cycle.id,
        wardId: input.homeWardId,
      },
    },
    select: {
      id: true,
      _count: {
        select: {
          staffSnapshots: true,
        },
      },
    },
  });

  if (!preparation || preparation._count.staffSnapshots === 0) {
    return;
  }

  const wards = await tx.ward.findMany({
    where: {
      id: {
        in: Array.from(new Set([input.homeWardId, ...input.allowedWardIds])),
      },
    },
    select: {
      id: true,
      code: true,
    },
    orderBy: {
      code: "asc",
    },
  });
  const homeWard = wards.find((ward) => ward.id === input.homeWardId);
  const allowedWardsText = wards.map((ward) => ward.code).join(", ");
  const existingSnapshot = await tx.wardStaffSnapshot.findFirst({
    where: {
      wardCycleId: preparation.id,
      staffId: input.staffId,
    },
    select: {
      id: true,
    },
  });
  const snapshotData = {
    staffId: input.staffId,
    staffCode: input.staffCode,
    fullName: input.fullName,
    homeWardName: homeWard?.code ?? "",
    allowedWardsText: allowedWardsText || homeWard?.code || "",
    position: input.position,
    payPosition: input.payPosition,
    otRate: input.otRate,
    shiftPayRate: input.shiftPayRate,
    isHead: input.isHead,
    isTrainee: input.isTrainee,
  };

  if (existingSnapshot) {
    await tx.wardStaffSnapshot.update({
      where: {
        id: existingSnapshot.id,
      },
      data: snapshotData,
    });
    return;
  }

  await tx.wardStaffSnapshot.create({
    data: {
      wardCycleId: preparation.id,
      ...snapshotData,
    },
  });
}

async function getManagedUserRow(userId: string): Promise<UserManagementRow> {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      staff: {
        include: {
          homeWard: true,
          wardPermissions: {
            include: {
              ward: true,
            },
          },
        },
      },
    },
  });

  const role = normalizeRole(user.roles[0]?.role.name, user.staff?.isHead);
  const homeWard = user.staff?.homeWard;
  const permissionWards = user.staff?.wardPermissions.map((item) => item.ward) ?? [];
  const allowedWards = [
    ...(homeWard ? [homeWard] : []),
    ...permissionWards,
  ].filter(
    (ward, index, wards) =>
      wards.findIndex((item) => item.id === ward.id) === index,
  );

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    employeeCode: user.employeeCode,
    status: user.status,
    role,
    staffId: user.staff?.id ?? null,
    staffCode: user.staff?.staffCode ?? user.employeeCode ?? user.username,
    homeWardId: user.staff?.homeWardId ?? null,
    homeWardCode: homeWard?.code ?? "-",
    allowedWardIds: allowedWards.map((ward) => ward.id),
    allowedWardCodes: allowedWards.map((ward) => ward.code),
    position: user.staff?.position ?? "",
    payPosition: user.staff?.payPosition ?? "",
    otRate: user.staff?.otRate.toString() ?? "0",
    shiftPayRate: user.staff?.shiftPayRate.toString() ?? "0",
    isHead: user.staff?.isHead ?? role === "ward_head",
    isTrainee: user.staff?.isTrainee ?? false,
  };
}

function normalizeRole(
  role: string | undefined,
  isHead: boolean | undefined,
): UserManagementRole {
  if (role === "admin" || role === "ward_head" || role === "nurse") {
    return role;
  }

  return isHead ? "ward_head" : "nurse";
}

function getRoleLabel(role: UserManagementRole) {
  const labels: Record<UserManagementRole, string> = {
    nurse: "พยาบาล",
    ward_head: "หัวหน้าวอร์ด",
    admin: "ผู้ดูแลระบบ",
  };

  return labels[role];
}
