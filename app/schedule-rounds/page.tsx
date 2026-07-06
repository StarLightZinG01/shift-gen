import { ScheduleRoundsView } from "@/components/features/schedule-rounds/ScheduleRoundsView";
import { getScheduleRoundsDashboardData } from "@/lib/schedule-rounds/queries";

export default async function ScheduleRoundsPage() {
  const dashboardData = await getScheduleRoundsDashboardData();

  return (
    <div className="min-h-svh bg-[#F8FDFE] p-4">
      <ScheduleRoundsView {...dashboardData} />
    </div>
  );
}
