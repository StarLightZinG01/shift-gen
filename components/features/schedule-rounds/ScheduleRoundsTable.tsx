import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ScheduleRoundRow,
  ScheduleRoundStatus,
} from "@/lib/schedule-rounds/types";

type ScheduleRoundsTableProps = {
  rounds: ScheduleRoundRow[];
};

export function ScheduleRoundsTable({ rounds }: ScheduleRoundsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-[#EAF4F7]">
            <TableRow className="hover:bg-[#EAF4F7]">
              <TableHead className="min-w-36">เดือน/ปี</TableHead>
              <TableHead className="min-w-48">สถานะรอบ</TableHead>
              <TableHead className="min-w-32">วอร์ดส่งข้อมูล</TableHead>
              <TableHead className="min-w-40">เปิดรับคำขอ</TableHead>
              <TableHead className="min-w-40">ปิดรับคำขอ</TableHead>
              <TableHead className="min-w-40">ล็อกข้อมูล</TableHead>
              <TableHead className="min-w-44">เริ่มจัดด้วย GA</TableHead>
              <TableHead className="min-w-44">สร้างรอบเมื่อ</TableHead>
              <TableHead className="min-w-32 text-center">การดำเนินการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rounds.map((round) => (
              <TableRow key={round.id} className="bg-white">
                <TableCell className="font-semibold">{round.monthLabel}</TableCell>
                <TableCell>
                  <ScheduleRoundStatusBadge status={round.status}>
                    {round.statusLabel}
                  </ScheduleRoundStatusBadge>
                </TableCell>
                <TableCell className="font-medium">
                  {round.submittedWards}/{round.totalWards}
                </TableCell>
                <TableCell>{round.requestOpenDateLabel}</TableCell>
                <TableCell>{round.requestCloseDateLabel}</TableCell>
                <TableCell>{round.dataLockDateLabel}</TableCell>
                <TableCell>{round.autoGenerateAtLabel}</TableCell>
                <TableCell>{round.createdAtLabel}</TableCell>
                <TableCell className="text-center">
                  <Button type="button" variant="outline" size="sm" disabled>
                    ดูรายละเอียด
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ScheduleRoundStatusBadge({
  status,
  children,
}: {
  status: ScheduleRoundStatus;
  children: React.ReactNode;
}) {
  const classNameByStatus: Record<ScheduleRoundStatus, string> = {
    preparing: "bg-sky-100 text-sky-700",
    open: "bg-emerald-100 text-emerald-700",
    locked: "bg-amber-100 text-amber-700",
    generating: "bg-violet-100 text-violet-700",
    published: "bg-brand/10 text-brand",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classNameByStatus[status]}`}
    >
      {children}
    </span>
  );
}
