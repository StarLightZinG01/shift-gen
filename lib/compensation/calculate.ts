import {
  normalizePayPosition,
  resolveCompensationRates,
  toNumber,
} from "@/lib/compensation/rates";
import type {
  CompensationItemSummary,
  ParsedShiftCode,
  StaffCompensationSummary,
  WardCompensationResult,
} from "@/lib/compensation/types";

const DEFAULT_REGULAR_WORK_TARGET = 20;

export function parseShiftCode(value: string | null | undefined): ParsedShiftCode {
  const shiftCode = (value ?? "").trim().replace(/\s/g, "");

  if (!shiftCode || shiftCode === "0" || shiftCode === "V" || shiftCode === "ล") {
    return emptyParsedShift();
  }

  const normalized = shiftCode.replace(/OT/gi, "");
  const parts = normalized.includes("/")
    ? normalized.split("/").filter(Boolean)
    : splitCompactShiftCode(normalized);

  return parts.reduce((result, part) => {
    if (part === "ช") {
      result.morning += 1;
      result.workUnits += 1;
    } else if (part === "บ") {
      result.afternoon += 1;
      result.workUnits += 1;
    } else if (part === "ด") {
      result.night += 1;
      result.workUnits += 1;
    } else if (part === "ว") {
      result.academic += 1;
      result.workUnits += 1;
    }

    return result;
  }, emptyParsedShift());
}

export function calculateCompensationForAssignments(
  assignments: Array<{
    staffId: string;
    shiftCode: string;
    isOt?: boolean;
    otShifts?: string | null;
    staff: {
      id: string;
      staffCode: string;
      fullName: string;
      position?: string | null;
      payPosition: string | null;
      otRate: unknown;
      shiftPayRate: unknown;
    };
    ward: {
      id: string;
      code: string;
      name: string;
    };
  }>,
): WardCompensationResult[] {
  const wardMap = new Map<string, WardAccumulator>();

  for (const assignment of assignments) {
    const ward = getWardAccumulator(wardMap, assignment.ward);
    const staff = getStaffAccumulator(ward.staffMap, assignment.staff);
    const parsedShift = parseShiftCode(assignment.shiftCode);

    staff.morningCount += parsedShift.morning;
    staff.afternoonCount += parsedShift.afternoon;
    staff.nightCount += parsedShift.night;
    staff.academicCount += parsedShift.academic;
    staff.totalWorkUnits += parsedShift.workUnits;
    staff.markedOtUnits += countMarkedOtUnits({
      shiftCode: assignment.shiftCode,
      isOt: assignment.isOt === true,
      otShifts: assignment.otShifts,
      fallbackWorkUnits: parsedShift.workUnits,
    });
  }

  return Array.from(wardMap.values()).map(toWardResult);
}

export function calculateCompensationForScheduleVersion(
  scheduleVersionId: string,
  assignments: Parameters<typeof calculateCompensationForAssignments>[0],
) {
  return {
    scheduleVersionId,
    wards: calculateCompensationForAssignments(assignments),
  };
}

function splitCompactShiftCode(shiftCode: string) {
  if (shiftCode === "ชบ") {
    return ["ช", "บ"];
  }

  if (shiftCode === "ดบ") {
    return ["ด", "บ"];
  }

  return [shiftCode];
}

function countMarkedOtUnits({
  shiftCode,
  isOt,
  otShifts,
  fallbackWorkUnits,
}: {
  shiftCode: string;
  isOt: boolean;
  otShifts: string | null | undefined;
  fallbackWorkUnits: number;
}) {
  const explicitOtUnits = parseShiftCode(otShifts).workUnits;

  if (explicitOtUnits > 0) {
    return explicitOtUnits;
  }

  const inlineOtUnits = countInlineOtUnits(shiftCode);

  if (inlineOtUnits > 0) {
    return inlineOtUnits;
  }

  return isOt ? fallbackWorkUnits : 0;
}

function countInlineOtUnits(value: string | null | undefined) {
  const shiftCode = (value ?? "").trim().replace(/\s/g, "");

  if (!shiftCode.toUpperCase().includes("OT")) {
    return 0;
  }

  const parts = shiftCode.includes("/")
    ? shiftCode.split("/").filter(Boolean)
    : splitCompactShiftCode(shiftCode);

  return parts.reduce((total, part) => {
    if (!part.toUpperCase().includes("OT")) {
      return total;
    }

    return total + parseShiftCode(part.replace(/OT/gi, "")).workUnits;
  }, 0);
}

function emptyParsedShift(): ParsedShiftCode {
  return {
    morning: 0,
    afternoon: 0,
    night: 0,
    academic: 0,
    workUnits: 0,
  };
}

type StaffAccumulator = StaffCompensationSummary & {
  markedOtUnits: number;
};

type WardAccumulator = {
  wardId: string;
  wardCode: string;
  wardName: string;
  staffMap: Map<string, StaffAccumulator>;
};

function getWardAccumulator(
  wardMap: Map<string, WardAccumulator>,
  ward: { id: string; code: string; name: string },
) {
  const existing = wardMap.get(ward.id);

  if (existing) {
    return existing;
  }

  const created: WardAccumulator = {
    wardId: ward.id,
    wardCode: ward.code,
    wardName: ward.name,
    staffMap: new Map(),
  };
  wardMap.set(ward.id, created);
  return created;
}

function getStaffAccumulator(
  staffMap: Map<string, StaffAccumulator>,
  staff: {
    id: string;
    staffCode: string;
    fullName: string;
    position?: string | null;
    payPosition: string | null;
    otRate: unknown;
    shiftPayRate: unknown;
  },
) {
  const existing = staffMap.get(staff.id);

  if (existing) {
    return existing;
  }

  const payPosition = normalizePayPosition(staff.payPosition ?? staff.position);
  const rates = resolveCompensationRates({
    otRate: staff.otRate,
    shiftPayRate: staff.shiftPayRate,
  });
  const created: StaffAccumulator = {
    staffId: staff.id,
    staffCode: staff.staffCode,
    fullName: staff.fullName,
    payPosition,
    regularWorkTarget: DEFAULT_REGULAR_WORK_TARGET,
    morningCount: 0,
    afternoonCount: 0,
    nightCount: 0,
    academicCount: 0,
    totalWorkUnits: 0,
    markedOtUnits: 0,
    otCount: 0,
    otRate: rates.otRate,
    shiftPayRate: rates.shiftPayRate,
    otAmount: 0,
    shiftPayAmount: 0,
    totalAmount: 0,
  };

  staffMap.set(staff.id, created);
  return created;
}

function toWardResult(ward: WardAccumulator): WardCompensationResult {
  const staffSummaries = Array.from(ward.staffMap.values()).map((staff) => {
    const otCount = staff.markedOtUnits;
    const shiftPayUnits = staff.afternoonCount + staff.nightCount;
    const otAmount = otCount * staff.otRate;
    const shiftPayAmount = shiftPayUnits * staff.shiftPayRate;

    return {
      ...staff,
      otCount,
      otAmount,
      shiftPayAmount,
      totalAmount: otAmount + shiftPayAmount,
    };
  });
  const items = buildItems(staffSummaries);
  const totalOtAmount = staffSummaries.reduce(
    (sum, staff) => sum + staff.otAmount,
    0,
  );
  const totalRegularShiftAmount = staffSummaries.reduce(
    (sum, staff) => sum + staff.shiftPayAmount,
    0,
  );

  return {
    wardId: ward.wardId,
    wardCode: ward.wardCode,
    wardName: ward.wardName,
    totalOtAmount,
    totalRegularShiftAmount,
    totalAmount: totalOtAmount + totalRegularShiftAmount,
    staffSummaries: staffSummaries.sort((a, b) =>
      a.staffCode.localeCompare(b.staffCode),
    ),
    items,
  };
}

function buildItems(staffSummaries: StaffCompensationSummary[]) {
  const itemMap = new Map<string, CompensationItemSummary>();

  for (const staff of staffSummaries) {
    addItem(itemMap, {
      category: "ot",
      staffType: staff.payPosition,
      rate: staff.otRate,
      quantity: staff.otCount,
    });
    addItem(itemMap, {
      category: "shift_pay",
      staffType: staff.payPosition,
      rate: staff.shiftPayRate,
      quantity: staff.afternoonCount + staff.nightCount,
    });
  }

  return Array.from(itemMap.values())
    .filter((item) => item.quantity > 0)
    .sort((a, b) => `${a.category}-${a.staffType}`.localeCompare(`${b.category}-${b.staffType}`));
}

function addItem(
  itemMap: Map<string, CompensationItemSummary>,
  input: {
    category: CompensationItemSummary["category"];
    staffType: string;
    rate: number;
    quantity: number;
  },
) {
  if (input.quantity <= 0) {
    return;
  }

  const key = `${input.category}:${input.staffType}:${input.rate}`;
  const existing = itemMap.get(key);

  if (existing) {
    existing.quantity += input.quantity;
    existing.amount += input.quantity * input.rate;
    return;
  }

  itemMap.set(key, {
    category: input.category,
    staffType: input.staffType,
    rate: toNumber(input.rate),
    quantity: input.quantity,
    amount: input.quantity * input.rate,
  });
}
