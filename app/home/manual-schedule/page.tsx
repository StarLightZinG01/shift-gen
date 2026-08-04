import { ManualSchedulePanel } from "@/components/features/manual-schedule/ManualSchedulePanel";
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
  const data = await getManualScheduleData({
    versionId: params?.manualVersionId,
    wardId: params?.manualWardId,
  });

  return (
    <main className="container pb-8">
      <ManualSchedulePanel data={data} />
    </main>
  );
}
