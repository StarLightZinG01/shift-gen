import { ManualSchedulePanel } from "@/components/features/manual-schedule/ManualSchedulePanel";
import { getCurrentSession } from "@/lib/auth/current-session";
import { getManualScheduleData } from "@/lib/manual-schedule/queries";

type ManualSchedulePageProps = {
  searchParams?: Promise<{
    manualVersionId?: string;
    manualWardId?: string;
  }>;
};

export default async function ManualSchedulePage({
  searchParams,
}: ManualSchedulePageProps) {
  const params = await searchParams;
  const session = await getCurrentSession();
  const data = await getManualScheduleData({
    versionId: params?.manualVersionId,
    wardId: params?.manualWardId,
    session,
  });

  return (
    <main className="container pb-8">
      <ManualSchedulePanel data={data} />
    </main>
  );
}
