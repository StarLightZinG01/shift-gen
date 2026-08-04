"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { saveScheduleManagementData } from "@/lib/schedule-management/save";

type StaffRowType = "home" | "new" | "external";
export type ScheduleManagementActionState = {
  ok: boolean | null;
  message: string;
  submittedAt: number;
};

const staffingRequirementSchema = z
  .object({
    cycleId: z.string().uuid("ไม่พบรอบจัดตารางที่ถูกต้อง"),
    wardId: z.string().uuid("ไม่พบวอร์ดที่ถูกต้อง"),
    morningMin: z.coerce.number().int().min(0),
    morningMax: z.coerce.number().int().min(0),
    afternoonMin: z.coerce.number().int().min(0),
    afternoonMax: z.coerce.number().int().min(0),
    nightMin: z.coerce.number().int().min(0),
    nightMax: z.coerce.number().int().min(0),
  })
  .refine((data) => data.morningMin <= data.morningMax, {
    message: "กำลังคนเวรเช้าต้องมีขั้นต่ำไม่เกินสูงสุด",
    path: ["morningMin"],
  })
  .refine((data) => data.afternoonMin <= data.afternoonMax, {
    message: "กำลังคนเวรบ่ายต้องมีขั้นต่ำไม่เกินสูงสุด",
    path: ["afternoonMin"],
  })
  .refine((data) => data.nightMin <= data.nightMax, {
    message: "กำลังคนเวรดึกต้องมีขั้นต่ำไม่เกินสูงสุด",
    path: ["nightMin"],
  });

export async function saveScheduleManagementAction(
  _prevState: ScheduleManagementActionState,
  formData: FormData,
): Promise<ScheduleManagementActionState> {
  try {
    const session = await getCurrentSession();

    if (!session) {
      throw new Error("กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูล");
    }

    const parsed = staffingRequirementSchema.safeParse({
      cycleId: formData.get("cycleId"),
      wardId: formData.get("wardId"),
      morningMin: formData.get("morningMin"),
      morningMax: formData.get("morningMax"),
      afternoonMin: formData.get("afternoonMin"),
      afternoonMax: formData.get("afternoonMax"),
      nightMin: formData.get("nightMin"),
      nightMax: formData.get("nightMax"),
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "ข้อมูลกำลังคนไม่ถูกต้อง");
    }

    const isAdmin = session.roles.includes("admin");

    if (!isAdmin && session.homeWardId !== parsed.data.wardId) {
      throw new Error("บัญชีนี้ไม่มีสิทธิ์บันทึกข้อมูลของวอร์ดนี้");
    }

    await saveScheduleManagementData({
      cycleId: parsed.data.cycleId,
      wardId: parsed.data.wardId,
      userId: session.userId,
      staffRows: parseStaffRows(formData),
      staffingRequirements: {
        morning: {
          min: parsed.data.morningMin,
          max: parsed.data.morningMax,
        },
        afternoon: {
          min: parsed.data.afternoonMin,
          max: parsed.data.afternoonMax,
        },
        night: {
          min: parsed.data.nightMin,
          max: parsed.data.nightMax,
        },
      },
    });

    revalidatePath("/home/schedule-management");
    revalidatePath("/home/schedule-rounds");
    revalidatePath("/schedule-rounds");
    revalidatePath(`/home/schedule-rounds/wards/${parsed.data.wardId}`);

    return {
      ok: true,
      message: "บันทึกข้อมูลวอร์ดสำเร็จ",
      submittedAt: Date.now(),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ",
      submittedAt: Date.now(),
    };
  }
}

function parseStaffRows(formData: FormData) {
  return formData.getAll("staffRowKey").map((rawRowKey) => {
    const rowKey = String(rawRowKey);
    const rowType = getStaffRowType(formData, rowKey);
    const staffId = getOptionalString(formData, `staff.${rowKey}.staffId`);
    const code = getRequiredString(formData, `staff.${rowKey}.code`, "กรุณากรอกรหัสบุคลากรให้ครบ");
    const fullName = getRequiredString(
      formData,
      `staff.${rowKey}.fullName`,
      "กรุณากรอกชื่อบุคลากรให้ครบ",
    );
    const payPosition = getRequiredString(
      formData,
      `staff.${rowKey}.payPosition`,
      "กรุณากรอกตำแหน่งเบิกจ่ายให้ครบ",
    );
    const otRate = getRequiredNumber(
      formData,
      `staff.${rowKey}.otRate`,
      "กรุณากรอกค่า OT เป็นตัวเลข",
    );
    const shiftPayRate = getRequiredNumber(
      formData,
      `staff.${rowKey}.shiftPayRate`,
      "กรุณากรอกค่าเวรเป็นตัวเลข",
    );

    return {
      rowKey,
      rowType,
      staffId,
      code,
      fullName,
      homeWard: getOptionalString(formData, `staff.${rowKey}.homeWard`) ?? "",
      payPosition,
      otRate,
      shiftPayRate,
      isHead: getBoolean(formData, `staff.${rowKey}.isHead`),
      isTrainee: getBoolean(formData, `staff.${rowKey}.isTrainee`),
      off: getOptionalString(formData, `staff.${rowKey}.off`) ?? "0",
      vacation: getOptionalString(formData, `staff.${rowKey}.vacation`) ?? "0",
      leave: getOptionalString(formData, `staff.${rowKey}.leave`) ?? "0",
      academic: getOptionalString(formData, `staff.${rowKey}.academic`) ?? "0",
      preferredShifts:
        getOptionalString(formData, `staff.${rowKey}.preferredShifts`) ?? "0",
    };
  });
}

function getStaffRowType(formData: FormData, rowKey: string): StaffRowType {
  const rowType = String(formData.get(`staff.${rowKey}.rowType`) ?? "");

  if (rowType === "home" || rowType === "new" || rowType === "external") {
    return rowType;
  }

  throw new Error("ประเภทข้อมูลบุคลากรไม่ถูกต้อง");
}

function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value || null;
}

function getBoolean(formData: FormData, key: string) {
  return String(formData.get(key) ?? "") === "true";
}

function getRequiredString(formData: FormData, key: string, message: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(message);
  }

  return value;
}

function getRequiredNumber(formData: FormData, key: string, message: string) {
  const rawValue = String(formData.get(key) ?? "").trim();
  const value = Number(rawValue);

  if (!rawValue || !Number.isFinite(value) || value < 0) {
    throw new Error(message);
  }

  return value;
}
