import type { GaInput, GaInputValidation, GaShiftCode } from "./types";

const requiredShiftCodes: GaShiftCode[] = ["ช", "บ", "ด"];

export function validateGaInput(input: Omit<GaInput, "validation">): GaInputValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.cycle.id) {
    errors.push("ไม่พบ cycleId ของรอบจัดตาราง");
  }

  if (input.wards.length === 0) {
    errors.push("รอบนี้ยังไม่มีข้อมูลวอร์ด");
  }

  for (const ward of input.wards) {
    for (const shiftCode of requiredShiftCodes) {
      const requirement = ward.requirements[shiftCode];

      if (!requirement) {
        errors.push(`วอร์ด ${ward.code} ยังไม่มีกำลังคนกะ ${shiftCode}`);
        continue;
      }

      if (requirement.min < 0 || requirement.max < 0 || requirement.min > requirement.max) {
        errors.push(`วอร์ด ${ward.code} กำลังคนกะ ${shiftCode} ไม่ถูกต้อง`);
      }
    }

    if (ward.staff.length === 0) {
      warnings.push(`วอร์ด ${ward.code} ยังไม่มีบุคลากรในรอบนี้`);
    }

    const seenCodes = new Set<string>();
    for (const staff of ward.staff) {
      if (!staff.code.trim()) {
        errors.push(`วอร์ด ${ward.code} มีบุคลากรที่ไม่มีรหัส`);
      }

      const codeKey = staff.code.trim().toLowerCase();
      if (seenCodes.has(codeKey)) {
        warnings.push(`วอร์ด ${ward.code} มีบุคลากรรหัส ${staff.code} ซ้ำ ระบบจะใช้รายการเดียว`);
      }
      seenCodes.add(codeKey);

      if (staff.isExternal && !staff.allowedWardCodes.includes(ward.code)) {
        warnings.push(`บุคลากร ${staff.code} ถูกเลือกช่วยวอร์ด ${ward.code} แต่ไม่มี permission ของวอร์ดนี้`);
      }
    }
  }

  const gaStaffCodes = new Set<string>();
  for (const staff of input.staff) {
    if (!staff.id.trim()) {
      errors.push("มีบุคลากรใน GA input ที่ไม่มีรหัส");
    }

    if (gaStaffCodes.has(staff.id)) {
      errors.push(`GA staff มีรหัส ${staff.id} ซ้ำ`);
    }
    gaStaffCodes.add(staff.id);
  }

  for (const request of input.availabilityRequests) {
    if (!gaStaffCodes.has(request.staffCode)) {
      warnings.push(`มีคำขอของ ${request.staffCode} แต่ไม่พบคนนี้ใน staff ของรอบจัดตาราง`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
