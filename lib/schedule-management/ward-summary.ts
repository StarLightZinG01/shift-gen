import { buildReadinessChecks } from "./readiness";
import type {
  RequestSummaryRow,
  StaffingRequirements,
  StaffRow,
} from "./types";

export type WardSummary = {
  totalStaff: number;
  headCount: number;
  traineeCount: number;
  externalStaffCount: number;
  shiftRequirements: {
    morning: string;
    afternoon: string;
    night: string;
  };
  requestCount: number;
  readinessStatus: "ready" | "needs-fix";
  readinessStatusLabel: string;
};

type WardSummaryInput = {
  wardCode?: string;
  staffRows: StaffRow[];
  requestRows: RequestSummaryRow[];
  staffingRequirements: StaffingRequirements | null;
};

export function buildWardSummary({
  wardCode,
  staffRows,
  requestRows,
  staffingRequirements,
}: WardSummaryInput): WardSummary {
  const readinessChecks = buildReadinessChecks({
    staffRows,
    staffingRequirements,
  });
  const isReady = readinessChecks.every((check) => check.status === "passed");

  return {
    totalStaff: staffRows.length,
    headCount: staffRows.filter((row) => row.isHead).length,
    traineeCount: staffRows.filter((row) => row.isTrainee).length,
    externalStaffCount: countExternalStaff(wardCode, staffRows),
    shiftRequirements: {
      morning: formatShiftRequirement(staffingRequirements?.morning),
      afternoon: formatShiftRequirement(staffingRequirements?.afternoon),
      night: formatShiftRequirement(staffingRequirements?.night),
    },
    requestCount: requestRows.length,
    readinessStatus: isReady ? "ready" : "needs-fix",
    readinessStatusLabel: isReady ? "พร้อมจัดตาราง" : "ยังมีจุดต้องแก้",
  };
}

function countExternalStaff(wardCode: string | undefined, staffRows: StaffRow[]) {
  if (!wardCode) {
    return 0;
  }

  return staffRows.filter((row) => row.homeWard !== wardCode).length;
}

function formatShiftRequirement(requirement?: { min: number; max: number }) {
  if (
    requirement === undefined ||
    !Number.isFinite(requirement.min) ||
    !Number.isFinite(requirement.max)
  ) {
    return "ยังไม่กำหนด";
  }

  if (requirement.min === requirement.max) {
    return `${requirement.min} คน`;
  }

  return `${requirement.min}-${requirement.max} คน`;
}
