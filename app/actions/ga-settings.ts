"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import {
  activateGaSettingsProfile,
  saveGaSettingsData,
} from "@/lib/schedule-rounds/ga-settings";
import { MAX_CONSECUTIVE_NIGHTS } from "@/lib/ga-input/constants";

export type SaveGaSettingsResult =
  | {
      status: "success";
      message: string;
      profileKey?: string;
    }
  | {
      status: "error";
      message: string;
    };

const gaSettingsSchema = z.object({
  profileKey: z.string().trim().optional().default(""),
  saveAsNew: z.coerce.boolean().optional().default(false),
  profileName: z.string().trim().min(1, "กรุณาระบุชื่อชุดค่า"),
  populationSize: z.coerce.number().int().min(20).max(2000),
  generations: z.coerce.number().int().min(1).max(10000),
  patience: z.coerce.number().int().min(1).max(1000),
  eliteSize: z.coerce.number().int().min(1).max(200),
  tournamentSize: z.coerce.number().int().min(2).max(100),
  crossoverRate: z.coerce.number().min(0).max(1),
  mutationRate: z.coerce.number().min(0).max(1),
  fullRepairEvery: z.coerce.number().int().min(1).max(1000),
  repairEliteEvery: z.coerce.number().int().min(1).max(1000),
  randomSeed: z.preprocess(
    emptyStringToNull,
    z.number().int().nullable(),
  ),
  maxSeconds: z.coerce.number().int().min(1).max(86400),
  maxShiftsPer7Days: z.coerce.number().int().min(1).max(14),
  weeklyMinDaysOff: z.preprocess(() => 1, z.number().int()).default(1),
  maxConsecutiveNights: z.preprocess(
    () => MAX_CONSECUTIVE_NIGHTS,
    z.number().int(),
  ),
  maxConsecutiveWorkDays: z.coerce.number().int().min(1).max(31),
  maxTraineePerShift: z.coerce.number().int().min(0).max(20),
  minRestHours: z.coerce.number().int().min(0).max(24),
  targetOffDaysPerStaff: z.preprocess(
    () => null,
    z.number().int().min(0).max(31).nullable(),
  ).optional(),
  enableMorningEveningDouble: z.preprocess(() => true, z.boolean()).optional(),
  enableNightEveningDouble: z.preprocess(() => true, z.boolean()).optional(),
  preferMorningOt: z.preprocess(() => true, z.boolean()).optional(),
  morningRegularRequired: z.preprocess(() => true, z.boolean()).optional(),
});

function emptyStringToNull(value: unknown) {
  if (value === "" || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : Number(trimmed);
  }

  return value;
}

export async function saveGaSettingsAction(input: unknown): Promise<SaveGaSettingsResult> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      status: "error",
      message: "บัญชีนี้ไม่มีสิทธิ์แก้ไขการตั้งค่า GA",
    };
  }

  const parsed = gaSettingsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลตั้งค่า GA ไม่ถูกต้อง",
    };
  }

  if (parsed.data.eliteSize >= parsed.data.populationSize) {
    return {
      status: "error",
      message: "Elite Size ต้องน้อยกว่า Population Size",
    };
  }

  if (parsed.data.tournamentSize > parsed.data.populationSize) {
    return {
      status: "error",
      message: "Tournament Size ต้องไม่มากกว่า Population Size",
    };
  }

  try {
    const { saveAsNew, ...settingsData } = parsed.data;
    const profileKey =
      saveAsNew || settingsData.profileKey.length === 0
        ? createGaSettingsProfileKey(settingsData.profileName)
        : settingsData.profileKey;

    await saveGaSettingsData(
      {
        ...settingsData,
        profileKey,
        targetOffDaysPerStaff: null,
        enableMorningEveningDouble: true,
        enableNightEveningDouble: true,
        preferMorningOt: true,
        morningRegularRequired: true,
      },
      session.userId,
    );

    revalidatePath("/home/schedule-rounds");
    revalidatePath("/schedule-rounds");

    return {
      status: "success",
      message: "บันทึกการตั้งค่า GA สำเร็จ",
      profileKey,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "ไม่สามารถบันทึกการตั้งค่า GA ได้",
    };
  }
}

function createGaSettingsProfileKey(profileName: string) {
  const slug = profileName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return `${slug || "ga-profile"}-${Date.now().toString(36)}`;
}

export async function activateGaSettingsProfileAction(
  profileKey: string,
): Promise<SaveGaSettingsResult> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      status: "error",
      message: "บัญชีนี้ไม่มีสิทธิ์แก้ไขการตั้งค่า GA",
    };
  }

  const parsedProfileKey = z.string().trim().min(1).safeParse(profileKey);

  if (!parsedProfileKey.success) {
    return {
      status: "error",
      message: "ไม่พบชุดค่า GA ที่ต้องการใช้งาน",
    };
  }

  try {
    await activateGaSettingsProfile(parsedProfileKey.data);

    revalidatePath("/home/schedule-rounds");
    revalidatePath("/schedule-rounds");

    return {
      status: "success",
      message: "เปลี่ยนชุดค่า GA ที่ใช้งานแล้ว",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "ไม่สามารถเปลี่ยนชุดค่า GA ที่ใช้งานได้",
    };
  }
}
