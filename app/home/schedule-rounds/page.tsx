import { ScheduleRoundsView } from "@/components/features/schedule-rounds/ScheduleRoundsView";
import { getScheduleRoundsDashboardData } from "@/lib/schedule-rounds/queries";
import type { AdminTabId } from "@/lib/schedule-rounds/types";

type ScheduleRoundsPageProps = {
  searchParams?: Promise<{
    compensationVersionId?: string;
    manualVersionId?: string;
    manualWardId?: string;
    tab?: string;
  }>;
};

export default async function ScheduleRoundsPage({
  searchParams,
}: ScheduleRoundsPageProps) {
  const params = await searchParams;
  const dashboardData = await getScheduleRoundsDashboardData({
    compensationVersionId: params?.compensationVersionId,
    manualVersionId: params?.manualVersionId,
    manualWardId: params?.manualWardId,
  });

  return (
    <ScheduleRoundsView
      {...dashboardData}
      initialActiveTab={normalizeTab(params?.tab)}
    />
  );
}

function normalizeTab(value: string | undefined): AdminTabId | undefined {
  if (
    value === "system-overview" ||
    value === "user-management" ||
    value === "schedule-data" ||
    value === "schedule-rounds" ||
    value === "compensation" ||
    value === "manual-schedule" ||
    value === "ga-settings"
  ) {
    return value;
  }

  return undefined;
}
