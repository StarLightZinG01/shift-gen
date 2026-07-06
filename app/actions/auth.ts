"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth/password";
import {
  clearSessionCookie,
  setSessionCookie,
  type SessionPayload,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type SignInActionState = {
  message: string;
  attemptId: number;
};

const signInSchema = z.object({
  username: z.string().trim().min(1, "กรุณากรอกรหัสประจำตัว"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export async function signInAction(
  prevState: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  const parsed = signInSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return failedSignIn(
      prevState,
      parsed.error.issues[0]?.message ?? "กรุณากรอกข้อมูลให้ครบ",
    );
  }

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      staff: {
        include: {
          homeWard: true,
        },
      },
    },
  });

  if (!user) {
    return failedSignIn(prevState, "รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }

  if (user.status !== "active") {
    return failedSignIn(prevState, "บัญชีผู้ใช้นี้ไม่พร้อมใช้งาน");
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    return failedSignIn(prevState, "รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }

  const sessionPayload: SessionPayload = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    employeeCode: user.employeeCode,
    roles: user.roles.map((userRole) => userRole.role.name),
    staffId: user.staff?.id ?? null,
    homeWardId: user.staff?.homeWardId ?? null,
    homeWardCode: user.staff?.homeWard.code ?? null,
    isHead: user.staff?.isHead ?? false,
  };

  await setSessionCookie(sessionPayload);
  redirect("/home");
}

export async function signOutAction() {
  await clearSessionCookie();
  redirect("/");
}

function failedSignIn(prevState: SignInActionState, message: string) {
  return {
    message,
    attemptId: prevState.attemptId + 1,
  };
}
