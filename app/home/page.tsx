import { getCurrentSession } from "@/lib/auth/session";
import { getHomeDashboardData } from "@/lib/home/queries";

import { HomeDashboard } from "@/components/features/home/HomeDashboard";

export default async function HomePage() {
  const session = await getCurrentSession();
  const dashboardData = await getHomeDashboardData(session);

  return <HomeDashboard data={dashboardData} />;
}
