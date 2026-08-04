import {
  CalendarCheckOut01Icon,
  DollarCircleIcon,
  Moon02Icon,
  TaskDaily01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { formatCurrency } from "@/lib/my-schedule/formatters";
import type { MyScheduleSummary as MyScheduleSummaryData } from "@/lib/my-schedule/types";

type MyScheduleSummaryProps = {
  summary: MyScheduleSummaryData;
};

export function MyScheduleSummary({ summary }: MyScheduleSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={TaskDaily01Icon}
        label="จำนวนเวรของฉันในเดือนนี้"
        value={`${summary.myShiftCount}`}
        suffix="เวร"
        tone="teal"
      />
      <SummaryCard
        icon={CalendarCheckOut01Icon}
        label="Off / V / ล"
        value={`${summary.myOffCount} / ${summary.myVacationCount} / ${summary.myLeaveCount}`}
        suffix="วัน"
        tone="green"
      />
      <SummaryCard
        icon={Moon02Icon}
        label="จำนวน OT ของฉัน"
        value={`${summary.myOtCount}`}
        suffix="เวร"
        tone="purple"
      />
      <SummaryCard
        icon={DollarCircleIcon}
        label="ค่าตอบแทนโดยประมาณ"
        value={formatCurrency(summary.estimatedPayAmount)}
        suffix="บาท"
        tone="amber"
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: typeof TaskDaily01Icon;
  label: string;
  value: string;
  suffix: string;
  tone: "teal" | "green" | "purple" | "amber";
}) {
  const toneClassName = {
    teal: "bg-brand/10 text-brand",
    green: "bg-emerald-100 text-emerald-700",
    purple: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-700",
  }[tone];

  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-3 flex items-end gap-2">
            <span className="text-3xl font-bold leading-none">{value}</span>
            <span className="text-sm text-muted-foreground">{suffix}</span>
          </p>
        </div>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneClassName}`}
        >
          <HugeiconsIcon icon={icon} size={20} strokeWidth={2} />
        </div>
      </div>
    </article>
  );
}
