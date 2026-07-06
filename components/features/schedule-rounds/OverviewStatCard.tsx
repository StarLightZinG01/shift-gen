import {
  AiUserIcon,
  CalendarCheckOut01Icon,
  CalendarSetting01Icon,
  DatabaseIcon,
  Hospital02Icon,
  UserGroupIcon,
  UserShield01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { OverviewStat, OverviewStatTone } from "@/lib/schedule-rounds/types";

const iconByStatId = {
  "total-users": AiUserIcon,
  "ward-heads": UserShield01Icon,
  "clinical-staff": UserGroupIcon,
  "total-wards": Hospital02Icon,
  "submitted-wards": CalendarCheckOut01Icon,
  "pending-wards": DatabaseIcon,
  "running-ga": CalendarSetting01Icon,
  "published-schedules": CalendarCheckOut01Icon,
} as const;

const toneClassName: Record<OverviewStatTone, string> = {
  teal: "bg-brand/10 text-brand",
  blue: "bg-sky-100 text-sky-700",
  green: "bg-emerald-100 text-emerald-700",
  purple: "bg-violet-100 text-violet-700",
  yellow: "bg-amber-100 text-amber-700",
  gray: "bg-slate-100 text-slate-600",
};

type OverviewStatCardProps = {
  stat: OverviewStat;
};

export function OverviewStatCard({ stat }: OverviewStatCardProps) {
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            {stat.label}
          </p>
          <p className="text-4xl font-bold tracking-normal text-foreground">
            {stat.value}
          </p>
        </div>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneClassName[stat.tone]}`}
        >
          <HugeiconsIcon icon={iconByStatId[stat.id]} size={20} />
        </div>
      </div>
    </article>
  );
}
