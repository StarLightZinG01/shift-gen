"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";

import { getCurrentSession } from "@/lib/auth/session";
import { buildGaInput } from "@/lib/ga-input/build-ga-input";
import type { GaInput } from "@/lib/ga-input/types";
import { validateGaInput } from "@/lib/ga-input/validators";
import { activeGaRunStatuses } from "@/lib/ga-runs/queries";
import { buildGaRunReadiness } from "@/lib/ga-runs/validation";
import { prisma } from "@/lib/prisma";

export type StartGaRunActionResult =
  | {
      status: "success";
      message: string;
      gaRunId: string;
    }
  | {
      status: "error";
      message: string;
      errors?: string[];
      warnings?: string[];
    };

export type CancelGaRunActionResult =
  | {
      status: "success";
      message: string;
      cancelledCount: number;
    }
  | {
      status: "error";
      message: string;
    };

const startGaRunSchema = z.union([
  z.string().uuid("ไม่พบรอบจัดตารางที่ถูกต้อง"),
  z.object({
    cycleId: z.string().uuid("ไม่พบรอบจัดตารางที่ถูกต้อง"),
    targetWardId: z.string().uuid("ไม่พบวอร์ดที่ถูกต้อง").nullable().optional(),
    targetWardIds: z.array(z.string().uuid("ไม่พบวอร์ดที่ถูกต้อง")).nullable().optional(),
  }),
]);
const cancelGaRunSchema = z.string().uuid("ไม่พบรอบจัดตารางที่ถูกต้อง");

export async function startGaRunAction(
  input:
    | string
    | {
        cycleId: string;
        targetWardId?: string | null;
        targetWardIds?: string[] | null;
      },
): Promise<StartGaRunActionResult> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      status: "error",
      message: "บัญชีนี้ไม่มีสิทธิ์เริ่มจัดตารางด้วย GA",
    };
  }

  const parsedInput = startGaRunSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      status: "error",
      message: parsedInput.error.issues[0]?.message ?? "รอบจัดตารางไม่ถูกต้อง",
    };
  }

  const parsedData =
    typeof parsedInput.data === "string"
      ? {
          cycleId: parsedInput.data,
          targetWardIds: null,
        }
      : {
          cycleId: parsedInput.data.cycleId,
          targetWardIds: normalizeTargetWardIds(
            parsedInput.data.targetWardIds ??
              (parsedInput.data.targetWardId ? [parsedInput.data.targetWardId] : null),
          ),
        };

  const cycle = await prisma.scheduleCycle.findUnique({
    where: {
      id: parsedData.cycleId,
    },
    select: {
      id: true,
      month: true,
      year: true,
    },
  });

  if (!cycle) {
    return {
      status: "error",
      message: "ไม่พบรอบจัดตารางนี้",
    };
  }

  const activeRun = await prisma.gaRun.findFirst({
    where: {
      cycleId: cycle.id,
      status: {
        in: activeGaRunStatuses,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (activeRun) {
    return {
      status: "error",
      message: "รอบนี้มีงาน GA ที่รอรันหรือกำลังรันอยู่แล้ว",
    };
  }

  try {
    const fullGaInput = await buildGaInput(cycle.id);
    const gaInput = parsedData.targetWardIds
      ? filterGaInputByWards(fullGaInput, parsedData.targetWardIds)
      : fullGaInput;
    const readiness = buildGaRunReadiness(gaInput);

    if (!readiness.ok) {
      return {
        status: "error",
        message: "ข้อมูลรอบนี้ยังไม่พร้อมจัดตารางด้วย GA",
        errors: readiness.errors,
        warnings: readiness.warnings,
      };
    }

    const gaRun = await prisma.gaRun.create({
      data: {
        cycleId: cycle.id,
        status: "queued",
        inputSnapshot: gaInput as unknown as Prisma.InputJsonValue,
        settingsSnapshot: buildSettingsSnapshot(
          gaInput,
          readiness,
          parsedData.targetWardIds,
        ) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    revalidateGaRunPaths();

    return {
      status: "success",
      message: parsedData.targetWardIds
        ? `สร้างงาน GA สำหรับ ${parsedData.targetWardIds.length} วอร์ดที่เลือกแล้ว ระบบจะรอ worker มารับงานไปจัดตาราง`
        : "สร้างงาน GA แล้ว ระบบจะรอ worker มารับงานไปจัดตาราง",
      gaRunId: gaRun.id,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "ไม่สามารถเริ่มจัดตารางด้วย GA ได้",
    };
  }
}

export async function cancelActiveGaRunAction(
  cycleId: string,
): Promise<CancelGaRunActionResult> {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    return {
      status: "error",
      message: "บัญชีนี้ไม่มีสิทธิ์ยกเลิกงาน GA",
    };
  }

  const parsedCycleId = cancelGaRunSchema.safeParse(cycleId);

  if (!parsedCycleId.success) {
    return {
      status: "error",
      message:
        parsedCycleId.error.issues[0]?.message ??
        "รอบจัดตารางไม่ถูกต้อง",
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const activeRuns = await tx.gaRun.findMany({
        where: {
          cycleId: parsedCycleId.data,
          status: {
            in: activeGaRunStatuses,
          },
        },
        select: {
          id: true,
          settingsSnapshot: true,
        },
      });

      if (activeRuns.length === 0) {
        return {
          cancelledCount: 0,
        };
      }

      for (const run of activeRuns) {
        const settings =
          run.settingsSnapshot &&
          typeof run.settingsSnapshot === "object" &&
          !Array.isArray(run.settingsSnapshot)
            ? { ...run.settingsSnapshot }
            : {};

        await tx.gaRun.update({
          where: {
            id: run.id,
          },
          data: {
            status: "failed",
            finishedAt: new Date(),
            settingsSnapshot: {
              ...settings,
              worker_error: {
                message: "ยกเลิกงาน GA โดยผู้ดูแลระบบ",
                code: "cancelled_by_admin",
                cancelledAt: new Date().toISOString(),
              },
            } as Prisma.InputJsonValue,
          },
        });
      }

      await tx.scheduleCycle.updateMany({
        where: {
          id: parsedCycleId.data,
          status: "generating",
        },
        data: {
          status: "locked",
        },
      });

      return {
        cancelledCount: activeRuns.length,
      };
    });

    if (result.cancelledCount === 0) {
      return {
        status: "error",
        message: "ไม่พบงาน GA ที่กำลังรันหรือรอรันอยู่",
      };
    }

    revalidateGaRunPaths();

    return {
      status: "success",
      message: `ยกเลิกงาน GA แล้ว ${result.cancelledCount} งาน สามารถส่งข้อมูลให้ GA ใหม่ได้`,
      cancelledCount: result.cancelledCount,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "ไม่สามารถยกเลิกงาน GA ได้",
    };
  }
}

function normalizeTargetWardIds(value: string[] | null | undefined) {
  if (!value) {
    return null;
  }

  const wardIds = Array.from(new Set(value.filter(Boolean)));

  if (wardIds.length === 0) {
    throw new Error("กรุณาเลือกวอร์ดที่ต้องการส่งให้ GA");
  }

  return wardIds;
}

function filterGaInputByWards(input: GaInput, targetWardIds: string[]): GaInput {
  const selectedWardIdSet = new Set(targetWardIds);
  const wards = input.wards.filter((item) => selectedWardIdSet.has(item.id));

  if (wards.length !== targetWardIds.length) {
    throw new Error("มีวอร์ดที่เลือกบางรายการไม่อยู่ในรอบจัดตาราง");
  }

  const wardStaffCodes = new Set(
    wards.flatMap((ward) => ward.staff.map((staff) => staff.code)),
  );
  const filteredWithoutValidation = {
    ...input,
    department: wards.map((ward) => ward.code).join(", "),
    wards,
    staff: input.staff.filter((staff) => wardStaffCodes.has(staff.id)),
    coverage: {
      ...input.coverage,
      default: {
        ...Object.fromEntries(
          wards.map((ward) => [ward.code, input.coverage.default[ward.code]]),
        ),
      },
    },
    availabilityRequests: input.availabilityRequests.filter((request) =>
      wardStaffCodes.has(request.staffCode),
    ),
    preferredShiftRequests: input.preferredShiftRequests.filter((request) =>
      wardStaffCodes.has(request.staffCode),
    ),
  };

  return {
    ...filteredWithoutValidation,
    validation: validateGaInput(filteredWithoutValidation),
  };
}

function buildSettingsSnapshot(
  gaInput: Awaited<ReturnType<typeof buildGaInput>>,
  readiness: ReturnType<typeof buildGaRunReadiness>,
  targetWardIds: string[] | null,
) {
  const targetWardCodes = targetWardIds
    ? gaInput.wards
        .filter((ward) => targetWardIds.includes(ward.id))
        .map((ward) => ward.code)
    : null;

  return {
    runMode: targetWardIds
      ? targetWardIds.length === 1
        ? "single_ward"
        : "selected_wards"
      : "all_wards",
    targetWardId: targetWardIds?.[0] ?? null,
    targetWardIds,
    targetWardCode: targetWardCodes?.[0] ?? null,
    targetWardCodes,
    ga: gaInput.ga,
    rules: gaInput.rules,
    baseRuleSettings: gaInput.base_rule_settings,
    traineeRule: gaInput.trainee_rule,
    ruleEngine: gaInput.rule_engine,
    penalties: gaInput.penalties,
    validation: readiness,
  };
}

function revalidateGaRunPaths() {
  revalidatePath("/schedule-rounds");
  revalidatePath("/home/schedule-rounds");
}
