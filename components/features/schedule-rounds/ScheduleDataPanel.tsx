"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Add01Icon,
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Hospital02Icon,
  Search01Icon,
  TaskDaily01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  createWardAction,
  deleteWardAction,
} from "@/app/actions/schedule-rounds";
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
import type {
  ScheduleDataOverview,
  WardScheduleDataRow,
  WardPreparationStatus,
} from "@/lib/schedule-rounds/types";

type StatusFilter = "all" | WardPreparationStatus;
const PAGE_SIZE = 6;

type ScheduleDataPanelProps = {
  data: ScheduleDataOverview;
};

export function ScheduleDataPanel({ data }: ScheduleDataPanelProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [isCreateWardOpen, setIsCreateWardOpen] = useState(false);
  const [wardToDelete, setWardToDelete] = useState<WardScheduleDataRow | null>(
    null,
  );
  const [wardDraft, setWardDraft] = useState({
    code: "",
    name: "",
  });

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return data.rows.filter((row) => {
      const matchKeyword =
        !keyword ||
        row.wardCode.toLowerCase().includes(keyword) ||
        row.wardName.toLowerCase().includes(keyword) ||
        row.headNames.some((name) => name.toLowerCase().includes(keyword));
      const matchStatus =
        statusFilter === "all" || row.status === statusFilter;

      return matchKeyword && matchStatus;
    });
  }, [data.rows, search, statusFilter]);

  const totalPages = Math.max(Math.ceil(filteredRows.length / PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function resetPage() {
    setPage(1);
  }

  function resetWardDraft() {
    setWardDraft({
      code: "",
      name: "",
    });
  }

  function handleCreateWard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createWardAction(wardDraft);

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      resetWardDraft();
      setIsCreateWardOpen(false);
      resetPage();
      router.refresh();
    });
  }

  function handleDeleteWard() {
    if (!wardToDelete) {
      return;
    }

    startTransition(async () => {
      const result = await deleteWardAction(wardToDelete.wardId);

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setWardToDelete(null);
      resetPage();
      router.refresh();
    });
  }

  if (!data.cycle) {
    return (
      <section className="rounded-2xl border border-dashed bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <HugeiconsIcon icon={TaskDaily01Icon} size={24} strokeWidth={2} />
        </div>
        <h2 className="mt-4 text-lg font-semibold">ยังไม่มีรอบจัดตาราง</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          กรุณาสร้างรอบจัดตารางก่อน เพื่อให้ระบบแสดงข้อมูลการเตรียมจัดตารางของแต่ละวอร์ด
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
          <h2 className="text-xl font-semibold">ข้อมูลการจัดตาราง</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ตรวจสอบสถานะข้อมูลของทุกวอร์ดสำหรับรอบ {data.cycle.monthLabel}
          </p>
          </div>
          <Button
            type="button"
            className="self-start"
            onClick={() => setIsCreateWardOpen(true)}
          >
            <HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />
            เพิ่มวอร์ด
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            รอบ {data.cycle.monthLabel}
          </span>
          <span className="rounded-full bg-[#EEF7F8] px-3 py-1 text-xs font-medium text-muted-foreground">
            สถานะรอบ: {data.cycle.statusLabel}
          </span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Hospital02Icon}
          label="วอร์ดทั้งหมด"
          value={data.summary.totalWards}
          tone="teal"
        />
        <SummaryCard
          icon={CheckmarkCircle02Icon}
          label="ส่งข้อมูลครบแล้ว"
          value={data.summary.completedWards}
          tone="green"
        />
        <SummaryCard
          icon={AlertCircleIcon}
          label="ข้อมูลยังไม่ครบ"
          value={data.summary.incompleteWards}
          tone="amber"
        />
        <SummaryCard
          icon={TaskDaily01Icon}
          label="ยังไม่ส่งข้อมูล"
          value={data.summary.draftWards}
          tone="rose"
        />
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div className="space-y-1.5">
            <Label>ค้นหา</Label>
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="ชื่อวอร์ดหรือหัวหน้าวอร์ด"
                className="h-10 rounded-md bg-white pl-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>สถานะข้อมูล</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as StatusFilter);
                resetPage();
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="submitted">ส่งข้อมูลครบแล้ว</SelectItem>
                <SelectItem value="needs_fix">ข้อมูลยังไม่ครบ</SelectItem>
                <SelectItem value="draft">ยังไม่ส่งข้อมูล</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#EAF4F7]">
              <TableRow className="hover:bg-[#EAF4F7]">
                <TableHead className="min-w-44">วอร์ด</TableHead>
                <TableHead className="min-w-64">หัวหน้าวอร์ด</TableHead>
                <TableHead className="min-w-44">สถานะข้อมูล</TableHead>
                <TableHead className="min-w-32 text-center">
                  รายละเอียด
                </TableHead>
                <TableHead className="min-w-28 text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row) => (
                  <TableRow key={row.wardId} className="bg-white">
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-semibold">{row.wardCode}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.wardName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.headNames.length > 0 ? (
                        row.headNames.join(", ")
                      ) : (
                        <span className="text-muted-foreground">
                          ยังไม่ได้กำหนด
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <PreparationStatusBadge status={row.status}>
                        {row.statusLabel}
                      </PreparationStatusBadge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button asChild type="button" variant="outline" size="sm">
                        <Link href={`/home/schedule-rounds/wards/${row.wardId}`}>
                          รายละเอียด
                        </Link>
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => setWardToDelete(row)}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                        ลบ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-28 text-center text-muted-foreground"
                  >
                    ไม่พบข้อมูลวอร์ดตามเงื่อนไขที่เลือก
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            แสดง {paginatedRows.length} จาก {filteredRows.length} รายการ
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(value - 1, 1))}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
              ก่อนหน้า
            </Button>
            <span className="rounded-md bg-[#EEF7F8] px-3 py-1 text-sm font-medium">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
            >
              ถัดไป
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
            </Button>
          </div>
        </div>
      </section>

      <Dialog
        open={isCreateWardOpen}
        onOpenChange={(open) => {
          setIsCreateWardOpen(open);
          if (!open) {
            resetWardDraft();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateWard}>
            <DialogHeader>
              <DialogTitle>เพิ่มวอร์ด</DialogTitle>
              <DialogDescription>
                สร้างวอร์ดใหม่ลงฐานข้อมูลจริง วอร์ดนี้จะพร้อมใช้งานในรอบจัดตารางที่ยังเปิดใช้งานอยู่
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-5">
              <div className="space-y-1.5">
                <Label htmlFor="ward-code">รหัสวอร์ด</Label>
                <Input
                  id="ward-code"
                  value={wardDraft.code}
                  onChange={(event) =>
                    setWardDraft((draft) => ({
                      ...draft,
                      code: event.target.value,
                    }))
                  }
                  placeholder="เช่น ICU, ER, Ped3"
                  className="h-10 rounded-md bg-white"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ward-name">ชื่อวอร์ด</Label>
                <Input
                  id="ward-name"
                  value={wardDraft.name}
                  onChange={(event) =>
                    setWardDraft((draft) => ({
                      ...draft,
                      name: event.target.value,
                    }))
                  }
                  placeholder="เช่น หอผู้ป่วย ICU"
                  className="h-10 rounded-md bg-white"
                  disabled={isPending}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setIsCreateWardOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "กำลังบันทึก..." : "บันทึกวอร์ด"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(wardToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setWardToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบวอร์ด</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบวอร์ด {wardToDelete?.wardCode} ออกจากระบบหรือไม่ ระบบจะไม่ลบถ้าวอร์ดนี้ยังมีบุคลากร ตารางเวร หรือสรุปค่าตอบแทนผูกอยู่
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleDeleteWard}
            >
              {isPending ? "กำลังลบ..." : "ลบวอร์ด"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: typeof Hospital02Icon;
  label: string;
  value: number;
  tone: "teal" | "green" | "amber" | "rose";
}) {
  const toneClass = {
    teal: "bg-brand/10 text-brand",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  }[tone];

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-bold">{value}</p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-xl ${toneClass}`}>
          <HugeiconsIcon icon={icon} size={21} strokeWidth={2} />
        </div>
      </div>
    </section>
  );
}

function PreparationStatusBadge({
  status,
  children,
}: {
  status: WardPreparationStatus;
  children: React.ReactNode;
}) {
  const classNameByStatus: Record<WardPreparationStatus, string> = {
    draft: "bg-rose-100 text-rose-700",
    needs_fix: "bg-amber-100 text-amber-700",
    submitted: "bg-emerald-100 text-emerald-700",
    ready: "bg-emerald-100 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classNameByStatus[status]}`}
    >
      {children}
    </span>
  );
}
