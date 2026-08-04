"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth/session";
import { recalculateAndSaveCompensation } from "@/lib/compensation/save";

export type RecalculateCompensationState = {
  ok: boolean;
  message: string;
};

export async function recalculateCompensationAction(
  scheduleVersionId: string,
): Promise<RecalculateCompensationState> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      ok: false,
      message: "เฉพาะผู้ดูแลระบบเท่านั้นที่คำนวณค่าตอบแทนใหม่ได้",
    };
  }

  if (!scheduleVersionId) {
    return {
      ok: false,
      message: "ไม่พบตารางเวรที่ต้องการคำนวณ",
    };
  }

  await recalculateAndSaveCompensation(scheduleVersionId);
  revalidatePath("/schedule-rounds");
  revalidatePath("/home/schedule-rounds");
  revalidatePath("/home/my-schedule");

  return {
    ok: true,
    message: "คำนวณค่าตอบแทนใหม่สำเร็จ",
  };
}
