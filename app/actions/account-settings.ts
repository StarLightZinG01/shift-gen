"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  getCurrentSession,
  setSessionCookie,
  type SessionPayload,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type AccountActionResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const displayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร")
    .max(150, "ชื่อต้องไม่เกิน 150 ตัวอักษร"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    newPassword: z
      .string()
      .min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
      .max(128, "รหัสผ่านใหม่ต้องไม่เกิน 128 ตัวอักษร"),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่านใหม่"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน",
    path: ["newPassword"],
  });

export async function updateDisplayNameAction(
  input: unknown,
): Promise<AccountActionResult> {
  const session = await getCurrentSession();

  if (!session) {
    return { status: "error", message: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  }

  const parsed = displayNameSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ชื่อที่แสดงไม่ถูกต้อง",
    };
  }

  const displayName = parsed.data.displayName;

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: session.userId },
        data: { displayName },
        select: {
          id: true,
          displayName: true,
          staff: { select: { id: true } },
        },
      });

      if (user.staff) {
        await tx.staff.update({
          where: { id: user.staff.id },
          data: { fullName: displayName },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "account.display_name_updated",
          targetType: "user",
          targetId: session.userId,
          detail: {
            displayName,
            staffNameSynced: Boolean(user.staff),
          },
        },
      });
    });

    await setSessionCookie(buildUpdatedSession(session, displayName));
    revalidateAccountPages();

    return {
      status: "success",
      message: "เปลี่ยนชื่อที่แสดงและข้อมูลบุคลากรเรียบร้อยแล้ว",
    };
  } catch (error) {
    console.error("Unable to update account display name", error);
    return { status: "error", message: "ไม่สามารถเปลี่ยนชื่อที่แสดงได้" };
  }
}

export async function changePasswordAction(
  input: unknown,
): Promise<AccountActionResult> {
  const session = await getCurrentSession();

  if (!session) {
    return { status: "error", message: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  }

  const parsed = passwordSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลรหัสผ่านไม่ถูกต้อง",
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return { status: "error", message: "ไม่พบบัญชีผู้ใช้" };
    }

    const isCurrentPasswordValid = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      return { status: "error", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { passwordHash },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: "account.password_updated",
          targetType: "user",
          targetId: session.userId,
        },
      }),
    ]);

    return { status: "success", message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
  } catch (error) {
    console.error("Unable to update account password", error);
    return { status: "error", message: "ไม่สามารถเปลี่ยนรหัสผ่านได้" };
  }
}

function buildUpdatedSession(
  session: SessionPayload,
  displayName: string,
): SessionPayload {
  return {
    userId: session.userId,
    username: session.username,
    displayName,
    employeeCode: session.employeeCode,
    roles: session.roles,
    staffId: session.staffId,
    homeWardId: session.homeWardId,
    homeWardCode: session.homeWardCode,
    isHead: session.isHead,
  };
}

function revalidateAccountPages() {
  revalidatePath("/home", "layout");
  revalidatePath("/home/my-schedule");
  revalidatePath("/home/manual-schedule");
  revalidatePath("/home/schedule-management");
  revalidatePath("/home/schedule-rounds");
}
