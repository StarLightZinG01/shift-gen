import type { StaffRow } from "./types";

const POSITION_ORDER: Record<string, number> = {
  RNSUC: 0,
  RNICU: 1,
  RNANES: 2,
  RN: 3,
  PN: 4,
  NA: 5,
};

const collator = new Intl.Collator("th", {
  numeric: true,
  sensitivity: "base",
});

export function sortStaffRows(rows: StaffRow[]): StaffRow[] {
  return [...rows].sort((left, right) => {
    const headOrder = Number(right.isHead) - Number(left.isHead);
    if (headOrder !== 0) return headOrder;

    const positionOrder = getPositionOrder(left) - getPositionOrder(right);
    if (positionOrder !== 0) return positionOrder;

    const codeOrder = collator.compare(left.code, right.code);
    if (codeOrder !== 0) return codeOrder;

    return collator.compare(left.fullName, right.fullName);
  });
}

function getPositionOrder(row: StaffRow) {
  const normalizedPosition = row.payPosition
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (normalizedPosition in POSITION_ORDER) {
    return POSITION_ORDER[normalizedPosition];
  }

  return POSITION_ORDER[row.staffCategory] ?? 6;
}
