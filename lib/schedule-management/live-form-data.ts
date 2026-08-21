import type { StaffingRequirements, StaffRow } from "./types";

export type LiveScheduleManagementData = {
  staffRows: StaffRow[];
  staffingRequirements: StaffingRequirements | null;
};

export function buildLiveScheduleManagementData(
  form: HTMLFormElement,
  initialRows: StaffRow[],
): LiveScheduleManagementData {
  const formData = new FormData(form);

  return {
    staffRows: buildLiveStaffRows(formData, initialRows),
    staffingRequirements: buildLiveStaffingRequirements(formData),
  };
}

export function buildLiveStaffingRequirements(
  formData: FormData,
): StaffingRequirements {
  return {
    night: buildLiveShiftRequirement(formData, "night"),
    morning: buildLiveShiftRequirement(formData, "morning"),
    afternoon: buildLiveShiftRequirement(formData, "afternoon"),
  };
}

function buildLiveShiftRequirement(formData: FormData, prefix: string) {
  return {
    min: parseLiveNumber(formData.get(`${prefix}Min`)),
    max: parseLiveNumber(formData.get(`${prefix}Max`)),
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
        getFormText(formData, `staff.${id}.isTrainee`),
        initialRow?.isTrainee ?? false,
      ),
    } satisfies StaffRow;
  });
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
