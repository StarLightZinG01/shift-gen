import type { GaInput } from "@/lib/ga-input/types";
import { validateGaInput } from "@/lib/ga-input/validators";
export { buildGaWardGroups } from "@/lib/ga-runs/ward-grouping";
export type { GaWardGroup } from "@/lib/ga-runs/ward-grouping";

export function filterGaInputByWardIds(
  input: GaInput,
  targetWardIds: string[],
): GaInput {
  const selectedWardIdSet = new Set(targetWardIds);
  const wards = input.wards.filter((item) => selectedWardIdSet.has(item.id));

  if (wards.length !== selectedWardIdSet.size) {
    throw new Error("มีวอร์ดที่เลือกบางรายการไม่อยู่ในรอบจัดตาราง");
  }

  const selectedWardCodeSet = new Set(wards.map((ward) => ward.code));
  const wardStaffCodes = new Set(
    wards.flatMap((ward) => ward.staff.map((staff) => staff.code)),
  );
  const staff = input.staff
    .filter((staffMember) => wardStaffCodes.has(staffMember.id))
    .map((staffMember) => ({
      ...staffMember,
      allowed_wards: staffMember.allowed_wards.filter((wardCode) =>
        selectedWardCodeSet.has(wardCode),
      ),
    }));
  const selectedStaffCodes = new Set(staff.map((staffMember) => staffMember.id));
  const filteredWithoutValidation = {
    ...input,
    department: wards.map((ward) => ward.code).join(", "),
    wards,
    staff,
    coverage: {
      ...input.coverage,
      default: Object.fromEntries(
        wards.map((ward) => [ward.code, input.coverage.default[ward.code]]),
      ),
      by_day: filterWardDayMap(input.coverage.by_day, selectedWardCodeSet),
    },
    staffing_composition: {
      default: Object.fromEntries(
        wards.map((ward) => [
          ward.code,
          input.staffing_composition.default[ward.code],
        ]),
      ),
      by_day: filterWardDayMap(
        input.staffing_composition.by_day,
        selectedWardCodeSet,
      ),
    },
    availabilityRequests: input.availabilityRequests.filter((request) =>
      selectedStaffCodes.has(request.staffCode),
    ),
    preferredShiftRequests: input.preferredShiftRequests.filter((request) =>
      selectedStaffCodes.has(request.staffCode),
    ),
    custom_rules: input.custom_rules.filter((rule) =>
      selectedWardCodeSet.has(rule.ward),
    ),
  };

  return {
    ...filteredWithoutValidation,
    validation: validateGaInput(filteredWithoutValidation),
  };
}

function filterWardDayMap<T>(
  byDay: Record<string, Record<string, T>>,
  selectedWardCodes: Set<string>,
) {
  return Object.fromEntries(
    Object.entries(byDay).map(([day, wardMap]) => [
      day,
      Object.fromEntries(
        Object.entries(wardMap).filter(([wardCode]) =>
          selectedWardCodes.has(wardCode),
        ),
      ),
    ]),
  );
}
