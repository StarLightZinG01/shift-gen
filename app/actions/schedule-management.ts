"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/prisma";
import { saveScheduleManagementData } from "@/lib/schedule-management/save";
import { isCycleDataLocked } from "@/lib/schedule-rounds/cycle-status";
import {
  SPECIAL_RULE_DEFINITIONS,
  type SpecialRuleSetting,
} from "@/lib/schedule-management/special-rules";

type StaffRowType = "home" | "new" | "external";
export type ScheduleManagementActionState = {
  ok: boolean | null;
  message: string;
  submittedAt: number;
};

const shiftRequirementSchema = z
  .object({
    min: z.coerce.number().int().min(0),
    max: z.coerce.number().int().min(0),
    rnRequired: z.coerce.number().int().min(0),
    pnNaRequired: z.coerce.number().int().min(0),
    requiresIncharge: z.boolean(),
  })
  .refine((data) => data.min <= data.max, {
    message: "กำลังคนขั้นต่ำต้องไม่เกินจำนวนสูงสุด",
    path: ["min"],
  });

const staffingRequirementSchema = z.object({
  cycleId: z.string().uuid("ไม่พบรอบจัดตารางที่ถูกต้อง"),
  wardId: z.string().uuid("ไม่พบวอร์ดที่ถูกต้อง"),
  morning: shiftRequirementSchema,
  afternoon: shiftRequirementSchema,
  night: shiftRequirementSchema,
  holidayMorning: shiftRequirementSchema,
  holidayAfternoon: shiftRequirementSchema,
  holidayNight: shiftRequirementSchema,
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
      morning: parseShiftRequirement(formData, "morning"),
      afternoon: parseShiftRequirement(formData, "afternoon"),
      night: parseShiftRequirement(formData, "night"),
      holidayMorning: parseShiftRequirement(formData, "holidayMorning"),
      holidayAfternoon: parseShiftRequirement(formData, "holidayAfternoon"),
      holidayNight: parseShiftRequirement(formData, "holidayNight"),
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "ข้อมูลกำลังคนไม่ถูกต้อง");
    }

    const isAdmin = session.roles.includes("admin");
    const isWardHead = session.roles.includes("ward_head");

    if (
      !isAdmin &&
      (!isWardHead || session.homeWardId !== parsed.data.wardId)
    ) {
      throw new Error("บัญชีนี้ไม่มีสิทธิ์บันทึกข้อมูลของวอร์ดนี้");
    }

    const cycle = await prisma.scheduleCycle.findUnique({
      where: { id: parsed.data.cycleId },
      select: {
        status: true,
        requestOpenDate: true,
        dataLockDate: true,
      },
    });

    if (!cycle) {
      throw new Error("ไม่พบรอบจัดตารางที่ต้องการบันทึก");
    }

    if (isCycleDataLocked(cycle)) {
      throw new Error("รอบจัดตารางนี้ล็อกข้อมูลแล้ว ไม่สามารถแก้ไขได้");
    }

    await saveScheduleManagementData({
      cycleId: parsed.data.cycleId,
      wardId: parsed.data.wardId,
      userId: session.userId,
      staffRows: parseStaffRows(formData),
      staffingRequirements: {
        morning: parsed.data.morning,
        afternoon: parsed.data.afternoon,
        night: parsed.data.night,
        holidayMorning: parsed.data.holidayMorning,
        holidayAfternoon: parsed.data.holidayAfternoon,
        holidayNight: parsed.data.holidayNight,
      },
      specialRuleSettings: parseSpecialRuleSettings(formData),
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

function parseSpecialRuleSettings(formData: FormData): SpecialRuleSetting[] {
  return SPECIAL_RULE_DEFINITIONS.map((definition) => {
    const enabled =
      formData.get(`specialRule.${definition.ruleKey}.enabled`) === "true";
    const parameters = Object.fromEntries(
      definition.parameterFields.map((field) => {
        const raw = formData.get(
          `specialRule.${definition.ruleKey}.${field.key}`,
        );
        const value = raw === null ? definition.defaults[field.key] : Number(raw);

        if (!Number.isFinite(value) || value < field.min) {
          throw new Error(`${field.label} ต้องไม่น้อยกว่า ${field.min}`);
        }

        return [field.key, Math.trunc(value)];
      }),
    );

    return { ruleKey: definition.ruleKey, enabled, parameters };
  });
}

function parseShiftRequirement(formData: FormData, prefix: string) {
  const rnRequired = formData.get(`${prefix}RnRequired`);
  const pnNaRequired = formData.get(`${prefix}PnNaRequired`);
  const requiredStaff = Number(rnRequired) + Number(pnNaRequired);
  return {
    min: requiredStaff,
    max: requiredStaff,
    rnRequired,
    pnNaRequired,
    requiresIncharge: formData.get(`${prefix}RequiresIncharge`) === "true",
  };
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
      staffCategory: getStaffCategory(formData, `staff.${rowKey}.staffCategory`),
      isNewNurse: getBoolean(formData, `staff.${rowKey}.isNewNurse`),
      isTrainee: getBoolean(formData, `staff.${rowKey}.isNewNurse`),
      canBeInCharge: getBoolean(formData, `staff.${rowKey}.canBeInCharge`),
      off: getOptionalString(formData, `staff.${rowKey}.off`) ?? "0",
      vacation: getOptionalString(formData, `staff.${rowKey}.vacation`) ?? "0",
      leave: getOptionalString(formData, `staff.${rowKey}.leave`) ?? "0",
      academic: getOptionalString(formData, `staff.${rowKey}.academic`) ?? "0",
      preferredShifts:
        getOptionalString(formData, `staff.${rowKey}.preferredShifts`) ?? "0",
    };
  });
}

function getStaffCategory(
  formData: FormData,
  key: string,
): "RN" | "PN" | "NA" | "OTHER" {
  const value = getOptionalString(formData, key);
  return value === "RN" || value === "PN" || value === "NA" ? value : "OTHER";
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
