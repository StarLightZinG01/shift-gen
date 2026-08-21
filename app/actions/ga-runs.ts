"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";

import { getCurrentSession } from "@/lib/auth/session";
import { buildGaInput } from "@/lib/ga-input/build-ga-input";
import { activeGaRunStatuses } from "@/lib/ga-runs/queries";
import { buildGaRunReadiness } from "@/lib/ga-runs/validation";
import {
  buildGaWardGroups,
  filterGaInputByWardIds,
  type GaWardGroup,
} from "@/lib/ga-runs/ward-groups";
import { prisma } from "@/lib/prisma";

export type StartGaRunActionResult =
  | {
      status: "success";
      message: string;
      gaRunId: string;
      gaRunIds: string[];
      batchId: string;
      groupCount: number;
    }
  | {
      status: "error";
      message: string;
      errors?: string[];
      warnings?: string[];
    };

export type PreviewGaRunGroupsActionResult =
  | {
      status: "success";
      groups: GaWardGroup[];
      wardCount: number;
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
const retryGaRunSchema = z.string().uuid("ไม่พบงาน GA ที่ถูกต้อง");

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
      ? filterGaInputByWardIds(fullGaInput, parsedData.targetWardIds)
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

    const groups = buildGaWardGroups(gaInput);
    const groupInputs = groups.map((group) => {
      const groupInput = filterGaInputByWardIds(gaInput, group.wardIds);
      const groupReadiness = buildGaRunReadiness(groupInput);
      return { group, input: groupInput, readiness: groupReadiness };
    });
    const invalidGroup = groupInputs.find((group) => !group.readiness.ok);

    if (invalidGroup) {
      return {
        status: "error",
        message: `ข้อมูลกลุ่ม ${invalidGroup.group.wardCodes.join(", ")} ยังไม่พร้อมจัดตาราง`,
        errors: invalidGroup.readiness.errors,
        warnings: invalidGroup.readiness.warnings,
      };
    }

    const created = await prisma.$transaction(async (tx) => {
      const latestVersion = await tx.scheduleVersion.aggregate({
        where: { cycleId: cycle.id },
        _max: { versionNo: true },
      });
      const scheduleVersion = await tx.scheduleVersion.create({
        data: {
          cycleId: cycle.id,
          versionNo: (latestVersion._max.versionNo ?? 0) + 1,
          source: "ga",
          status: "generating",
        },
        select: { id: true },
      });
      const batch = await tx.gaRunBatch.create({
        data: {
          cycleId: cycle.id,
          scheduleVersionId: scheduleVersion.id,
          status: "queued",
          targetWardIds: gaInput.wards.map((ward) => ward.id),
          groupCount: groups.length,
        },
        select: { id: true },
      });
      const gaRuns = [];

      for (const { group, input: groupInput, readiness: groupReadiness } of groupInputs) {
        const gaRun = await tx.gaRun.create({
          data: {
            cycleId: cycle.id,
            batchId: batch.id,
            groupIndex: group.index,
            status: "queued",
            inputSnapshot: groupInput as unknown as Prisma.InputJsonValue,
            settingsSnapshot: {
              ...buildSettingsSnapshot(groupInput, groupReadiness, group.wardIds),
              batchId: batch.id,
              groupIndex: group.index,
              groupWardCodes: group.wardCodes,
              sharedStaffCodes: group.sharedStaffCodes,
            } as Prisma.InputJsonValue,
          },
          select: { id: true },
        });
        gaRuns.push(gaRun);
      }

      await tx.scheduleCycle.update({
        where: { id: cycle.id },
        data: { status: "generating" },
      });

      return { batch, gaRuns };
    });

    revalidateGaRunPaths();

    return {
      status: "success",
      message: `แบ่ง ${gaInput.wards.length} วอร์ดเป็น ${groups.length} กลุ่ม และสร้างงาน GA แล้ว`,
      gaRunId: created.gaRuns[0].id,
      gaRunIds: created.gaRuns.map((run) => run.id),
      batchId: created.batch.id,
      groupCount: groups.length,
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

export async function previewGaRunGroupsAction(input: {
  cycleId: string;
  targetWardIds: string[];
}): Promise<PreviewGaRunGroupsActionResult> {
  const session = await getCurrentSession();
  if (!session?.roles.includes("admin")) {
    return { status: "error", message: "บัญชีนี้ไม่มีสิทธิ์ดูการแบ่งกลุ่ม GA" };
  }

  const parsedInput = startGaRunSchema.safeParse(input);
  if (!parsedInput.success || typeof parsedInput.data === "string") {
    return {
      status: "error",
      message: parsedInput.success
        ? "ข้อมูลสำหรับวิเคราะห์กลุ่มไม่ถูกต้อง"
        : parsedInput.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  try {
    const targetWardIds = normalizeTargetWardIds(parsedInput.data.targetWardIds);
    if (!targetWardIds) {
      return { status: "error", message: "กรุณาเลือกอย่างน้อย 1 วอร์ด" };
    }
    const fullGaInput = await buildGaInput(parsedInput.data.cycleId);
    const gaInput = filterGaInputByWardIds(fullGaInput, targetWardIds);
    const readiness = buildGaRunReadiness(gaInput);
    if (!readiness.ok) {
      return {
        status: "error",
        message: "ข้อมูลวอร์ดที่เลือกยังไม่พร้อมจัดตาราง",
        errors: readiness.errors,
        warnings: readiness.warnings,
      };
    }

    return {
      status: "success",
      groups: buildGaWardGroups(gaInput),
      wardCount: gaInput.wards.length,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "ไม่สามารถวิเคราะห์กลุ่มวอร์ดได้",
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
          batchId: true,
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

      const batchIds = Array.from(
        new Set(activeRuns.map((run) => run.batchId).filter((id): id is string => Boolean(id))),
      );
      if (batchIds.length > 0) {
        await tx.gaRunBatch.updateMany({
          where: { id: { in: batchIds } },
          data: {
            status: "failed",
            failedGroupCount: activeRuns.length,
            finishedAt: new Date(),
          },
        });
        await tx.scheduleVersion.updateMany({
          where: {
            gaBatch: { id: { in: batchIds } },
          },
          data: { status: "failed" },
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

export async function retryFailedGaGroupAction(gaRunId: string) {
  const session = await getCurrentSession();
  if (!session?.roles.includes("admin")) {
    return { status: "error" as const, message: "บัญชีนี้ไม่มีสิทธิ์รันงาน GA ซ้ำ" };
  }

  const parsedGaRunId = retryGaRunSchema.safeParse(gaRunId);
  if (!parsedGaRunId.success) {
    return {
      status: "error" as const,
      message: parsedGaRunId.error.issues[0]?.message ?? "งาน GA ไม่ถูกต้อง",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const run = await tx.gaRun.findUnique({
        where: { id: parsedGaRunId.data },
        select: {
          id: true,
          cycleId: true,
          batchId: true,
          status: true,
          settingsSnapshot: true,
        },
      });
      if (!run?.batchId || run.status !== "failed") {
        throw new Error("งานนี้ไม่ใช่กลุ่มที่ล้มเหลวและพร้อมรันซ้ำ");
      }

      const settings =
        run.settingsSnapshot &&
        typeof run.settingsSnapshot === "object" &&
        !Array.isArray(run.settingsSnapshot)
          ? { ...run.settingsSnapshot }
          : {};
      delete settings.worker_error;
      delete settings.worker_result;
      delete settings.worker_score_debug;

      await tx.gaRun.update({
        where: { id: run.id },
        data: {
          status: "queued",
          generationCount: null,
          objective: null,
          fitness: null,
          startedAt: null,
          finishedAt: null,
          settingsSnapshot: settings as Prisma.InputJsonValue,
        },
      });
      const failedGroupCount = await tx.gaRun.count({
        where: { batchId: run.batchId, status: "failed" },
      });
      const batch = await tx.gaRunBatch.update({
        where: { id: run.batchId },
        data: {
          status: "queued",
          failedGroupCount,
          hardScore: null,
          softScore: null,
          objective: null,
          fitness: null,
          finishedAt: null,
        },
        select: { scheduleVersionId: true },
      });
      await tx.scheduleVersion.update({
        where: { id: batch.scheduleVersionId },
        data: { status: "generating" },
      });
      await tx.scheduleCycle.update({
        where: { id: run.cycleId },
        data: { status: "generating" },
      });
    });

    revalidateGaRunPaths();
    return { status: "success" as const, message: "ส่งกลุ่มที่ล้มเหลวกลับไปรอ GA แล้ว" };
  } catch (error) {
    return {
      status: "error" as const,
      message: error instanceof Error ? error.message : "ไม่สามารถรันกลุ่มนี้ซ้ำได้",
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
