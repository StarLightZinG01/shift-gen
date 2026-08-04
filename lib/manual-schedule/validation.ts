export const editableShiftCodes = ["0", "ช", "บ", "ด", "ช/บ", "ด/บ", "V", "ล", "ว"] as const;

export type EditableShiftCode = (typeof editableShiftCodes)[number];

export function isEditableShiftCode(value: string): value is EditableShiftCode {
  return editableShiftCodes.includes(value as EditableShiftCode);
}

export function assertEditableShiftCode(value: string) {
  if (!isEditableShiftCode(value)) {
    throw new Error("รูปแบบเวรไม่ถูกต้อง");
  }
}

export function isWorkShift(value: string | null | undefined) {
  return Boolean(value && value !== "0" && value !== "V" && value !== "ล");
}

export function splitShiftCode(value: string | null | undefined) {
  const shiftCode = (value ?? "").trim().replace(/\s/g, "");

  if (!isWorkShift(shiftCode)) {
    return [];
  }

  if (shiftCode.includes("/")) {
    return shiftCode.split("/").filter(Boolean);
  }

  if (shiftCode === "ชบ") {
    return ["ช", "บ"];
  }

  if (shiftCode === "ดบ") {
    return ["ด", "บ"];
  }

  return [shiftCode];
}
