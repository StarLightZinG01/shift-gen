"use client";

import { useState } from "react";
import {
  Add01Icon,
  CrownIcon,
  Delete02Icon,
  GraduationCapIcon,
  Search01Icon,
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
import { sortStaffRows } from "@/lib/schedule-management/staff-order";
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
  const [staffRows, setStaffRows] = useState(() => sortStaffRows(initialStaffRows));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("th");
  const visibleStaffIds = new Set(
    staffRows
      .filter((row) =>
        normalizedSearch.length === 0
          ? true
          : [row.code, row.fullName].some((value) =>
              value.toLocaleLowerCase("th").includes(normalizedSearch),
            ),
      )
      .map((row) => row.id),
  );

  function handleRemoveRow(row: StaffRow) {
    setStaffRows((currentRows) =>
      currentRows.filter((currentRow) => currentRow.id !== row.id),
    );
  }

  function handleToggleRole(
    rowId: string,
    role: "isHead" | "isNewNurse",
  ) {
    setStaffRows((currentRows) =>
      sortStaffRows(
        currentRows.map((currentRow) =>
          currentRow.id === rowId
            ? role === "isNewNurse"
              ? {
                  ...currentRow,
                  isNewNurse: !currentRow.isNewNurse,
                  isTrainee: !currentRow.isNewNurse,
                }
              : { ...currentRow, isHead: !currentRow.isHead }
            : currentRow,
        ),
      ),
    );
  }

  function handlePayPositionChange(rowId: string, payPosition: string) {
    setStaffRows((currentRows) =>
      sortStaffRows(
        currentRows.map((row) =>
          row.id === rowId ? { ...row, payPosition } : row,
        ),
      ),
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-semibold">4. ข้อมูลบุคลากร</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ward
              ? `แสดงข้อมูลบุคลากรในวอร์ด ${formatWardLabel(ward)}`
              : "ยังไม่มีวอร์ดสำหรับใช้แสดงรายชื่อบุคลากร"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="relative w-full sm:w-72">
            <HugeiconsIcon
              icon={Search01Icon}
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาจากรหัสหรือชื่อ"
              aria-label="ค้นหาบุคลากรจากรหัสหรือชื่อ"
              className="h-9 bg-white pl-9"
            />
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
      </div>

      <div className="[&>[data-slot=table-container]]:h-[480px] [&>[data-slot=table-container]]:overflow-auto">
      <Table className="min-w-[1840px]">
        <TableHeader className="sticky top-0 z-30 bg-[#EAF4F7]">
          <TableRow className="hover:bg-[#EAF4F7]">
            <TableHead className="sticky left-0 z-40 w-16 min-w-16 bg-[#EAF4F7] text-center">
              ลำดับ
            </TableHead>
            <TableHead className="sticky left-16 z-40 w-52 min-w-52 bg-[#EAF4F7] shadow-[8px_0_12px_-12px_rgba(15,23,42,0.55)]">
              ชื่อ
            </TableHead>
            <TableHead className="min-w-28">รหัส</TableHead>
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
                hidden={!visibleStaffIds.has(row.id)}
                onRemove={() => handleRemoveRow(row)}
                onToggleHead={() => handleToggleRole(row.id, "isHead")}
                onToggleTrainee={() =>
                  handleToggleRole(row.id, "isNewNurse")
                }
                onPayPositionChange={(payPosition) =>
                  handlePayPositionChange(row.id, payPosition)
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
          {staffRows.length > 0 && visibleStaffIds.size === 0 ? (
            <TableRow>
              <TableCell
                colSpan={15}
                className="h-28 text-center text-muted-foreground"
              >
                ไม่พบบุคลากรที่ตรงกับคำค้นหา
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      </div>

      <AddStaffDialog
        existingRows={staffRows}
        externalStaffCandidates={externalStaffCandidates}
        onAddStaff={(staffRow) =>
          setStaffRows((currentRows) => sortStaffRows([...currentRows, staffRow]))
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
  hidden,
  onRemove,
  onToggleHead,
  onToggleTrainee,
  onPayPositionChange,
}: {
  row: StaffRow;
  index: number;
  hidden: boolean;
  onRemove: () => void;
  onToggleHead: () => void;
  onToggleTrainee: () => void;
  onPayPositionChange: (payPosition: string) => void;
}) {
  const isExternal = row.rowType === "external";

  return (
    <TableRow className={hidden ? "hidden" : "bg-white"}>
      <TableCell className="sticky left-0 z-20 w-16 min-w-16 bg-white text-center font-medium text-muted-foreground">
        <input name="staffRowKey" type="hidden" value={row.id} />
        <input name={`staff.${row.id}.rowType`} type="hidden" value={row.rowType} />
        <input name={`staff.${row.id}.staffId`} type="hidden" value={row.staffId ?? ""} />
        <input name={`staff.${row.id}.homeWard`} type="hidden" value={row.homeWard} />
        <input
          name={`staff.${row.id}.allowedWards`}
          type="hidden"
          value={row.allowedWards.join(",")}
        />
        <input name={`staff.${row.id}.isHead`} type="hidden" value={String(row.isHead)} />
        <input
          name={`staff.${row.id}.staffCategory`}
          type="hidden"
          value={row.staffCategory}
        />
        <input
          name={`staff.${row.id}.isNewNurse`}
          type="hidden"
          value={String(row.isNewNurse)}
        />
        <input
          name={`staff.${row.id}.canBeInCharge`}
          type="hidden"
          value={String(row.canBeInCharge)}
        />
        {index + 1}
      </TableCell>
      <TableCell className="sticky left-16 z-20 w-52 min-w-52 bg-white shadow-[8px_0_12px_-12px_rgba(15,23,42,0.55)]">
        <Input
          name={`staff.${row.id}.fullName`}
          defaultValue={row.fullName}
          className="h-8 rounded-md"
          readOnly={isExternal}
          required
        />
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
          onBlur={(event) => onPayPositionChange(event.currentTarget.value)}
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
            active={row.isNewNurse}
            icon={GraduationCapIcon}
            label="พยาบาลใหม่"
            tone="trainee"
            onToggle={onToggleTrainee}
          />
          <span className="rounded-md border bg-[#F8FDFE] px-2 py-1 text-xs font-semibold text-muted-foreground">
            {row.staffCategory}
          </span>
          {row.canBeInCharge ? (
            <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
              Incharge
            </span>
          ) : null}
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
