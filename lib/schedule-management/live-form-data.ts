import type { StaffingRequirements, StaffRow } from "./types";
import {
  SPECIAL_RULE_DEFINITIONS,
  type SpecialRuleSetting,
} from "./special-rules";

export type LiveScheduleManagementData = {
  staffRows: StaffRow[];
  staffingRequirements: StaffingRequirements | null;
  specialRuleSettings: SpecialRuleSetting[];
};

export function buildLiveScheduleManagementData(
  form: HTMLFormElement,
  initialRows: StaffRow[],
  initialSpecialRuleSettings: SpecialRuleSetting[],
): LiveScheduleManagementData {
  const formData = new FormData(form);

  return {
    staffRows: buildLiveStaffRows(formData, initialRows),
    staffingRequirements: buildLiveStaffingRequirements(formData),
    specialRuleSettings: buildLiveSpecialRuleSettings(
      formData,
      initialSpecialRuleSettings,
    ),
  };
}

export function buildLiveSpecialRuleSettings(
  formData: FormData,
  initialSettings: SpecialRuleSetting[],
): SpecialRuleSetting[] {
  const initialByKey = new Map(
    initialSettings.map((setting) => [setting.ruleKey, setting]),
  );

  return SPECIAL_RULE_DEFINITIONS.map((definition) => {
    const initial = initialByKey.get(definition.ruleKey);
    const enabled =
      formData.get(`specialRule.${definition.ruleKey}.enabled`) === "true";
    const parameters = Object.fromEntries(
      definition.parameterFields.map((field) => {
        const raw = formData.get(
          `specialRule.${definition.ruleKey}.${field.key}`,
        );
        const parsed = typeof raw === "string" ? Number(raw) : Number.NaN;
        return [
          field.key,
          Number.isFinite(parsed)
            ? Math.max(field.min, Math.trunc(parsed))
            : initial?.parameters[field.key] ?? definition.defaults[field.key],
        ];
      }),
    );

    return {
      ruleKey: definition.ruleKey,
      enabled,
      parameters,
    };
  });
}

export function buildLiveStaffingRequirements(
  formData: FormData,
): StaffingRequirements {
  return {
    night: buildLiveShiftRequirement(formData, "night"),
    morning: buildLiveShiftRequirement(formData, "morning"),
    afternoon: buildLiveShiftRequirement(formData, "afternoon"),
    holidayNight: buildLiveShiftRequirement(formData, "holidayNight"),
    holidayMorning: buildLiveShiftRequirement(formData, "holidayMorning"),
    holidayAfternoon: buildLiveShiftRequirement(formData, "holidayAfternoon"),
  };
}

function buildLiveShiftRequirement(formData: FormData, prefix: string) {
  const rnRequired = parseLiveNumber(formData.get(`${prefix}RnRequired`));
  const pnNaRequired = parseLiveNumber(formData.get(`${prefix}PnNaRequired`));
  const requiredStaff = rnRequired + pnNaRequired;
  return {
    min: requiredStaff,
    max: requiredStaff,
    rnRequired,
    pnNaRequired,
    requiresIncharge: formData.get(`${prefix}RequiresIncharge`) === "true",
  };
}

function parseLiveNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return Number.NaN;
  }

  return Number(value);
}

export function buildLiveStaffRows(formData: FormData, initialRows: StaffRow[]) {
  const initialById = new Map(initialRows.map((row) => [row.id, row]));

  return formData.getAll("staffRowKey").map((rowKey) => {
    const id = String(rowKey);
    const initialRow = initialById.get(id);

    return {
      id,
      staffId:
        getFormText(formData, `staff.${id}.staffId`) || initialRow?.staffId || null,
      rowType: (getFormText(formData, `staff.${id}.rowType`) ||
        initialRow?.rowType ||
        "home") as StaffRow["rowType"],
      code: getFormText(formData, `staff.${id}.code`) || initialRow?.code || "",
      fullName:
        getFormText(formData, `staff.${id}.fullName`) || initialRow?.fullName || "",
      homeWard:
        getFormText(formData, `staff.${id}.homeWard`) || initialRow?.homeWard || "",
      allowedWards: parseAllowedWards(
        getFormText(formData, `staff.${id}.allowedWards`),
        initialRow?.allowedWards ?? [],
      ),
      payPosition:
        getFormText(formData, `staff.${id}.payPosition`) ||
        initialRow?.payPosition ||
        "",
      otRate: getFormText(formData, `staff.${id}.otRate`) || initialRow?.otRate || "",
      shiftPayRate:
        getFormText(formData, `staff.${id}.shiftPayRate`) ||
        initialRow?.shiftPayRate ||
        "",
      off: getFormText(formData, `staff.${id}.off`) || initialRow?.off || "",
      vacation:
        getFormText(formData, `staff.${id}.vacation`) || initialRow?.vacation || "",
      leave: getFormText(formData, `staff.${id}.leave`) || initialRow?.leave || "",
      academic:
        getFormText(formData, `staff.${id}.academic`) || initialRow?.academic || "",
      preferredShifts:
        getFormText(formData, `staff.${id}.preferredShifts`) ||
        initialRow?.preferredShifts ||
        "",
      isHead: parseBooleanText(
        getFormText(formData, `staff.${id}.isHead`),
        initialRow?.isHead ?? false,
      ),
      isTrainee: parseBooleanText(
        getFormText(formData, `staff.${id}.isNewNurse`),
        initialRow?.isTrainee ?? false,
      ),
      staffCategory: parseStaffCategory(
        getFormText(formData, `staff.${id}.staffCategory`),
        initialRow?.staffCategory ?? "OTHER",
      ),
      isNewNurse: parseBooleanText(
        getFormText(formData, `staff.${id}.isNewNurse`),
        initialRow?.isNewNurse ?? initialRow?.isTrainee ?? false,
      ),
      canBeInCharge: parseBooleanText(
        getFormText(formData, `staff.${id}.canBeInCharge`),
        initialRow?.canBeInCharge ?? false,
      ),
    } satisfies StaffRow;
  });
}

function parseStaffCategory(value: string, fallback: StaffRow["staffCategory"]) {
  return value === "RN" || value === "PN" || value === "NA" || value === "OTHER"
    ? value
    : fallback;
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseAllowedWards(value: string, fallback: string[]) {
  const wards = value
    .split(/[,;|\n\r]+/)
    .map((ward) => ward.trim())
    .filter(Boolean);

  return wards.length > 0 ? wards : fallback;
}

function parseBooleanText(value: string, fallback: boolean) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}
