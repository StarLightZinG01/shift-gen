"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Add01Icon,
  AlertCircleIcon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Edit03Icon,
  SaveIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  addAssignmentAction,
  cancelManualVersionAction,
  createManualVersionAction,
  deleteScheduleVersionAction,
  publishManualVersionAction,
  replaceAssignmentStaffAction,
  updateAssignmentShiftAction,
} from "@/app/actions/manual-schedule";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { HorizontalScrollArea } from "@/components/features/schedule-table/HorizontalScrollArea";
import { editableShiftCodes } from "@/lib/manual-schedule/validation";
import type {
  ManualScheduleCell,
  ManualScheduleData,
  ManualScheduleRow,
  ManualScheduleStaffOption,
  ManualScheduleViolation,
} from "@/lib/manual-schedule/types";
import { cn } from "@/lib/utils";

type ManualSchedulePanelProps = {
  data: ManualScheduleData;
};

const workShiftCodes = ["ด", "ช", "บ"] as const;
const noteShiftCodes = ["V", "ว", "ล"] as const;

export function ManualSchedulePanel({ data }: ManualSchedulePanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [editingCell, setEditingCell] = useState<ManualScheduleCell | null>(
    null,
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCancelEditOpen, setIsCancelEditOpen] = useState(false);

  const days = useMemo(
    () => Array.from({ length: data.daysInMonth }, (_, index) => index + 1),
    [data.daysInMonth],
  );
  const dayMetas = useMemo(
    () => {
      const holidayDaySet = new Set(data.holidayDays);

      return days.map((day) =>
        buildDayMeta(day, data.version?.month ?? 1, data.version?.year ?? 1970, holidayDaySet),
      );
    },
    [data.holidayDays, data.version?.month, data.version?.year, days],
  );
  const regularWorkTarget = useMemo(
    () => dayMetas.filter((day) => !day.isHoliday).length,
    [dayMetas],
  );
  const dailyTotals = useMemo(
    () => buildDailyTotals(data.rows, days),
    [data.rows, days],
  );
  const summaryByStaffId = useMemo(
    () =>
      new Map(
        data.rows.map((row) => [row.staffId, summarizeManualRow(row, regularWorkTarget)]),
      ),
    [data.rows, regularWorkTarget],
  );
  const footerSummary = useMemo(
    () => summarizeAllManualRows(Array.from(summaryByStaffId.values())),
    [summaryByStaffId],
  );

  function navigateWith(params: Record<string, string | null>) {
    const searchParams = new URLSearchParams();

    if (pathname.includes("schedule-rounds")) {
      searchParams.set("tab", "manual-schedule");
    }

    if (data.version?.id) {
      searchParams.set("manualVersionId", data.version.id);
    }

    if (data.selectedWardId) {
      searchParams.set("manualWardId", data.selectedWardId);
    }

    for (const [key, value] of Object.entries(params)) {
      if (value) {
        searchParams.set(key, value);
      } else {
        searchParams.delete(key);
      }
    }

    router.push(`${pathname}?${searchParams.toString()}`);
  }

  function handleCreateManualVersion() {
    if (!data.version?.id) {
      return;
    }

    startTransition(async () => {
      const result = await createManualVersionAction(data.version!.id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      navigateWith({
        manualVersionId: result.versionId ?? null,
        manualWardId: data.selectedWardId,
      });
      router.refresh();
    });
  }

  function handlePublish() {
    if (!data.version?.id) {
      return;
    }

    startTransition(async () => {
      const result = await publishManualVersionAction(data.version!.id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  function handleDeleteVersion() {
    if (!data.version?.id) {
      return;
    }

    startTransition(async () => {
      const result = await deleteScheduleVersionAction(data.version!.id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setIsDeleteOpen(false);
      navigateWith({
        manualVersionId: null,
        manualWardId: null,
      });
      router.refresh();
    });
  }

  function handleCancelManualVersion() {
    if (!data.version?.id) {
      return;
    }

    startTransition(async () => {
      const result = await cancelManualVersionAction(data.version!.id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setIsCancelEditOpen(false);
      navigateWith({
        manualVersionId: result.versionId ?? null,
        manualWardId: data.selectedWardId,
      });
      router.refresh();
    });
  }

  if (!data.version) {
    return (
      <section className="rounded-2xl border border-dashed bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <HugeiconsIcon icon={Calendar03Icon} size={24} strokeWidth={2} />
        </div>
        <h2 className="mt-4 text-xl font-semibold">ยังไม่มีตารางเวรให้แก้ไข</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          เมื่อ GA สร้างตารางเวรแล้ว ตารางจะมาแสดงที่นี่เพื่อให้ผู้ดูแลระบบหรือหัวหน้าวอร์ดแก้ไขแบบ manual ได้
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">แก้ไขตารางเวรหลัง GA</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              เลือกเวอร์ชันตารางและวอร์ดที่ต้องการแก้ไข ระบบจะสร้างเวอร์ชัน manual แยกจากผล GA เดิมก่อนเริ่มแก้ไข
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill label={data.version.cycleLabel} />
              <StatusPill label={data.selectedWardLabel || "ยังไม่ได้เลือกวอร์ด"} />
              <StatusPill label={`v${data.version.versionNo}`} />
              <StatusPill
                label={data.version.source === "manual" ? "Manual" : "GA"}
                tone={data.version.source === "manual" ? "teal" : "blue"}
              />
              <StatusPill
                label={data.version.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                tone={data.version.status === "published" ? "green" : "amber"}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
            <div className="space-y-1.5">
              <Label>เวอร์ชันตาราง</Label>
              <Select
                value={data.version.id}
                onValueChange={(value) =>
                  navigateWith({
                    manualVersionId: value,
                    manualWardId: data.selectedWardId,
                  })
                }
              >
                <SelectTrigger className="h-10 w-full rounded-md bg-white">
                  <SelectValue placeholder="เลือกเวอร์ชัน" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-80">
                  {data.versionOptions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>วอร์ด</Label>
              <Select
                value={data.selectedWardId ?? undefined}
                onValueChange={(value) =>
                  navigateWith({
                    manualVersionId: data.version?.id ?? null,
                    manualWardId: value,
                  })
                }
              >
                <SelectTrigger className="h-10 w-full rounded-md bg-white">
                  <SelectValue placeholder="เลือกวอร์ด" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-80">
                  {data.wardOptions.map((ward) => (
                    <SelectItem key={ward.id} value={ward.id}>
                      {ward.code} - {ward.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <GaScoreCard score={data.version.gaScore} />

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="destructive"
            className="rounded-md sm:mr-auto"
            disabled={isPending}
            onClick={() => setIsDeleteOpen(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} size={17} strokeWidth={2} />
            ลบตารางเวรนี้
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-md"
            disabled={!data.canEdit || !data.version.parentVersionId || isPending}
            onClick={() => setIsCancelEditOpen(true)}
          >
            ยกเลิกการแก้ไข
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-md"
            disabled={!data.canCreateManualVersion || isPending}
            onClick={handleCreateManualVersion}
          >
            <HugeiconsIcon icon={Edit03Icon} size={17} strokeWidth={2} />
            สร้างฉบับแก้ไข
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-md"
            disabled={!data.canEdit || isPending}
            onClick={() => setIsAddOpen(true)}
          >
            <HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />
            เพิ่มเวร
          </Button>
          <Button
            type="button"
            className="rounded-md"
            disabled={!data.canPublish || isPending}
            onClick={handlePublish}
          >
            <HugeiconsIcon icon={SaveIcon} size={17} strokeWidth={2} />
            เผยแพร่ฉบับแก้ไข
          </Button>
        </div>
      </section>

      {!data.canEdit ? (
        <section className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={20}
            strokeWidth={2}
            className="mt-0.5 shrink-0"
          />
          <div>
            ตารางนี้ยังแก้ไขไม่ได้โดยตรง หากต้องการแก้ไขให้กด “สร้างฉบับแก้ไข”
            ก่อน ระบบจะคัดลอกตารางเดิมเป็นเวอร์ชัน manual แยกไว้ให้
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b p-5">
          <h3 className="font-semibold">ตารางเวร</h3>
          <p className="text-sm text-muted-foreground">
            กดช่องวันที่ต้องการเพื่อเปลี่ยนเวร ระบบจะบันทึกประวัติการแก้ไขทุกครั้ง
          </p>
        </div>

        <HorizontalScrollArea className="max-h-[620px]" minWidth={1520}>
          <Table className="min-w-[1520px] border-collapse">
            <TableHeader className="sticky top-0 z-10 bg-[#EEF7F8]">
              <TableRow className="hover:bg-[#EAF7F7]">
                <TableHead
                  rowSpan={2}
                  className="sticky left-0 z-20 w-[132px] min-w-[132px] bg-[#D6F4F1] text-center align-middle text-brand sm:w-[180px] sm:min-w-[180px] md:w-[220px] md:min-w-[220px]"
                >
                  บุคลากร
                </TableHead>
                {dayMetas.map(({ day, isHoliday }) => (
                  <TableHead
                    key={day}
                    className={cn(
                      "min-w-10 border border-[#DDEBED] px-1 text-center text-slate-900",
                      isHoliday ? "bg-[#E4F7F5] text-brand" : "bg-white",
                    )}
                  >
                    {day}
                  </TableHead>
                ))}
                <TableHead
                  colSpan={2}
                  className="border border-[#DDEBED] bg-[#E4F7F5] text-center text-brand"
                >
                  วันทำการ
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="min-w-12 border border-[#DDEBED] bg-amber-400 px-1 text-center align-middle text-slate-950"
                >
                  OT
                  <br />
                  รวม
                </TableHead>
                <TableHead
                  colSpan={4}
                  className="border border-[#DDEBED] bg-brand/10 text-center text-brand"
                >
                  จำนวนOT
                </TableHead>
                <TableHead
                  colSpan={4}
                  className="border border-[#DDEBED] bg-[#F0FAF9] text-center text-brand"
                >
                  จำนวนวันทำการ
                </TableHead>
                <TableHead
                  colSpan={3}
                  className="border border-[#DDEBED] bg-slate-50 text-center text-slate-700"
                >
                  หมายเหตุ
                </TableHead>
              </TableRow>
              <TableRow className="hover:bg-[#EAF7F7]">
                {dayMetas.map(({ day, weekday, isHoliday }) => (
                  <TableHead
                    key={`weekday-${day}`}
                    className={cn(
                      "min-w-10 border border-[#DDEBED] px-1 py-1 text-center text-xs font-medium",
                      isHoliday ? "bg-[#E4F7F5] text-brand" : "bg-white text-slate-600",
                    )}
                  >
                    {weekday}
                  </TableHead>
                ))}
                <TableHead className="min-w-12 border border-[#DDEBED] bg-[#E4F7F5] px-1 text-center text-brand">
                  ราชการ
                </TableHead>
                <TableHead className="min-w-12 border border-[#DDEBED] bg-[#E4F7F5] px-1 text-center text-brand">
                  จริง
                </TableHead>
                {workShiftCodes.map((code) => (
                  <TableHead
                    key={`ot-${code}`}
                    className="min-w-11 border border-[#DDEBED] bg-brand/10 px-1 text-center text-brand"
                  >
                    {code}ot
                  </TableHead>
                ))}
                <TableHead className="min-w-12 border border-[#DDEBED] bg-brand/10 px-1 text-center text-brand">
                  OTรวม
                </TableHead>
                {workShiftCodes.map((code) => (
                  <TableHead
                    key={`work-${code}`}
                    className="min-w-10 border border-[#DDEBED] bg-[#F0FAF9] px-1 text-center text-brand"
                  >
                    {code}
                  </TableHead>
                ))}
                <TableHead className="min-w-14 border border-[#DDEBED] bg-[#F0FAF9] px-1 text-center text-brand">
                  รวมทำการ
                </TableHead>
                {noteShiftCodes.map((code) => (
                  <TableHead
                    key={`note-${code}`}
                    className="min-w-10 border border-[#DDEBED] bg-slate-50 px-1 text-center text-slate-600"
                  >
                    {code}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => {
                const summary = summaryByStaffId.get(row.staffId) ?? createEmptyManualSummary();

                return (
                  <TableRow key={row.staffId}>
                    <TableCell className="sticky left-0 z-10 w-[132px] min-w-[132px] bg-white sm:w-[180px] sm:min-w-[180px] md:w-[220px] md:min-w-[220px]">
                      <div className="truncate font-medium">{row.staffCode}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {row.fullName}
                      </div>
                    </TableCell>
                    {row.cells.map((cell) => {
                      const hasViolation = cell.violations.length > 0;
                      const hasError = cell.violations.some(isErrorViolation);
                      const dayMeta = dayMetas[cell.day - 1];

                      return (
                        <TableCell
                          key={`${row.staffId}-${cell.day}`}
                          className={cn(
                            "border border-[#DDEBED] p-1.5",
                            dayMeta?.isHoliday && "bg-[#F3FBFA]",
                          )}
                        >
                          <button
                            type="button"
                            disabled={!data.canEdit}
                            onClick={() => setEditingCell(cell)}
                            title={formatCellViolationTitle(cell)}
                            className={cn(
                              "relative flex h-10 w-full items-center justify-center rounded-md border text-sm font-semibold transition",
                              cell.shiftCode === "0"
                                ? "border-slate-200 bg-slate-50 text-slate-400"
                                : "border-teal-200 bg-teal-50 text-brand hover:bg-teal-100",
                              hasViolation &&
                                (hasError
                                  ? "border-rose-300 bg-rose-50 text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100"
                                  : "border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"),
                              cell.isEdited && "ring-2 ring-amber-300",
                              data.canEdit && "cursor-pointer hover:border-brand",
                              !data.canEdit && "cursor-default opacity-80",
                            )}
                          >
                            {formatShiftWithOt(cell.shiftCode, cell.isOt, cell.otShifts)}
                            {hasViolation ? (
                              <span
                                className={cn(
                                  "absolute right-1 top-1 size-1.5 rounded-full",
                                  hasError ? "bg-rose-500" : "bg-amber-500",
                                )}
                              />
                            ) : null}
                          </button>
                        </TableCell>
                      );
                    })}
                    <ManualSummaryCell tone="holiday">{summary.regularWorkTarget}</ManualSummaryCell>
                    <ManualSummaryCell tone="holiday">{summary.actualWorkTotal}</ManualSummaryCell>
                    <ManualSummaryCell tone="otTotal">{summary.overtimeTotal}</ManualSummaryCell>
                    {workShiftCodes.map((code) => (
                      <ManualSummaryCell key={`${row.staffId}-ot-${code}`} tone="ot">
                        {summary.otShiftCounts[code]}
                      </ManualSummaryCell>
                    ))}
                    <ManualSummaryCell tone="ot">{summary.markedOtTotal}</ManualSummaryCell>
                    {workShiftCodes.map((code) => (
                      <ManualSummaryCell key={`${row.staffId}-${code}`}>
                        {summary.shiftCounts[code]}
                      </ManualSummaryCell>
                    ))}
                    <ManualSummaryCell tone="green">{summary.regularWorkTotal}</ManualSummaryCell>
                    {noteShiftCodes.map((code) => (
                      <ManualSummaryCell key={`${row.staffId}-${code}`} tone="note">
                        {summary.noteCounts[code]}
                      </ManualSummaryCell>
                    ))}
                  </TableRow>
                );
              })}
              {workShiftCodes.map((code, index) => (
                <TableRow key={`daily-total-${code}`} className="hover:bg-white">
                  <TableCell className="sticky left-0 z-10 border-r bg-white text-right text-sm font-semibold text-brand">
                    {code}
                  </TableCell>
                  {dayMetas.map(({ day, isHoliday }) => (
                    <TableCell
                      key={`${code}-${day}`}
                      className={cn(
                        "border border-[#DDEBED] px-2 py-2 text-center text-sm font-medium text-slate-700",
                        isHoliday ? "bg-[#F3FBFA]" : "bg-white",
                      )}
                    >
                      {dailyTotals[day]?.[code] ?? 0}
                    </TableCell>
                  ))}
                  <ManualSummaryCell tone={index === 0 ? "total" : "muted"}>
                    {index === 0 ? footerSummary.regularWorkTarget : "-"}
                  </ManualSummaryCell>
                  <ManualSummaryCell tone={index === 0 ? "total" : "muted"}>
                    {index === 0 ? footerSummary.actualWorkTotal : "-"}
                  </ManualSummaryCell>
                  <ManualSummaryCell tone={index === 0 ? "total" : "muted"}>
                    {index === 0 ? footerSummary.overtimeTotal : "-"}
                  </ManualSummaryCell>
                  {workShiftCodes.map((targetCode) => (
                    <ManualSummaryCell
                      key={`${code}-ot-${targetCode}`}
                      tone={index === 0 ? "total" : "muted"}
                    >
                      {index === 0 ? footerSummary.otShiftCounts[targetCode] : "-"}
                    </ManualSummaryCell>
                  ))}
                  <ManualSummaryCell tone={index === 0 ? "total" : "muted"}>
                    {index === 0 ? footerSummary.markedOtTotal : "-"}
                  </ManualSummaryCell>
                  {workShiftCodes.map((targetCode) => (
                    <ManualSummaryCell
                      key={`${code}-work-${targetCode}`}
                      tone={index === 0 ? "total" : "muted"}
                    >
                      {index === 0 ? footerSummary.shiftCounts[targetCode] : "-"}
                    </ManualSummaryCell>
                  ))}
                  <ManualSummaryCell tone={index === 0 ? "total" : "muted"}>
                    {index === 0 ? footerSummary.regularWorkTotal : "-"}
                  </ManualSummaryCell>
                  {noteShiftCodes.map((targetCode) => (
                    <ManualSummaryCell
                      key={`${code}-note-${targetCode}`}
                      tone={index === 0 ? "total" : "muted"}
                    >
                      {index === 0 ? footerSummary.noteCounts[targetCode] : "-"}
                    </ManualSummaryCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </HorizontalScrollArea>

        {data.rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูลตารางเวรของวอร์ดนี้
          </div>
        ) : null}
      </section>

      {data.violations.length > 0 ? (
        <ViolationReport violations={data.violations} />
      ) : null}

      {data.coverageWarnings.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="font-semibold text-amber-950">คำเตือนกำลังคน</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {data.coverageWarnings.map((warning) => (
              <div
                key={`${warning.day}-${warning.shiftCode}`}
                className="rounded-lg bg-white px-3 py-2 text-sm text-amber-900"
              >
                {warning.message}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ManualChangeHistory data={data} />

      {editingCell ? (
        <EditShiftDialog
          key={`${editingCell.staffId}-${editingCell.day}-${editingCell.assignmentId ?? "empty"}`}
          cell={editingCell}
          staffOptions={data.staffOptions}
          open
          disabled={isPending}
          onOpenChange={(open) => {
            if (!open) {
              setEditingCell(null);
            }
          }}
          onSubmit={(shiftCode, staffId, otShifts, reason) => {
            if (!data.version?.id || !data.selectedWardId) {
              return;
            }

            startTransition(async () => {
              let result:
                | Awaited<ReturnType<typeof replaceAssignmentStaffAction>>
                | Awaited<ReturnType<typeof updateAssignmentShiftAction>>
                | Awaited<ReturnType<typeof addAssignmentAction>>
                | null = null;

              if (!editingCell.assignmentId) {
                if (shiftCode === "0") {
                  toast.message("ยังไม่มีข้อมูลที่เปลี่ยนแปลง");
                  return;
                }

                result = await addAssignmentAction({
                  scheduleVersionId: data.version!.id,
                  wardId: data.selectedWardId!,
                  staffId,
                  day: editingCell.day,
                  shiftCode,
                  otShifts,
                  reason,
                });

                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
              } else if (staffId !== editingCell.staffId) {
                result = await replaceAssignmentStaffAction({
                  assignmentId: editingCell.assignmentId!,
                  newStaffId: staffId,
                  reason,
                });

                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
              }

              if (
                editingCell.assignmentId &&
                (
                  shiftCode !== editingCell.shiftCode ||
                  normalizeOtValue(otShifts) !== normalizeOtValue(editingCell.otShifts)
                )
              ) {
                result = await updateAssignmentShiftAction({
                  assignmentId: editingCell.assignmentId!,
                  newShiftCode: shiftCode,
                  otShifts,
                  reason,
                });

                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
              }

              if (!result) {
                toast.message("ยังไม่มีข้อมูลที่เปลี่ยนแปลง");
                return;
              }

              toast.success(result.message);
              setEditingCell(null);
              router.refresh();
            });
          }}
        />
      ) : null}

      <AddAssignmentDialog
        data={data}
        open={isAddOpen}
        disabled={isPending}
        onOpenChange={setIsAddOpen}
        onSubmit={(values) => {
          if (!data.version?.id || !data.selectedWardId) {
            return;
          }

          startTransition(async () => {
            const result = await addAssignmentAction({
              scheduleVersionId: data.version!.id,
              wardId: data.selectedWardId!,
              staffId: values.staffId,
              day: values.day,
              shiftCode: values.shiftCode,
              otShifts: values.otShifts,
              reason: values.reason,
            });

            if (!result.ok) {
              toast.error(result.message);
              return;
            }

            toast.success(result.message);
            setIsAddOpen(false);
            router.refresh();
          });
        }}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบตารางเวร</AlertDialogTitle>
            <AlertDialogDescription>
              การลบนี้จะลบตารางเวรเวอร์ชัน v{data.version.versionNo} ออกจากระบบ
              รวมถึงรายการเวร ประวัติการแก้ไข และสรุปค่าตอบแทนที่ผูกกับตารางนี้
              ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={handleDeleteVersion}
            >
              {isPending ? "กำลังลบ..." : "ลบตารางเวร"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCancelEditOpen} onOpenChange={setIsCancelEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยกเลิกการแก้ไขตารางเวร</AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะลบฉบับแก้ไข manual version v{data.version.versionNo} และกลับไปใช้ตารางต้นฉบับ
              การเปลี่ยนแปลงที่ทำไว้ในฉบับนี้จะหายไป แต่ตารางต้นฉบับจะยังอยู่เหมือนเดิม
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>ไม่ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={handleCancelManualVersion}
            >
              {isPending ? "กำลังยกเลิก..." : "ยืนยันยกเลิกการแก้ไข"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditShiftDialog({
  cell,
  staffOptions,
  open,
  disabled,
  onOpenChange,
  onSubmit,
}: {
  cell: ManualScheduleCell;
  staffOptions: ManualScheduleStaffOption[];
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    shiftCode: string,
    staffId: string,
    otShifts: string | null,
    reason: string,
  ) => void;
}) {
  const [shiftCode, setShiftCode] = useState(cell.shiftCode);
  const [staffId, setStaffId] = useState(cell.staffId);
  const [otShifts, setOtShifts] = useState(cell.otShifts ?? "none");
  const [reason, setReason] = useState("");
  const otOptions = getOtOptions(shiftCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>แก้ไขเวรวันที่ {cell.day}</DialogTitle>
          <DialogDescription>
            {cell.staffCode} {cell.fullName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>บุคลากร</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="เลือกบุคลากร" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-80">
                {staffOptions.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {formatStaffOption(staff)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>เวรใหม่</Label>
            <Select
              value={shiftCode}
              onValueChange={(value) => {
                setShiftCode(value);
                setOtShifts("none");
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="เลือกเวร" />
              </SelectTrigger>
              <SelectContent position="popper">
                {editableShiftCodes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {formatShiftCode(code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>OT</Label>
            <Select
              value={otShifts}
              onValueChange={setOtShifts}
              disabled={otOptions.length <= 1}
            >
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="เลือก OT" />
              </SelectTrigger>
              <SelectContent position="popper">
                {otOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>เหตุผลการแก้ไข</Label>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="ระบุเหตุผลเพื่อเก็บประวัติ"
              className="h-10 rounded-md bg-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-md"
            onClick={() => onOpenChange(false)}
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            className="rounded-md"
            disabled={disabled}
            onClick={() =>
              onSubmit(
                shiftCode,
                staffId,
                otShifts === "none" ? null : otShifts,
                reason,
              )
            }
          >
            บันทึกการแก้ไข
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAssignmentDialog({
  data,
  open,
  disabled,
  onOpenChange,
  onSubmit,
}: {
  data: ManualScheduleData;
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    staffId: string;
    day: number;
    shiftCode: string;
    otShifts: string | null;
    reason: string;
  }) => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [day, setDay] = useState("1");
  const [shiftCode, setShiftCode] = useState("ช");
  const [otShifts, setOtShifts] = useState("none");
  const [reason, setReason] = useState("");
  const days = Array.from({ length: data.daysInMonth }, (_, index) => index + 1);
  const otOptions = getOtOptions(shiftCode);

  function handleSubmit() {
    if (!staffId) {
      toast.error("กรุณาเลือกบุคลากร");
      return;
    }

    onSubmit({
      staffId,
      day: Number(day),
      shiftCode,
      otShifts: otShifts === "none" ? null : otShifts,
      reason,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>เพิ่มเวรในตาราง</DialogTitle>
          <DialogDescription>
            เพิ่มเวรให้บุคลากรที่สามารถขึ้นเวรในวอร์ดนี้ได้ ระบบจะตรวจซ้ำก่อนบันทึก
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>บุคลากร</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="เลือกบุคลากร" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-80">
                {data.staffOptions.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {formatStaffOption(staff)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>วันที่</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="เลือกวันที่" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-80">
                {days.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    วันที่ {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>เวร</Label>
            <Select
              value={shiftCode}
              onValueChange={(value) => {
                setShiftCode(value);
                setOtShifts("none");
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="เลือกเวร" />
              </SelectTrigger>
              <SelectContent position="popper">
                {editableShiftCodes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {formatShiftCode(code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>OT</Label>
            <Select
              value={otShifts}
              onValueChange={setOtShifts}
              disabled={otOptions.length <= 1}
            >
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="เลือก OT" />
              </SelectTrigger>
              <SelectContent position="popper">
                {otOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>เหตุผล</Label>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="ระบุเหตุผลเพื่อเก็บประวัติ"
              className="h-10 rounded-md bg-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-md"
            onClick={() => onOpenChange(false)}
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            className="rounded-md"
            disabled={disabled}
            onClick={handleSubmit}
          >
            เพิ่มเวร
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViolationReport({
  violations,
}: {
  violations: ManualScheduleViolation[];
}) {
  const errorCount = violations.filter(isErrorViolation).length;
  const warningCount = violations.length - errorCount;

  return (
    <section className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <HugeiconsIcon icon={AlertCircleIcon} size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-semibold">รายการผิดกฎจากผล GA</h3>
              <p className="text-sm text-muted-foreground">
                ใช้สำหรับไล่ตรวจและแก้ไขตารางเวรแบบ manual
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
            ผิดกฎหนัก {errorCount} รายการ
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
            คำเตือน {warningCount} รายการ
          </span>
        </div>
      </div>

      <div className="mt-4 max-h-80 overflow-auto rounded-xl border">
        <Table>
          <TableHeader className="sticky top-0 bg-[#EEF7F8]">
            <TableRow>
              <TableHead className="w-24">ระดับ</TableHead>
              <TableHead className="w-24">วันที่</TableHead>
              <TableHead>บุคลากร</TableHead>
              <TableHead>กฎที่ผิด</TableHead>
              <TableHead>รายละเอียด</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {violations.map((violation) => (
              <TableRow key={violation.id}>
                <TableCell>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      isErrorViolation(violation)
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {isErrorViolation(violation) ? "ผิดกฎ" : "เตือน"}
                  </span>
                </TableCell>
                <TableCell>{violation.day ? `วันที่ ${violation.day}` : "-"}</TableCell>
                <TableCell>{violation.staffLabel ?? "-"}</TableCell>
                <TableCell>{violation.constraintLabel}</TableCell>
                <TableCell className="min-w-[280px]">{violation.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function ManualChangeHistory({ data }: { data: ManualScheduleData }) {
  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b p-5">
        <div>
          <h3 className="font-semibold">ประวัติการแก้ไข</h3>
          <p className="text-sm text-muted-foreground">
            แสดงรายการแก้ไขล่าสุดของเวอร์ชันนี้
          </p>
        </div>
        <div className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-brand">
          {data.history.length} รายการ
        </div>
      </div>

      {data.history.length > 0 ? (
        <div className="max-h-80 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-[#EEF7F8]">
              <TableRow>
                <TableHead>เวลา</TableHead>
                <TableHead>การแก้ไข</TableHead>
                <TableHead>บุคลากร</TableHead>
                <TableHead>วันที่</TableHead>
                <TableHead>จาก</TableHead>
                <TableHead>เป็น</TableHead>
                <TableHead>เหตุผล</TableHead>
                <TableHead>ผู้แก้ไข</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.changedAtLabel}</TableCell>
                  <TableCell>{item.actionType}</TableCell>
                  <TableCell>{item.staffLabel}</TableCell>
                  <TableCell>{item.dateLabel}</TableCell>
                  <TableCell>{item.oldShiftCode ?? "-"}</TableCell>
                  <TableCell>{item.newShiftCode ?? "-"}</TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {item.reason || "-"}
                  </TableCell>
                  <TableCell>{item.changedBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground">
          ยังไม่มีประวัติการแก้ไข
        </div>
      )}
    </section>
  );
}

function StatusPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "teal" | "blue" | "green" | "amber";
}) {
  const toneClass = {
    default: "bg-slate-100 text-slate-700",
    teal: "bg-teal-50 text-brand",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
        toneClass,
      )}
    >
      {tone === "green" ? (
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={2} />
      ) : null}
      {label}
    </span>
  );
}

function GaScoreCard({
  score,
}: {
  score: {
    scoringMethod: string | null;
    hardScore: string | null;
    softScore: string | null;
    isFeasible: boolean | null;
    objective: string | null;
    fitness: string | null;
    sourceLabel: string;
  } | null;
}) {
  return (
    <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand">คะแนนจาก GA</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {score?.sourceLabel ?? "คะแนนจาก GA ของตารางนี้"}
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4 md:w-auto">
          <GaScoreMetric label="Hard Constraint" value={score?.hardScore ?? "-"} />
          <GaScoreMetric label="Soft Constraint" value={score?.softScore ?? "-"} />
          <GaScoreMetric label="Objective" value={score?.objective ?? "-"} />
          <GaScoreMetric label="Fitness" value={score?.fitness ?? "-"} />
        </div>
      </div>

      <div className="mt-5 border-t pt-3">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={14}
            strokeWidth={2}
            className="mt-0.5 shrink-0"
          />
          <span>
            {score?.scoringMethod === "constraint_domination_v1"
              ? `สถานะจาก GA: ${score.isFeasible ? "ไม่ผิด Hard Constraint" : "ยังผิด Hard Constraint"} · `
              : "ผลเก่าอาจยังไม่มี Hard/Soft Score · "}
            Objective = Hard Constraint + Soft Constraint · ถ้ามีการแก้ไขแบบ manual
            ระบบจะแสดงคะแนน GA เดิมและไม่คำนวณคะแนนใหม่
          </span>
        </p>
      </div>
    </div>
  );
}

function GaScoreMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[150px] rounded-xl bg-[#F8FDFE] px-5 py-3 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold leading-none text-slate-950">
        {value}
      </p>
    </div>
  );
}

function ManualSummaryCell({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "holiday" | "otTotal" | "ot" | "green" | "note" | "total" | "muted";
}) {
  const toneClass = {
    default: "bg-[#F0FAF9] text-brand",
    holiday: "bg-[#E4F7F5] text-brand",
    otTotal: "bg-amber-50 font-semibold text-amber-700",
    ot: "bg-brand/10 text-brand",
    green: "bg-[#F0FAF9] font-medium text-brand",
    note: "bg-slate-50 text-slate-600",
    total: "bg-brand/10 font-semibold text-brand",
    muted: "bg-slate-50 text-slate-400",
  }[tone];

  return (
    <TableCell
      className={cn(
        "min-w-12 border-l px-2 py-2 text-center text-sm font-medium",
        toneClass,
      )}
    >
      {children}
    </TableCell>
  );
}

function isErrorViolation(violation: ManualScheduleViolation) {
  const severity = violation.severity.toLowerCase();
  return severity === "error" || severity === "hard";
}

function formatCellViolationTitle(cell: ManualScheduleCell) {
  if (cell.violations.length === 0) {
    return undefined;
  }

  return cell.violations
    .map((violation) => `${violation.constraintLabel}: ${violation.message}`)
    .join("\n");
}

function formatStaffOption(staff: ManualScheduleStaffOption) {
  return `${staff.staffCode} ${staff.fullName} (${staff.homeWardCode})`;
}

function buildDayMeta(
  day: number,
  month: number,
  year: number,
  holidayDaySet: Set<number>,
) {
  const normalYear = year > 2400 ? year - 543 : year;
  const date = new Date(normalYear, month - 1, day);
  const weekdayIndex = date.getDay();
  const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;

  return {
    day,
    weekday: ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][weekdayIndex],
    isHoliday: isWeekend || holidayDaySet.has(day),
  };
}

function summarizeManualRow(row: ManualScheduleRow, regularWorkTarget: number) {
  const summary = createEmptyManualSummary();
  summary.regularWorkTarget = regularWorkTarget;

  for (const cell of row.cells) {
    const shiftParts = splitDisplayShiftCode(cell.shiftCode);
    const otParts = resolveManualOtParts({
      isOt: cell.isOt,
      otShifts: cell.otShifts,
      shiftParts,
    });
    const otPartSet = new Set(otParts);

    for (const code of shiftParts) {
      if (isWorkShiftCode(code)) {
        if (!otPartSet.has(code)) {
          summary.shiftCounts[code] += 1;
        }
        summary.actualWorkTotal += 1;
      }
    }

    const noteCode = normalizeNoteShiftCode(cell.shiftCode);
    if (noteCode) {
      summary.noteCounts[noteCode] += 1;

      if (noteCode === "ว") {
        summary.actualWorkTotal += 1;
      }
    }

    for (const code of otParts) {
      if (isWorkShiftCode(code)) {
        summary.otShiftCounts[code] += 1;
        summary.markedOtTotal += 1;
      }
    }
  }

  summary.regularWorkTotal =
    Object.values(summary.shiftCounts).reduce((sum, value) => sum + value, 0) +
    summary.noteCounts["ว"];
  summary.overtimeTotal = summary.markedOtTotal;

  return summary;
}

function createEmptyManualSummary() {
  return {
    regularWorkTarget: 0,
    actualWorkTotal: 0,
    regularWorkTotal: 0,
    overtimeTotal: 0,
    markedOtTotal: 0,
    otShiftCounts: {
      "ด": 0,
      "ช": 0,
      "บ": 0,
    },
    shiftCounts: {
      "ด": 0,
      "ช": 0,
      "บ": 0,
    },
    noteCounts: {
      V: 0,
      "ว": 0,
      "ล": 0,
    },
  };
}

function buildDailyTotals(rows: ManualScheduleRow[], days: number[]) {
  const totals: Record<number, Record<(typeof workShiftCodes)[number], number>> = {};

  for (const day of days) {
    totals[day] = createEmptyManualSummary().shiftCounts;
  }

  for (const row of rows) {
    for (const cell of row.cells) {
      for (const code of splitDisplayShiftCode(cell.shiftCode)) {
        if (isWorkShiftCode(code)) {
          totals[cell.day][code] += 1;
        }
      }
    }
  }

  return totals;
}

function summarizeAllManualRows(
  summaries: Array<ReturnType<typeof createEmptyManualSummary>>,
) {
  const total = createEmptyManualSummary();

  for (const summary of summaries) {
    total.regularWorkTarget += summary.regularWorkTarget;
    total.actualWorkTotal += summary.actualWorkTotal;
    total.regularWorkTotal += summary.regularWorkTotal;
    total.overtimeTotal += summary.overtimeTotal;
    total.markedOtTotal += summary.markedOtTotal;

    for (const code of workShiftCodes) {
      total.otShiftCounts[code] += summary.otShiftCounts[code];
      total.shiftCounts[code] += summary.shiftCounts[code];
    }

    for (const code of noteShiftCodes) {
      total.noteCounts[code] += summary.noteCounts[code];
    }
  }

  return total;
}

function normalizeNoteShiftCode(value: string | null | undefined) {
  const shiftCode = (value ?? "").trim().replace(/\s/g, "");

  if (shiftCode === "V" || shiftCode === "ว" || shiftCode === "ล") {
    return shiftCode;
  }

  return null;
}

function resolveManualOtParts({
  isOt,
  otShifts,
  shiftParts,
}: {
  isOt: boolean;
  otShifts: string | null;
  shiftParts: string[];
}) {
  if (!isOt) {
    return [];
  }

  const otParts = otShifts ? splitDisplayShiftCode(otShifts) : shiftParts;
  return otParts.filter(isWorkShiftCode);
}

function formatShiftCode(code: string) {
  if (code === "0") {
    return "0 - Off";
  }

  return code;
}

function getOtOptions(shiftCode: string) {
  const shiftParts = splitDisplayShiftCode(shiftCode).filter(isOtEligibleShift);

  if (shiftParts.length === 0) {
    return [{ value: "none", label: "ไม่เป็น OT" }];
  }

  return [
    { value: "none", label: "ไม่เป็น OT" },
    ...shiftParts.map((part) => ({
      value: part,
      label: `${part} เป็น OT`,
    })),
    ...(shiftParts.length > 1
      ? [
          {
            value: shiftParts.join("/"),
            label: `${shiftParts.join("/")} เป็น OT ทั้งหมด`,
          },
        ]
      : []),
  ];
}

function formatShiftWithOt(
  shiftCode: string,
  isOt: boolean,
  otShifts: string | null,
) {
  if (!shiftCode || shiftCode === "0" || !isOt) {
    return shiftCode || "0";
  }

  const shiftParts = splitDisplayShiftCode(shiftCode);
  const otParts = otShifts ? splitDisplayShiftCode(otShifts) : shiftParts;
  const otPartSet = new Set(otParts);

  if (shiftParts.length === 0) {
    return shiftCode;
  }

  return shiftParts
    .map((part) => `${part}${otPartSet.has(part) ? "OT" : ""}`)
    .join("/");
}

function splitDisplayShiftCode(value: string | null | undefined) {
  const shiftCode = (value ?? "").trim().replace(/\s/g, "");

  if (!shiftCode || shiftCode === "0" || shiftCode === "V" || shiftCode === "ล" || shiftCode === "ว") {
    return [];
  }

  if (shiftCode.includes("/")) {
    return shiftCode.split("/").filter(Boolean);
  }

  if (shiftCode === "ชบ") {
    return ["ช", "บ"];
  }

  if (shiftCode === "ดบ") {
    return ["ด", "บ"];
  }

  return [shiftCode];
}

function isOtEligibleShift(value: string) {
  return value === "ช" || value === "บ" || value === "ด";
}

function isWorkShiftCode(value: string): value is (typeof workShiftCodes)[number] {
  return value === "ด" || value === "ช" || value === "บ";
}

function normalizeOtValue(value: string | null | undefined) {
  return value && value !== "none" ? value : null;
}
