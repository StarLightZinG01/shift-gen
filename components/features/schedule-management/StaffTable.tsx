"use client";

import { useState } from "react";
import {
  Add01Icon,
  CrownIcon,
  Delete02Icon,
  GraduationCapIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { AddStaffDialog } from "@/components/features/schedule-management/AddStaffDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatWardLabel } from "@/lib/schedule-management/formatters";
import type {
  ExternalStaffCandidate,
  StaffRow,
  WardContext,
} from "@/lib/schedule-management/types";

type StaffTableProps = {
  canManageWard: boolean;
  initialStaffRows: StaffRow[];
  ward: WardContext | null;
  externalStaffCandidates: ExternalStaffCandidate[];
};

export function StaffTable({
  canManageWard,
  initialStaffRows,
  ward,
  externalStaffCandidates,
}: StaffTableProps) {
  const [staffRows, setStaffRows] = useState(initialStaffRows);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleRemoveRow(row: StaffRow) {
    setStaffRows((currentRows) =>
      currentRows.filter((currentRow) => currentRow.id !== row.id),
    );
  }

  function handleToggleRole(
    rowId: string,
    role: "isHead" | "isTrainee",
  ) {
    setStaffRows((currentRows) =>
      currentRows.map((currentRow) =>
        currentRow.id === rowId
          ? {
              ...currentRow,
              [role]: !currentRow[role],
            }
          : currentRow,
      ),
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">3. ข้อมูลบุคลากร</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ward
              ? `แสดงข้อมูลบุคลากรในวอร์ด ${formatWardLabel(ward)}`
              : "ยังไม่มีวอร์ดสำหรับใช้แสดงรายชื่อบุคลากร"}
          </p>
        </div>
        <Button
          type="button"
          className="h-9 w-full rounded-md sm:w-auto"
          disabled={!canManageWard}
          onClick={() => setDialogOpen(true)}
        >
          <HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />
          เพิ่มบุคลากร
        </Button>
      </div>

      <Table>
        <TableHeader className="bg-[#EAF4F7]">
          <TableRow className="hover:bg-[#EAF4F7]">
            <TableHead className="min-w-16 text-center">ลำดับ</TableHead>
            <TableHead className="min-w-24">รหัส</TableHead>
            <TableHead className="min-w-52">ชื่อ</TableHead>
            <TableHead className="min-w-32">วอร์ดหลัก</TableHead>
            <TableHead className="min-w-44">วอร์ดที่ขึ้นได้</TableHead>
            <TableHead className="min-w-44">ตำแหน่งเบิกจ่าย</TableHead>
            <TableHead className="min-w-28">ค่า OT</TableHead>
            <TableHead className="min-w-28">ค่าเวร (บ)</TableHead>
            <TableHead className="min-w-28">บทบาท</TableHead>
            <TableHead className="min-w-32">O (off)</TableHead>
            <TableHead className="min-w-32">V</TableHead>
            <TableHead className="min-w-24">ล</TableHead>
            <TableHead className="min-w-32">ว</TableHead>
            <TableHead className="min-w-44">วันที่อยากเข้าเวร</TableHead>
            <TableHead className="w-14 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {staffRows.length > 0 ? (
            staffRows.map((row, index) => (
              <StaffTableRow
                key={row.id}
                index={index}
                row={row}
                onRemove={() => handleRemoveRow(row)}
                onToggleHead={() => handleToggleRole(row.id, "isHead")}
                onToggleTrainee={() =>
                  handleToggleRole(row.id, "isTrainee")
                }
              />
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={15}
                className="h-28 text-center text-muted-foreground"
              >
                {ward
                  ? "ยังไม่มีข้อมูลบุคลากรในวอร์ดนี้"
                  : "ไม่มีวอร์ดที่ผูกกับบัญชีนี้"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AddStaffDialog
        existingRows={staffRows}
        externalStaffCandidates={externalStaffCandidates}
        onAddStaff={(staffRow) =>
          setStaffRows((currentRows) => [...currentRows, staffRow])
        }
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        ward={ward}
      />
    </section>
  );
}

function StaffTableRow({
  row,
  index,
  onRemove,
  onToggleHead,
  onToggleTrainee,
}: {
  row: StaffRow;
  index: number;
  onRemove: () => void;
  onToggleHead: () => void;
  onToggleTrainee: () => void;
}) {
  const isExternal = row.rowType === "external";

  return (
    <TableRow className="bg-white">
      <TableCell className="text-center font-medium text-muted-foreground">
        <input name="staffRowKey" type="hidden" value={row.id} />
        <input name={`staff.${row.id}.rowType`} type="hidden" value={row.rowType} />
        <input name={`staff.${row.id}.staffId`} type="hidden" value={row.staffId ?? ""} />
        <input name={`staff.${row.id}.homeWard`} type="hidden" value={row.homeWard} />
        <input name={`staff.${row.id}.isHead`} type="hidden" value={String(row.isHead)} />
        <input
          name={`staff.${row.id}.isTrainee`}
          type="hidden"
          value={String(row.isTrainee)}
        />
        {index + 1}
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.code`}
          defaultValue={row.code}
          className="h-8 rounded-md"
          readOnly={isExternal}
          required
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.fullName`}
          defaultValue={row.fullName}
          className="h-8 rounded-md"
          readOnly={isExternal}
          required
        />
      </TableCell>
      <TableCell>
        <Select defaultValue={row.homeWard} disabled>
          <SelectTrigger className="h-8 rounded-md bg-white">
            <SelectValue placeholder="เลือกวอร์ด" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={row.homeWard}>{row.homeWard}</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          defaultValue={row.allowedWards.join(", ")}
          className="h-8 rounded-md"
          placeholder="เช่น PED3, PICU"
          readOnly
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.payPosition`}
          defaultValue={row.payPosition}
          className="h-8 rounded-md"
          readOnly={isExternal}
          required
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.otRate`}
          type="number"
          min={0}
          step="0.01"
          defaultValue={row.otRate}
          className="h-8 rounded-md"
          readOnly={isExternal}
          required
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.shiftPayRate`}
          type="number"
          min={0}
          step="0.01"
          defaultValue={row.shiftPayRate}
          className="h-8 rounded-md"
          readOnly={isExternal}
          required
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <RoleBadge
            active={row.isHead}
            icon={CrownIcon}
            label="หัวหน้า"
            tone="head"
            onToggle={onToggleHead}
          />
          <RoleBadge
            active={row.isTrainee}
            icon={GraduationCapIcon}
            label="พยาบาลฝึกหัด"
            tone="trainee"
            onToggle={onToggleTrainee}
          />
        </div>
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.off`}
          defaultValue={row.off}
          className="h-8 rounded-md"
          placeholder="1, 5, 20"
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.vacation`}
          defaultValue={row.vacation}
          className="h-8 rounded-md"
          placeholder="1, 5, 20"
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.leave`}
          defaultValue={row.leave}
          className="h-8 rounded-md"
          placeholder="1, 5, 20"
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.academic`}
          defaultValue={row.academic}
          className="h-8 rounded-md"
          placeholder="1, 5, 20"
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.preferredShifts`}
          defaultValue={row.preferredShifts}
          className="h-8 rounded-md"
          placeholder="20:ช, 21:ด"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-md text-red-500 hover:bg-red-50 hover:text-red-600"
          aria-label={`ลบบุคลากร ${row.code}`}
          onClick={onRemove}
        >
          <HugeiconsIcon icon={Delete02Icon} size={17} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

type RoleBadgeProps = {
  active: boolean;
  icon: typeof CrownIcon;
  label: string;
  tone: "head" | "trainee";
  onToggle: () => void;
};

function RoleBadge({ active, icon, label, tone, onToggle }: RoleBadgeProps) {
  const activeClass =
    tone === "head"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : "border-brand bg-brand/10 text-brand";

  return (
    <button
      type="button"
      className={`inline-flex size-8 items-center justify-center rounded-md border ${
        active
          ? activeClass
          : "border-[#DDEBED] bg-white text-muted-foreground hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
      } transition`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onToggle}
    >
      <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} />
    </button>
  );
}
