import type { CompensationRate } from "@/lib/compensation/types";

export function normalizePayPosition(value: string | null | undefined) {
  const rawValue = value?.trim();

  if (!rawValue) {
    return "UNKNOWN";
  }

  return rawValue.toUpperCase().replace(/[-_\s]/g, "");
}

export function resolveCompensationRates({
  otRate,
  shiftPayRate,
}: {
  otRate: unknown;
  shiftPayRate: unknown;
}): CompensationRate {
  return {
    otRate: toNumber(otRate),
    shiftPayRate: toNumber(shiftPayRate),
  };
}

export function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
