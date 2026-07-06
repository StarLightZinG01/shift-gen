"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type SaveLeaveRequestsResult =
  | {
      status: "success";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

const saveLeaveRequestsSchema = z.object({
  cycleId: z.string().uuid("ไม่พบรอบจัดตารางที่ถูกต้อง"),
  wardId: z.string().uuid("ไม่พบวอร์ดที่ถูกต้อง"),
  requests: z
    .array(
      z.object({
        date: z.coerce.number().int().min(1).max(31),
        type: z.enum(["Off", "V", "ว", "ล"]),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .min(1, "กรุณาเลือกวันที่ต้องการส่งคำขอ"),
});

export async function saveLeaveRequestsAction(
  input: unknown,
): Promise<SaveLeaveRequestsResult> {
  const session = await getCurrentSession();

  if (!session) {
    return {
      status: "error",
      message: "กรุณาเข้าสู่ระบบก่อนส่งคำขอ",
    };
  }

  if (!session.staffId) {
    return {
      status: "error",
      message: "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลบุคลากร",
    };
  }

  const parsed = saveLeaveRequestsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลคำขอไม่ถูกต้อง",
    };
  }

  const { cycleId, wardId, requests } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const [cycle, staff] = await Promise.all([
        tx.scheduleCycle.findUnique({
          where: {
            id: cycleId,
          },
        }),
        tx.staff.findUnique({
          where: {
            id: session.staffId ?? "",
          },
          include: {
            wardPermissions: true,
          },
        }),
      ]);

      if (!cycle) {
        throw new Error("ไม่พบรอบจัดตารางที่ต้องการส่งคำขอ");
      }

      if (!staff) {
        throw new Error("ไม่พบข้อมูลบุคลากรของบัญชีนี้");
      }

      const canWorkWard =
        staff.homeWardId === wardId ||
        staff.wardPermissions.some((permission) => permission.wardId === wardId);

      if (!canWorkWard) {
        throw new Error("บัญชีนี้ไม่มีสิทธิ์ส่งคำขอสำหรับวอร์ดนี้");
      }

      const calendarYear = cycle.year > 2400 ? cycle.year - 543 : cycle.year;
      const daysInMonth = new Date(calendarYear, cycle.month, 0).getDate();

      for (const request of requests) {
        if (request.date > daysInMonth) {
          throw new Error("วันที่ที่เลือกไม่อยู่ในเดือนของรอบจัดตาราง");
        }
      }

      await tx.availabilityRequest.deleteMany({
        where: {
          cycleId,
          staffId: staff.id,
        },
      });

      await tx.availabilityRequest.createMany({
        data: requests.map((request) => ({
          cycleId,
          staffId: staff.id,
          requestDate: new Date(calendarYear, cycle.month - 1, request.date),
          requestType: request.type,
          reason: request.reason?.trim() || null,
          status: "submitted",
        })),
      });
    });

    revalidatePath("/home/leave-requests");
    revalidatePath("/home/schedule-management");
    revalidatePath("/home/schedule-rounds");

    return {
      status: "success",
      message: "ส่งคำขอสำเร็จ",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "ไม่สามารถส่งคำขอได้",
    };
  }
}
