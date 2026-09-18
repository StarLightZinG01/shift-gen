"use client";

import {
  Moon02Icon,
  Sun01Icon,
  SunCloud01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import type { StaffingRequirements } from "@/lib/schedule-management/types";

type ShiftKey = "morning" | "afternoon" | "night";
type ShiftValue = { rn: number; pnNa: number };
type StaffingValues = Record<ShiftKey, ShiftValue>;

type Props = {
  title: string;
  requirements: StaffingRequirements | null;
  holiday?: boolean;
  className?: string;
};

const SHIFT_PRESENTATION = {
  night: {
    title: "เวรดึก",
    icon: Moon02Icon,
    cardClassName: "border-[#D8CBF0] bg-[#EEE5FA]",
    badgeClassName: "bg-[#DFD2F4] text-[#65439A]",
  },
  morning: {
    title: "เวรเช้า",
    icon: Sun01Icon,
    cardClassName: "border-[#F1DFA0] bg-[#FFF5CC]",
    badgeClassName: "bg-[#FFE9A4] text-[#8A5B00]",
  },
  afternoon: {
    title: "เวรบ่าย",
    icon: SunCloud01Icon,
    cardClassName: "border-[#B9E3F2] bg-[#D9F3FB]",
    badgeClassName: "bg-[#BEEAF7] text-[#006A88]",
  },
} as const;

export function StaffingRequirementFields({
  title,
  requirements,
  holiday = false,
  className,
}: Props) {
  const [values, setValues] = useState<StaffingValues>(() => ({
    morning: getInitialValue(
      holiday ? requirements?.holidayMorning : requirements?.morning,
    ),
    afternoon: getInitialValue(
      holiday ? requirements?.holidayAfternoon : requirements?.afternoon,
    ),
    night: getInitialValue(holiday ? requirements?.holidayNight : requirements?.night),
  }));

  const dayTotal = Object.values(values).reduce(
    (total, requirement) => total + requirement.rn + requirement.pnNa,
    0,
  );

  const updateValue = (shift: ShiftKey, field: keyof ShiftValue, value: number) => {
    setValues((current) => ({
      ...current,
      [shift]: {
        ...current[shift],
        [field]: Math.max(0, Math.trunc(value) || 0),
      },
    }));
  };

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">
          รวมทั้งวัน <strong className="text-foreground">{dayTotal} คน</strong>
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {(Object.keys(SHIFT_PRESENTATION) as ShiftKey[]).map((shift) => {
          const presentation = SHIFT_PRESENTATION[shift];
          const namePrefix = getNamePrefix(shift, holiday);

          return (
            <div
              key={shift}
              className={`rounded-lg border p-4 ${presentation.cardClassName}`}
            >
              <div className="mb-4 space-y-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.badgeClassName}`}
                >
                  <HugeiconsIcon icon={presentation.icon} size={15} strokeWidth={2} />
                  {presentation.title}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={UserGroupIcon} size={15} strokeWidth={1.8} />
                  รวม <strong className="text-foreground">{values[shift].rn + values[shift].pnNa} คน</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StaffingNumberInput
                  name={`${namePrefix}RnRequired`}
                  label="RN ที่ต้องจัด"
                  value={values[shift].rn}
                  onChange={(value) => updateValue(shift, "rn", value)}
                />
                <StaffingNumberInput
                  name={`${namePrefix}PnNaRequired`}
                  label="PN/NA ที่ต้องจัด"
                  value={values[shift].pnNa}
                  onChange={(value) => updateValue(shift, "pnNa", value)}
                />
              </div>

              <input
                type="hidden"
                name={`${namePrefix}Min`}
                value={values[shift].rn + values[shift].pnNa}
              />
              <input
                type="hidden"
                name={`${namePrefix}Max`}
                value={values[shift].rn + values[shift].pnNa}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StaffingNumberInput({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <Label
        htmlFor={name}
        className="mb-2 flex min-h-8 items-start text-xs leading-4 text-muted-foreground"
      >
        {label}
      </Label>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full appearance-none rounded-md border border-border/80 bg-white px-3 text-center text-sm font-semibold shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        required
      />
    </div>
  );
}

function getInitialValue(
  requirement: StaffingRequirements["morning"] | undefined,
): ShiftValue {
  return {
    rn: requirement?.rnRequired ?? 0,
    pnNa: requirement?.pnNaRequired ?? 0,
  };
}

function getNamePrefix(shift: ShiftKey, holiday: boolean) {
  if (!holiday) {
    return shift;
  }

  return `holiday${shift.charAt(0).toUpperCase()}${shift.slice(1)}`;
}
