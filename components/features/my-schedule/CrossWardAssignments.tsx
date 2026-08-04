import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MyScheduleAssignment } from "@/lib/my-schedule/types";

type CrossWardAssignmentsProps = {
  assignments: MyScheduleAssignment[];
};

export function CrossWardAssignments({
  assignments,
}: CrossWardAssignmentsProps) {
  if (assignments.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">เวรข้ามวอร์ดของฉัน</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          แสดงเฉพาะเวรของคุณที่ถูกจัดไปขึ้นวอร์ดอื่น
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-[#EAF4F7]">
            <TableRow className="hover:bg-[#EAF4F7]">
              <TableHead>วันที่</TableHead>
              <TableHead>วอร์ด</TableHead>
              <TableHead>เวร</TableHead>
              <TableHead>OT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => (
              <TableRow key={assignment.id} className="bg-white">
                <TableCell className="font-medium">
                  วันที่ {assignment.day}
                </TableCell>
                <TableCell>
                  {assignment.wardCode} - {assignment.wardName}
                </TableCell>
                <TableCell>{assignment.shiftCode}</TableCell>
                <TableCell>
                  {assignment.isOt ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      OT
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
