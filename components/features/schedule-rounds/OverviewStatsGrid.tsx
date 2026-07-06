import { OverviewStatCard } from "@/components/features/schedule-rounds/OverviewStatCard";
import type { OverviewStat } from "@/lib/schedule-rounds/types";

type OverviewStatsGridProps = {
  stats: OverviewStat[];
};

export function OverviewStatsGrid({ stats }: OverviewStatsGridProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <OverviewStatCard key={stat.id} stat={stat} />
      ))}
    </section>
  );
}
