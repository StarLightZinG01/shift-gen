import type { CompensationRate } from "@/lib/compensation/types";

export const COMPENSATION_RATE_FALLBACKS: Record<string, CompensationRate> = {
  NA: { otRate: 400, shiftPayRate: 120 },
  PN: { otRate: 450, shiftPayRate: 240 },
  RN: { otRate: 800, shiftPayRate: 360 },
  RNANES: { otRate: 950, shiftPayRate: 950 },
  RNICU: { otRate: 900, shiftPayRate: 900 },
  RNSUC: { otRate: 850, shiftPayRate: 850 },
};

export function normalizePayPosition(value: string | null | undefined) {
  const rawValue = value?.trim();

  if (!rawValue) {
    return "UNKNOWN";
  }

  const normalized = rawValue.toUpperCase().replace(/[-_\s]/g, "");
  return COMPENSATION_RATE_FALLBACKS[normalized] ? normalized : rawValue;
}

export function resolveCompensationRates({
  payPosition,
  otRate,
  shiftPayRate,
}: {
  payPosition: string | null | undefined;
  otRate: unknown;
  shiftPayRate: unknown;
}): CompensationRate {
  const normalizedPayPosition = normalizePayPosition(payPosition);
  const fallback =
    COMPENSATION_RATE_FALLBACKS[normalizedPayPosition] ?? {
      otRate: 0,
      shiftPayRate: 0,
    };
  const staffOtRate = toNumber(otRate);
  const staffShiftPayRate = toNumber(shiftPayRate);

  return {
    otRate: staffOtRate > 0 ? staffOtRate : fallback.otRate,
    shiftPayRate:
      staffShiftPayRate > 0 ? staffShiftPayRate : fallback.shiftPayRate,
  };
}

export function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
