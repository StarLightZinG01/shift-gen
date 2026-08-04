import Link from "next/link";
import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { CrossWardAssignments } from "@/components/features/my-schedule/CrossWardAssignments";
import { EmptyScheduleState } from "@/components/features/my-schedule/EmptyScheduleState";
import { MyScheduleSummary } from "@/components/features/my-schedule/MyScheduleSummary";
import { MyScheduleTable } from "@/components/features/my-schedule/MyScheduleTable";
import { VersionSelector } from "@/components/features/my-schedule/VersionSelector";
import { formatWardLabel } from "@/lib/my-schedule/formatters";
import type { MySchedulePageData } from "@/lib/my-schedule/types";

type MyScheduleViewProps = {
  data: MySchedulePageData;
};

export function MyScheduleView({ data }: MyScheduleViewProps) {
  if (data.status === "empty") {
    return (
      <main className="container pb-8">
        <EmptyScheduleState data={data} />
      </main>
    );
  }

  const manualScheduleHref = `/home/manual-schedule?manualVersionId=${data.selectedVersionId}&manualWardId=${data.ward.id}`;

  return (
    <main className="container space-y-6 pb-8">
      <section className="rounded-2xl border bg-white px-6 py-8 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand">ตารางเวร</p>
            <h1 className="mt-2 text-3xl font-bold">ตารางเวรของฉัน</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              รอบ {data.cycle.monthLabel} · วอร์ด {formatWardLabel(data.ward)}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <VersionSelector
              options={data.versionOptions}
              value={data.selectedVersionId}
            />
            {data.canManageSchedule ? (
              <Button asChild type="button" className="h-10 rounded-md">
                <Link href={manualScheduleHref}>
                  แก้ไขตารางเวรหลัง GA
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled
              className="h-10 rounded-md"
            >
              <HugeiconsIcon icon={Download01Icon} size={18} />
              ดาวน์โหลด Excel
            </Button>
          </div>
        </div>
      </section>

      <MyScheduleSummary summary={data.summary} />

      <MyScheduleTable
        daysInMonth={data.daysInMonth}
        holidayDays={data.holidayDays}
        month={data.cycle.month}
        year={data.cycle.year}
        rows={data.staffRows}
        compensationSummary={data.compensationSummary}
      />

      <CrossWardAssignments assignments={data.crossWardAssignments} />
    </main>
  );
}
