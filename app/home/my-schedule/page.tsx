import { MyScheduleView } from "@/components/features/my-schedule/MyScheduleView";
import { getCurrentSession } from "@/lib/auth/session";
import { getMySchedulePageData } from "@/lib/my-schedule/queries";

type MySchedulePageProps = {
  searchParams?: Promise<{
    versionId?: string;
  }>;
};

export default async function MySchedulePage({
  searchParams,
}: MySchedulePageProps) {
  const [session, params] = await Promise.all([
    getCurrentSession(),
    searchParams,
  ]);
  const data = await getMySchedulePageData({
    session,
    versionId: params?.versionId,
  });

  return <MyScheduleView data={data} />;
}
