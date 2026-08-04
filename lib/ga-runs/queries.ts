import type { GaRunSummary, GaRunStatus } from "@/lib/ga-runs/types";

type GaRunRecord = {
  id: string;
  status: string;
  generationCount: number | null;
  objective: unknown;
  fitness: unknown;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export const activeGaRunStatuses = ["queued", "running", "processing"];

export function normalizeGaRunStatus(status: string): GaRunStatus {
  if (
    status === "queued" ||
    status === "running" ||
    status === "processing" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }

  return "queued";
}

export function formatGaRunStatus(status: string) {
  const labels: Record<GaRunStatus, string> = {
    queued: "รอเริ่มจัดตาราง",
    running: "กำลังจัดตาราง",
    processing: "กำลังประมวลผล",
    completed: "จัดตารางเสร็จแล้ว",
    failed: "จัดตารางไม่สำเร็จ",
  };

  return labels[normalizeGaRunStatus(status)];
}

export function isActiveGaRunStatus(status: string) {
  return activeGaRunStatuses.includes(status);
}

export function mapGaRunSummary(run: GaRunRecord): GaRunSummary {
  return {
    id: run.id,
    status: normalizeGaRunStatus(run.status),
    statusLabel: formatGaRunStatus(run.status),
    createdAtLabel: formatDateTimeLabel(run.createdAt),
    startedAtLabel: formatDateTimeLabel(run.startedAt),
    finishedAtLabel: formatDateTimeLabel(run.finishedAt),
    generationCount: run.generationCount,
    objective: run.objective === null ? null : String(run.objective),
    fitness: run.fitness === null ? null : String(run.fitness),
  };
}

function formatDateTimeLabel(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
