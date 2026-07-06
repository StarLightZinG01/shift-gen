import Link from "next/link";
import { notFound } from "next/navigation";

import { ScheduleManagementView } from "@/components/features/schedule-management/ScheduleManagementView";
import { Button } from "@/components/ui/button";
import {
  getCurrentCycleOrNull,
  getExternalStaffCandidates,
  getRequestSummaryRows,
  getStaffingRequirements,
  getStaffRowsForWard,
  getWardContextById,
} from "@/lib/schedule-management/queries";

type WardScheduleDataDetailPageProps = {
  params: Promise<{
    wardId: string;
  }>;
};

export default async function WardScheduleDataDetailPage({
  params,
}: WardScheduleDataDetailPageProps) {
  const { wardId } = await params;
  const ward = await getWardContextById(wardId);

  if (!ward) {
    notFound();
  }

  const cycle = await getCurrentCycleOrNull();

  if (!cycle) {
    return (
      <div className="container pb-8">
        <Button asChild variant="outline" className="mb-4 rounded-md">
          <Link href="/home/schedule-rounds">กลับไปหน้าข้อมูลการจัดตาราง</Link>
        </Button>
        <section className="rounded-2xl border border-dashed bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold">ยังไม่มีรอบจัดตาราง</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            กรุณาสร้างรอบจัดตารางก่อน จึงจะสามารถตรวจสอบข้อมูลของวอร์ดได้
          </p>
        </section>
      </div>
    );
  }

  const staffRows = await getStaffRowsForWard(ward.id, cycle.id);
  const externalStaffCandidates = await getExternalStaffCandidates(ward.id);
  const requestRows = await getRequestSummaryRows(cycle.id, ward.id);
  const staffingRequirements =
    cycle.id ? await getStaffingRequirements(cycle.id, ward.id) : null;

  return (
    <div className="space-y-4 pb-8">
      <div className="container">
        <Button asChild variant="outline" className="rounded-md">
          <Link href="/home/schedule-rounds">กลับไปหน้าข้อมูลการจัดตาราง</Link>
        </Button>
      </div>
      <ScheduleManagementView
        cycle={cycle}
        externalStaffCandidates={externalStaffCandidates}
        mode="admin"
        requestRows={requestRows}
        staffRows={staffRows}
        staffingRequirements={staffingRequirements}
        ward={ward}
      />
    </div>
  );
}
