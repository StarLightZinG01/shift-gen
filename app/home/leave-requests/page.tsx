import { getCurrentSession } from "@/lib/auth/session";
import { getLeaveRequestPageData } from "@/lib/leave-requests/queries";

import { LeaveRequestsClient } from "@/components/features/leave-requests/LeaveRequestsClient";

export default async function LeaveRequestsPage() {
  const session = await getCurrentSession();
  const data = await getLeaveRequestPageData(session);

  return <LeaveRequestsClient data={data} />;
}
