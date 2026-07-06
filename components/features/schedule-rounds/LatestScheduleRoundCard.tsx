import { Button } from "@/components/ui/button";
import type { LatestScheduleRound } from "@/lib/schedule-rounds/types";

type LatestScheduleRoundCardProps = {
  round: LatestScheduleRound;
  onViewDetails: () => void;
};

export function LatestScheduleRoundCard({
  round,
  onViewDetails,
}: LatestScheduleRoundCardProps) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            สถานะรอบจัดตารางล่าสุด
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-normal">
            {round.monthLabel}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              {round.statusLabel}
            </span>
          </div>
        </div>

        <Button
          type="button"
          onClick={onViewDetails}
          className="h-10 rounded-md px-5 shadow-sm"
        >
          ดูรายละเอียดรอบนี้
          <span aria-hidden="true" className="text-lg leading-none">
            ›
          </span>
        </Button>
      </div>
    </section>
  );
}
