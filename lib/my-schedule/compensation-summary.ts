import {
  normalizePayPosition,
  resolveCompensationRates,
} from "@/lib/compensation/rates";
import type {
  MyScheduleCompensationDetailRow,
  MyScheduleStaffRow,
  MyScheduleWardCompensationSummary,
} from "@/lib/my-schedule/types";

type WorkShiftCode = "ด" | "ช" | "บ";

const workShiftCodes = ["ด", "ช", "บ"] as const;
const positionOrder = ["RN", "PN", "NA", "RNANES", "RNICU", "RNSUC"];
const MORNING_SHIFT_INDEX = 1;

type PositionAccumulator = {
  position: string;
  otRate: number;
  shiftPayRate: number;
  otQuantity: number;
  shiftPayQuantity: number;
};

export function buildWardCompensationSummary(
  rows: MyScheduleStaffRow[],
): MyScheduleWardCompensationSummary {
  const positionMap = new Map<string, PositionAccumulator>();

  for (const row of rows) {
    const position = normalizePayPosition(row.payPosition);
    const rates = resolveCompensationRates({
      otRate: row.otRate,
      shiftPayRate: row.shiftPayRate,
    });
    const accumulator = getPositionAccumulator(positionMap, {
      position,
      otRate: rates.otRate,
      shiftPayRate: rates.shiftPayRate,
    });

    let markedOtUnits = 0;
    let regularShiftPayUnits = 0;

    for (const [dayText, shiftCode] of Object.entries(row.shiftsByDay)) {
      const day = Number(dayText);
      const shiftParts = parseShiftParts(shiftCode);
      const otParts = resolveOtShiftParts({
        shiftCode,
        isOt: row.otByDay[day] === true,
        otShifts: row.otShiftsByDay[day],
        shiftParts,
      });

      markedOtUnits += otParts.length;
      regularShiftPayUnits += countShiftPayParts(shiftParts) - countShiftPayParts(otParts);
    }

    accumulator.shiftPayQuantity += Math.max(regularShiftPayUnits, 0);
    accumulator.otQuantity += Math.max(markedOtUnits, 0);
  }

  const positions = Array.from(positionMap.values()).sort(comparePositions);
  const detailRows: MyScheduleCompensationDetailRow[] = positions.flatMap((position) => [
    {
      id: `ot-${position.position}-${position.otRate}`,
      label: `OT ${position.position}`,
      position: position.position,
      rate: position.otRate,
      quantity: position.otQuantity,
      amount: position.otQuantity * position.otRate,
      category: "ot" as const,
    },
    {
      id: `shift-${position.position}-${position.shiftPayRate}`,
      label: `ค่าเวร ${position.position}`,
      position: position.position,
      rate: position.shiftPayRate,
      quantity: position.shiftPayQuantity,
      amount: position.shiftPayQuantity * position.shiftPayRate,
      category: "shift_pay" as const,
    },
  ]);

  detailRows.push({
    id: "vent",
    label: "ค่า Vent",
    position: "-",
    rate: 150,
    quantity: 0,
    amount: 0,
    category: "extra",
  });

  const totalOtAmount = detailRows
    .filter((row) => row.category === "ot")
    .reduce((sum, row) => sum + row.amount, 0);
  const totalShiftPayAmount = detailRows
    .filter((row) => row.category === "shift_pay")
    .reduce((sum, row) => sum + row.amount, 0);
  const totalExtraAmount = detailRows
    .filter((row) => row.category === "extra")
    .reduce((sum, row) => sum + row.amount, 0);
  const totalAmount = totalOtAmount + totalShiftPayAmount + totalExtraAmount;

  return {
    detailRows,
    totalRows: [
      {
        id: "total-ot",
        label: "OT รวม",
        amount: totalOtAmount,
      },
      {
        id: "total-shift-pay",
        label: "ค่าเวรรวม",
        amount: totalShiftPayAmount,
      },
      {
        id: "total-all",
        label: "รวมทั้งหมด",
        amount: totalAmount,
      },
    ],
    totalOtAmount,
    totalShiftPayAmount,
    totalExtraAmount,
    totalAmount,
  };
}

function getPositionAccumulator(
  positionMap: Map<string, PositionAccumulator>,
  input: {
    position: string;
    otRate: number;
    shiftPayRate: number;
  },
) {
  const key = `${input.position}:${input.otRate}:${input.shiftPayRate}`;
  const existing = positionMap.get(key);

  if (existing) {
    return existing;
  }

  const created: PositionAccumulator = {
    ...input,
    otQuantity: 0,
    shiftPayQuantity: 0,
  };
  positionMap.set(key, created);
  return created;
}

function resolveOtShiftParts({
  shiftCode,
  isOt,
  otShifts,
  shiftParts,
}: {
  shiftCode: string;
  isOt: boolean;
  otShifts: string | null;
  shiftParts: WorkShiftCode[];
}) {
  const explicitOtParts = parseShiftParts(otShifts ?? "");

  if (explicitOtParts.length > 0) {
    return explicitOtParts;
  }

  const inlineOtParts = parseInlineOtShiftParts(shiftCode);

  if (inlineOtParts.length > 0) {
    return inlineOtParts;
  }

  return isOt ? shiftParts : [];
}

function parseShiftParts(value: string | null | undefined): WorkShiftCode[] {
  const code = (value ?? "").trim().replace(/\s/g, "");

  if (!code || code === "0" || code === "V" || code === "ว" || code === "ล") {
    return [];
  }

  return splitShiftCode(code.replace(/OT/gi, "")).filter(isWorkShiftCode);
}

function countShiftPayParts(parts: WorkShiftCode[]) {
  return parts.filter((part) => part !== workShiftCodes[MORNING_SHIFT_INDEX]).length;
}

function parseInlineOtShiftParts(value: string | null | undefined): WorkShiftCode[] {
  const code = (value ?? "").trim().replace(/\s/g, "");

  if (!code.toUpperCase().includes("OT")) {
    return [];
  }

  return splitShiftCode(code)
    .filter((part) => part.toUpperCase().includes("OT"))
    .map((part) => part.replace(/OT/gi, ""))
    .filter(isWorkShiftCode);
}

function splitShiftCode(value: string) {
  if (value.includes("/")) {
    return value.split("/").filter(Boolean);
  }

  const normalized = value.replace(/OT/gi, "");

  if (normalized === "ชบ") {
    return ["ช", "บ"];
  }

  if (normalized === "ดบ") {
    return ["ด", "บ"];
  }

  return [value];
}

function isWorkShiftCode(value: string): value is WorkShiftCode {
  return workShiftCodes.includes(value as WorkShiftCode);
}

function comparePositions(a: PositionAccumulator, b: PositionAccumulator) {
  const aIndex = positionOrder.indexOf(a.position.toUpperCase());
  const bIndex = positionOrder.indexOf(b.position.toUpperCase());

  if (aIndex !== bIndex) {
    return normalizeSortIndex(aIndex) - normalizeSortIndex(bIndex);
  }

  return a.position.localeCompare(b.position);
}

function normalizeSortIndex(index: number) {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
