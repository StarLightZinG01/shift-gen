"use server";

import { z } from "zod";

import { hashPassword } from "@/lib/auth/password";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type CreateAdminUserActionState = {
  message: string;
  status: "idle" | "success" | "error";
  username: string | null;
};

const createAdminUserSchema = z
  .object({
    username: z.string().trim().min(1, "กรุณากรอก username"),
    displayName: z.string().trim().min(1, "กรุณากรอกชื่อที่แสดง"),
    employeeCode: z.string().trim().optional(),
    password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่าน"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });

export async function createAdminUserAction(
  _prevState: CreateAdminUserActionState,
  formData: FormData,
): Promise<CreateAdminUserActionState> {
  const session = await getCurrentSession();

  if (!session) {
    return {
      message: "กรุณาเข้าสู่ระบบก่อนสร้างผู้ดูแลระบบ",
      status: "error",
      username: null,
    };
  }

  const parsed = createAdminUserSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    employeeCode: formData.get("employeeCode"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "กรุณากรอกข้อมูลให้ครบ",
      status: "error",
      username: null,
    };
  }

  const { username, displayName, password } = parsed.data;
  const employeeCode = parsed.data.employeeCode || null;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { username },
      include: { staff: true },
    });

    if (existingUser?.staff) {
      return {
        message:
          "username นี้ผูกกับข้อมูลบุคลากรอยู่แล้ว กรุณาใช้ username ใหม่สำหรับ admin",
        status: "error",
        username,
      };
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { name: "admin" },
        update: {
          description: "ผู้ดูแลระบบ",
        },
        create: {
          name: "admin",
          description: "ผู้ดูแลระบบ",
        },
      });

      const user = await tx.user.upsert({
        where: { username },
        update: {
          displayName,
          employeeCode,
          passwordHash,
          status: "active",
        },
        create: {
          username,
          displayName,
          employeeCode,
          passwordHash,
          status: "active",
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

      return {
        wasExistingUser: Boolean(existingUser),
      };
    });

    return {
      message: result.wasExistingUser
        ? "อัปเดตบัญชี admin สำเร็จ"
        : "สร้างบัญชี admin สำเร็จ",
      status: "success",
      username,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "ไม่สามารถสร้างบัญชี admin ได้",
      status: "error",
      username,
    };
  }
}
