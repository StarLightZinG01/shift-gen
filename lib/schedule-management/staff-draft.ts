import type {
  ExternalStaffCandidate,
  StaffRow,
  WardContext,
} from "./types";

export type NewStaffDraftInput = {
  code: string;
  fullName: string;
  payPosition: string;
  otRate: string;
  shiftPayRate: string;
  isHead: boolean;
  isTrainee: boolean;
  off: string;
  vacation: string;
  leave: string;
};

export function createDraftStaffId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `draft-${crypto.randomUUID()}`;
  }

  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function hasDuplicateStaff(
  staffRows: StaffRow[],
  staff: { code?: string; staffId?: string | null },
) {
  const code = staff.code?.trim().toLowerCase();

  return staffRows.some((row) => {
    if (staff.staffId && row.staffId === staff.staffId) {
      return true;
    }

    return Boolean(code && row.code.trim().toLowerCase() === code);
  });
}

export function validateNewStaffDraft(input: NewStaffDraftInput) {
  if (!input.code.trim()) {
    return "กรุณากรอกรหัสบุคลากร";
  }

  if (!input.fullName.trim()) {
    return "กรุณากรอกชื่อ-นามสกุล";
  }

  if (!input.payPosition.trim()) {
    return "กรุณากรอกตำแหน่งเบิกจ่าย";
  }

  if (!isValidRate(input.otRate)) {
    return "กรุณากรอกค่า OT เป็นตัวเลขที่ถูกต้อง";
  }

  if (!isValidRate(input.shiftPayRate)) {
    return "กรุณากรอกค่าเวร บ/ด เป็นตัวเลขที่ถูกต้อง";
  }

  return null;
}

export function buildNewStaffRow(
  input: NewStaffDraftInput,
  ward: WardContext,
): StaffRow {
  return {
    id: createDraftStaffId(),
    staffId: null,
    rowType: "new",
    code: input.code.trim(),
    fullName: input.fullName.trim(),
    homeWard: ward.code,
    allowedWards: [ward.code],
    payPosition: input.payPosition.trim(),
    otRate: input.otRate.trim(),
    shiftPayRate: input.shiftPayRate.trim(),
    off: input.off.trim() || "0",
    vacation: input.vacation.trim() || "0",
    leave: input.leave.trim() || "0",
    isHead: input.isHead,
    isTrainee: input.isTrainee,
  };
}

export function buildExternalStaffRow(
  candidate: ExternalStaffCandidate,
): StaffRow {
  return {
    id: `external-${candidate.id}`,
    staffId: candidate.id,
    rowType: "external",
    code: candidate.code,
    fullName: candidate.fullName,
    homeWard: candidate.homeWard,
    allowedWards: candidate.allowedWards,
    payPosition: candidate.payPosition,
    otRate: candidate.otRate,
    shiftPayRate: candidate.shiftPayRate,
    off: "0",
    vacation: "0",
    leave: "0",
    isHead: candidate.isHead,
    isTrainee: candidate.isTrainee,
  };
}

function isValidRate(value: string) {
  const trimmed = value.trim();
  const numberValue = Number(trimmed);

  return Boolean(trimmed) && Number.isFinite(numberValue) && numberValue >= 0;
}
