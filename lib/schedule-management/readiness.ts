import type { StaffingRequirements, StaffRow } from "./types";

export type ReadinessCheckStatus = "passed" | "warning";

export type ReadinessCheck = {
  id: string;
  status: ReadinessCheckStatus;
  message: string;
};

type ReadinessInput = {
  staffRows: StaffRow[];
  staffingRequirements: StaffingRequirements | null;
};

export function buildReadinessChecks({
  staffRows,
  staffingRequirements,
}: ReadinessInput): ReadinessCheck[] {
  const hasCompleteStaffingRequirements =
    staffingRequirements !== null &&
    hasShiftRequirement(staffingRequirements.night) &&
    hasShiftRequirement(staffingRequirements.morning) &&
    hasShiftRequirement(staffingRequirements.afternoon);

  const hasValidStaffingRange =
    hasCompleteStaffingRequirements &&
    isValidStaffingRange(staffingRequirements.night) &&
    isValidStaffingRange(staffingRequirements.morning) &&
    isValidStaffingRange(staffingRequirements.afternoon);

  const incompleteStaffCount = staffRows.filter(hasIncompleteStaffData).length;
  const hasWardHead = staffRows.some((row) => row.isHead);

  return [
    {
      id: "staffing-requirements",
      status: hasCompleteStaffingRequirements ? "passed" : "warning",
      message: hasCompleteStaffingRequirements
        ? "กำหนดกำลังคนครบแล้ว"
        : "ยังไม่ได้กำหนดกำลังคนให้ครบทุกกะ",
    },
    {
      id: "staffing-range",
      status: hasValidStaffingRange ? "passed" : "warning",
      message: hasValidStaffingRange
        ? "ค่าขั้นต่ำ/สูงสุดถูกต้อง"
        : "มีค่ากำลังคนขั้นต่ำ/สูงสุดไม่ถูกต้อง",
    },
    {
      id: "ward-staff",
      status: staffRows.length > 0 ? "passed" : "warning",
      message:
        staffRows.length > 0 ? "มีบุคลากรในวอร์ดแล้ว" : "ยังไม่มีบุคลากรในวอร์ด",
    },
    {
      id: "staff-data",
      status: incompleteStaffCount === 0 ? "passed" : "warning",
      message:
        incompleteStaffCount === 0
          ? "ข้อมูลบุคลากรครบแล้ว"
          : `มีบุคลากร ${incompleteStaffCount} คนข้อมูลยังไม่ครบ`,
    },
    {
      id: "ward-head",
      status: hasWardHead ? "passed" : "warning",
      message: hasWardHead ? "มีหัวหน้าวอร์ดแล้ว" : "ยังไม่มีหัวหน้าวอร์ด",
    },
  ];
}

function hasShiftRequirement(requirement?: { min: number; max: number }) {
  return (
    requirement !== undefined &&
    Number.isFinite(requirement.min) &&
    Number.isFinite(requirement.max)
  );
}

function isValidStaffingRange(requirement?: { min: number; max: number }) {
  return (
    requirement !== undefined &&
    requirement.min >= 0 &&
    requirement.max >= 0 &&
    requirement.min <= requirement.max
  );
}

function hasIncompleteStaffData(row: StaffRow) {
  return (
    isBlank(row.code) ||
    isBlank(row.fullName) ||
    isBlank(row.homeWard) ||
    isBlank(row.payPosition) ||
    !isValidNumericText(row.otRate) ||
    !isValidNumericText(row.shiftPayRate)
  );
}

function isBlank(value: string) {
  return value.trim().length === 0;
}

function isValidNumericText(value: string) {
  if (isBlank(value)) {
    return false;
  }

  return Number.isFinite(Number(value));
}
