"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type CreateScheduleRoundResult =
  | {
      status: "success";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

const createScheduleRoundSchema = z
  .object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2400).max(3000),
    requestOpenDate: z.string().min(1, "กรุณาเลือกวันที่เปิดรับคำขอ"),
    requestCloseDate: z.string().min(1, "กรุณาเลือกวันที่ปิดรับคำขอ"),
    dataLockDate: z.string().min(1, "กรุณาเลือกวันที่ล็อกข้อมูล"),
    autoGenerateAt: z.string().min(1, "กรุณาเลือกวันที่เริ่มจัดตารางด้วย GA"),
  })
  .superRefine((data, context) => {
    const requestOpenDate = parseDateInput(data.requestOpenDate);
    const requestCloseDate = parseDateInput(data.requestCloseDate);
    const dataLockDate = parseDateInput(data.dataLockDate);
    const autoGenerateAt = parseDateTimeInput(data.autoGenerateAt);

    if (!requestOpenDate) {
      context.addIssue({
        code: "custom",
        message: "วันที่เปิดรับคำขอไม่ถูกต้อง",
        path: ["requestOpenDate"],
      });
    }

    if (!requestCloseDate) {
      context.addIssue({
        code: "custom",
        message: "วันที่ปิดรับคำขอไม่ถูกต้อง",
        path: ["requestCloseDate"],
      });
    }

    if (!dataLockDate) {
      context.addIssue({
        code: "custom",
        message: "วันที่ล็อกข้อมูลไม่ถูกต้อง",
        path: ["dataLockDate"],
      });
    }

    if (!autoGenerateAt) {
      context.addIssue({
        code: "custom",
        message: "วันที่เริ่มจัดตารางด้วย GA ไม่ถูกต้อง",
        path: ["autoGenerateAt"],
      });
    }

    if (!requestOpenDate || !requestCloseDate || !dataLockDate || !autoGenerateAt) {
      return;
    }

    if (requestOpenDate > requestCloseDate) {
      context.addIssue({
        code: "custom",
        message: "วันที่เปิดรับคำขอต้องไม่เกินวันที่ปิดรับคำขอ",
        path: ["requestOpenDate"],
      });
    }

    if (requestCloseDate > dataLockDate) {
      context.addIssue({
        code: "custom",
        message: "วันที่ปิดรับคำขอต้องไม่เกินวันที่ล็อกข้อมูล",
        path: ["requestCloseDate"],
      });
    }

    if (dataLockDate > autoGenerateAt) {
      context.addIssue({
        code: "custom",
        message: "วันที่ล็อกข้อมูลต้องไม่เกินวันที่เริ่มจัดตารางด้วย GA",
        path: ["dataLockDate"],
      });
    }
  });

export async function createScheduleRoundAction(
  input: unknown,
): Promise<CreateScheduleRoundResult> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      status: "error",
      message: "บัญชีนี้ไม่มีสิทธิ์สร้างรอบจัดตาราง",
    };
  }

  const parsed = createScheduleRoundSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลรอบจัดตารางไม่ถูกต้อง",
    };
  }

  const data = parsed.data;
  const requestOpenDate = parseDateInput(data.requestOpenDate);
  const requestCloseDate = parseDateInput(data.requestCloseDate);
  const dataLockDate = parseDateInput(data.dataLockDate);
  const autoGenerateAt = parseDateTimeInput(data.autoGenerateAt);

  if (!requestOpenDate || !requestCloseDate || !dataLockDate || !autoGenerateAt) {
    return {
      status: "error",
      message: "ข้อมูลวันที่ไม่ถูกต้อง",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const wards = await tx.ward.findMany({
        select: {
          id: true,
        },
      });

      if (wards.length === 0) {
        throw new Error("ยังไม่มีวอร์ดในระบบ");
      }

      const duplicateCycle = await tx.scheduleCycle.findUnique({
        where: {
          year_month: {
            year: data.year,
            month: data.month,
          },
        },
      });

      if (duplicateCycle) {
        throw new Error("มีรอบจัดตารางของเดือนนี้อยู่แล้ว");
      }

      const cycle = await tx.scheduleCycle.create({
        data: {
          year: data.year,
          month: data.month,
          status: "preparing",
          requestOpenDate,
          requestCloseDate,
          dataLockDate,
          autoGenerateAt,
        },
      });

      await tx.wardCyclePreparation.createMany({
        data: wards.map((ward) => ({
          cycleId: cycle.id,
          wardId: ward.id,
          status: "draft",
        })),
      });
    });

    revalidatePath("/schedule-rounds");
    revalidatePath("/home/schedule-rounds");

    return {
      status: "success",
      message: "สร้างรอบจัดตารางสำเร็จ",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "ไม่สามารถสร้างรอบจัดตารางได้",
    };
  }
}

function parseDateInput(value: string) {
  const date = new Date(`${value}T00:00:00+07:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTimeInput(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
