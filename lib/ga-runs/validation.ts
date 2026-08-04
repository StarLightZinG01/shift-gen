import type { GaInput, GaShiftCode } from "@/lib/ga-input/types";
import type { GaRunReadiness } from "@/lib/ga-runs/types";

const requiredShiftCodes: GaShiftCode[] = ["ช", "บ", "ด"];

export function buildGaRunReadiness(input: GaInput): GaRunReadiness {
  const errors = [...input.validation.errors];
  const warnings = [...input.validation.warnings];

  if (input.wards.length === 0) {
    errors.push("รอบนี้ยังไม่มีวอร์ดสำหรับจัดตาราง");
  }

  for (const ward of input.wards) {
    if (ward.preparationStatus === "draft" || ward.preparationStatus === "needs_fix") {
      errors.push(`วอร์ด ${ward.code} ยังไม่ได้ส่งข้อมูลพร้อมจัดตาราง`);
    }

    if (ward.staff.length === 0) {
      errors.push(`วอร์ด ${ward.code} ยังไม่มีบุคลากรสำหรับจัดตาราง`);
    }

    for (const shiftCode of requiredShiftCodes) {
      const requirement = ward.requirements[shiftCode];

      if (!requirement) {
        errors.push(`วอร์ด ${ward.code} ยังไม่ได้กำหนดกำลังคนกะ ${shiftCode}`);
        continue;
      }

      if (requirement.min < 0 || requirement.max < 0 || requirement.min > requirement.max) {
        errors.push(`วอร์ด ${ward.code} กำลังคนกะ ${shiftCode} ไม่ถูกต้อง`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
  };
}
