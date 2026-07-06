import { ScheduleRoundsView } from "@/components/features/schedule-rounds/ScheduleRoundsView";
import { getScheduleRoundsDashboardData } from "@/lib/schedule-rounds/queries";

export default async function ScheduleRoundsPage() {
  const dashboardData = await getScheduleRoundsDashboardData();

  return <ScheduleRoundsView {...dashboardData} />;
}
