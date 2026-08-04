"use server";

import { randomUUID } from "crypto";
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

export type ScheduleRoundActionResult = CreateScheduleRoundResult;

const createWardSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "กรุณากรอกรหัสวอร์ด")
    .max(50, "รหัสวอร์ดยาวเกินไป"),
  name: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อวอร์ด")
    .max(120, "ชื่อวอร์ดยาวเกินไป"),
});

const createScheduleRoundSchema = z
  .object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2400).max(3000),
    requestOpenDate: z.string().min(1, "กรุณาเลือกวันที่เปิดรับคำขอ"),
    requestCloseDate: z.string().min(1, "กรุณาเลือกวันที่ปิดรับคำขอ"),
    dataLockDate: z.string().min(1, "กรุณาเลือกวันที่ล็อกข้อมูล"),
    autoGenerateAt: z.string().min(1, "กรุณาเลือกวันที่เริ่มจัดตารางด้วย GA"),
    holidayDates: z.array(z.string()).optional().default([]),
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

export async function createWardAction(
  input: unknown,
): Promise<ScheduleRoundActionResult> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      status: "error",
      message: "บัญชีนี้ไม่มีสิทธิ์สร้างวอร์ด",
    };
  }

  const parsed = createWardSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลวอร์ดไม่ถูกต้อง",
    };
  }

  const code = parsed.data.code;
  const name = parsed.data.name;

  try {
    await prisma.$transaction(async (tx) => {
      const existingWard = await tx.ward.findFirst({
        where: {
          code: {
            equals: code,
            mode: "insensitive",
          },
        },
      });

      if (existingWard) {
        throw new Error("มีรหัสวอร์ดนี้อยู่ในระบบแล้ว");
      }

      const ward = await tx.ward.create({
        data: {
          code,
          name,
        },
      });

      const activeCycles = await tx.scheduleCycle.findMany({
        where: {
          status: {
            in: ["preparing", "open", "locked", "generating"],
          },
        },
        select: {
          id: true,
        },
      });

      if (activeCycles.length > 0) {
        await tx.wardCyclePreparation.createMany({
          data: activeCycles.map((cycle) => ({
            cycleId: cycle.id,
            wardId: ward.id,
            status: "draft",
          })),
          skipDuplicates: true,
        });
      }
    });

    revalidateScheduleRoundPaths();

    return {
      status: "success",
      message: "เพิ่มวอร์ดสำเร็จ",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "ไม่สามารถเพิ่มวอร์ดได้",
    };
  }
}

export async function deleteWardAction(
  wardId: string,
): Promise<ScheduleRoundActionResult> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      status: "error",
      message: "บัญชีนี้ไม่มีสิทธิ์ลบวอร์ด",
    };
  }

  const parsedWardId = z.string().uuid().safeParse(wardId);

  if (!parsedWardId.success) {
    return {
      status: "error",
      message: "ไม่พบวอร์ดที่ถูกต้อง",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const ward = await tx.ward.findUnique({
        where: {
          id: parsedWardId.data,
        },
        select: {
          id: true,
          code: true,
          _count: {
            select: {
              staff: true,
              assignments: true,
              compensationSummaries: true,
            },
          },
        },
      });

      if (!ward) {
        throw new Error("ไม่พบวอร์ดนี้ในระบบ");
      }

      if (ward._count.staff > 0) {
        throw new Error("ลบวอร์ดไม่ได้ เพราะยังมีบุคลากรอยู่ในวอร์ดนี้");
      }

      if (ward._count.assignments > 0 || ward._count.compensationSummaries > 0) {
        throw new Error("ลบวอร์ดไม่ได้ เพราะมีประวัติตารางเวรหรือค่าตอบแทนผูกอยู่");
      }

      await tx.ward.delete({
        where: {
          id: ward.id,
        },
      });
    });

    revalidateScheduleRoundPaths();

    return {
      status: "success",
      message: "ลบวอร์ดสำเร็จ",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "ไม่สามารถลบวอร์ดได้",
    };
  }
}

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
    const holidayDates = parseHolidayDates(data.holidayDates, data.year, data.month);

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

      await replaceCycleHolidays(tx, cycle.id, holidayDates);
    });

    revalidateScheduleRoundPaths();

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

const updateScheduleRoundSchema = createScheduleRoundSchema.extend({
  cycleId: z.string().uuid("ไม่พบรอบจัดตารางที่ถูกต้อง"),
});

export async function updateScheduleRoundAction(
  input: unknown,
): Promise<ScheduleRoundActionResult> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      status: "error",
      message: "บัญชีนี้ไม่มีสิทธิ์แก้ไขรอบจัดตาราง",
    };
  }

  const parsed = updateScheduleRoundSchema.safeParse(input);

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
    const holidayDates = parseHolidayDates(data.holidayDates, data.year, data.month);

    await prisma.$transaction(async (tx) => {
      const duplicateCycle = await tx.scheduleCycle.findFirst({
        where: {
          year: data.year,
          month: data.month,
          id: {
            not: data.cycleId,
          },
        },
      });

      if (duplicateCycle) {
        throw new Error("มีรอบจัดตารางของเดือนนี้อยู่แล้ว");
      }

      await tx.scheduleCycle.update({
        where: {
          id: data.cycleId,
        },
        data: {
          year: data.year,
          month: data.month,
          requestOpenDate,
          requestCloseDate,
          dataLockDate,
          autoGenerateAt,
        },
      });

      await replaceCycleHolidays(tx, data.cycleId, holidayDates);
    });

    revalidateScheduleRoundPaths();

    return {
      status: "success",
      message: "บันทึกรอบจัดตารางสำเร็จ",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "ไม่สามารถบันทึกรอบจัดตารางได้",
    };
  }
}

export async function deleteScheduleRoundAction(
  cycleId: string,
): Promise<ScheduleRoundActionResult> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      status: "error",
      message: "บัญชีนี้ไม่มีสิทธิ์ลบรอบจัดตาราง",
    };
  }

  const parsedCycleId = z.string().uuid().safeParse(cycleId);

  if (!parsedCycleId.success) {
    return {
      status: "error",
      message: "ไม่พบรอบจัดตารางที่ถูกต้อง",
    };
  }

  try {
    await prisma.scheduleCycle.delete({
      where: {
        id: parsedCycleId.data,
      },
    });

    revalidateScheduleRoundPaths();

    return {
      status: "success",
      message: "ลบรอบจัดตารางสำเร็จ",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "ไม่สามารถลบรอบจัดตารางได้",
    };
  }
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTimeInput(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function replaceCycleHolidays(
  tx: TransactionClient,
  cycleId: string,
  holidayDates: Date[],
) {
  await tx.$executeRaw`
    DELETE FROM schedule_cycle_holidays
    WHERE cycle_id = ${cycleId}::uuid
  `;

  for (const holidayDate of holidayDates) {
    await tx.$executeRaw`
      INSERT INTO schedule_cycle_holidays (id, cycle_id, holiday_date)
      VALUES (${randomUUID()}::uuid, ${cycleId}::uuid, ${holidayDate})
      ON CONFLICT (cycle_id, holiday_date) DO NOTHING
    `;
  }
}

function parseHolidayDates(values: string[], year: number, month: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .map((value) => {
      const date = parseDateInput(value);

      if (!date) {
        throw new Error("วันที่หยุดนักขัตฤกษ์ไม่ถูกต้อง");
      }

      const calendarYear = year > 2400 ? year - 543 : year;
      if (date.getUTCFullYear() !== calendarYear || date.getUTCMonth() + 1 !== month) {
        throw new Error("วันหยุดนักขัตฤกษ์ต้องอยู่ในเดือนของรอบจัดตาราง");
      }

      return date;
    })
    .sort((a, b) => a.getTime() - b.getTime());
}

function revalidateScheduleRoundPaths() {
  revalidatePath("/schedule-rounds");
  revalidatePath("/home/schedule-rounds");
  revalidatePath("/home/schedule-management");
}
