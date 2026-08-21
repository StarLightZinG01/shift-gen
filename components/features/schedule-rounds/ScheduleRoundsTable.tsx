"use client";

import { useTransition } from "react";
import { Delete02Icon, Edit03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { deleteScheduleRoundAction } from "@/app/actions/schedule-rounds";
import {
  cancelActiveGaRunAction,
  retryFailedGaGroupAction,
} from "@/app/actions/ga-runs";
import { Button } from "@/components/ui/button";
import { StartGaRunButton } from "@/components/features/schedule-rounds/StartGaRunButton";
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
import type { GaRunStatus } from "@/lib/ga-runs/types";

type ScheduleRoundsTableProps = {
  rounds: ScheduleRoundRow[];
  onEditRound: (round: ScheduleRoundRow) => void;
  onDeleted: () => void;
  onGaRunStarted: () => void;
};

export function ScheduleRoundsTable({
  rounds,
  onEditRound,
  onDeleted,
  onGaRunStarted,
}: ScheduleRoundsTableProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(round: ScheduleRoundRow) {
    const confirmed = window.confirm(
      `ยืนยันลบรอบจัดตาราง ${round.monthLabel} หรือไม่? ข้อมูลที่ผูกกับรอบนี้จะถูกลบไปด้วย`,
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteScheduleRoundAction(round.id);

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onDeleted();
    });
  }

  function handleCancelGaRun(round: ScheduleRoundRow) {
    const confirmed = window.confirm(
      `ยืนยันยกเลิกงาน GA ของรอบ ${round.monthLabel} หรือไม่? งานที่กำลังรันจะถูกทำเครื่องหมายว่าไม่สำเร็จ และสามารถส่งข้อมูลให้ GA ใหม่ได้`,
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await cancelActiveGaRunAction(round.id);

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onGaRunStarted();
    });
  }

  function handleRetryGroup(gaRunId: string) {
    startTransition(async () => {
      const result = await retryFailedGaGroupAction(gaRunId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onGaRunStarted();
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-[#EAF4F7]">
            <TableRow className="hover:bg-[#EAF4F7]">
              <TableHead className="min-w-36">เดือน/ปี</TableHead>
              <TableHead className="min-w-44">สถานะรอบ</TableHead>
              <TableHead className="min-w-32">วอร์ดส่งข้อมูล</TableHead>
              <TableHead className="min-w-40">เปิดรับคำขอ</TableHead>
              <TableHead className="min-w-40">ปิดรับคำขอ</TableHead>
              <TableHead className="min-w-40">ล็อกข้อมูล</TableHead>
              <TableHead className="min-w-44">เริ่มจัดด้วย GA</TableHead>
              <TableHead className="min-w-52">วันหยุดนักขัตฤกษ์</TableHead>
              <TableHead className="min-w-56">GA ล่าสุด</TableHead>
              <TableHead className="min-w-44">สร้างรอบเมื่อ</TableHead>
              <TableHead className="min-w-64 text-center">การดำเนินการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rounds.map((round) => (
              <TableRow key={round.id} className="bg-white">
                <TableCell className="font-semibold">
                  {round.monthLabel}
                </TableCell>
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
                <TableCell className="max-w-60 text-sm text-muted-foreground">
                  {round.holidayDateLabels}
                </TableCell>
                <TableCell>
                  {round.latestGaRun ? (
                    <div className="space-y-1">
                      <GaRunStatusBadge status={round.latestGaRun.status}>
                        {round.latestGaRun.statusLabel}
                      </GaRunStatusBadge>
                      <p className="text-xs text-muted-foreground">
                        สร้างเมื่อ {round.latestGaRun.createdAtLabel}
                      </p>
                      {round.latestGaBatch ? (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer select-none text-brand">
                            สำเร็จ {round.latestGaBatch.completedGroupCount}/
                            {round.latestGaBatch.groupCount} กลุ่ม
                            {round.latestGaBatch.failedGroupCount > 0
                              ? ` · ล้มเหลว ${round.latestGaBatch.failedGroupCount}`
                              : ""}
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {round.latestGaBatch.groups.map((group) => (
                              <div key={group.id} className="flex items-center gap-2">
                                <p className="min-w-0 flex-1">
                                  กลุ่ม {group.index}: {group.wardCodes.join(", ") || "-"} ·{" "}
                                  {formatGaGroupStatus(group.status)}
                                </p>
                                {group.status === "failed" ? (
                                  <button
                                    type="button"
                                    className="shrink-0 font-medium text-brand hover:underline"
                                    disabled={isPending}
                                    onClick={() => handleRetryGroup(group.id)}
                                  >
                                    รันซ้ำ
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">ยังไม่มีงาน GA</span>
                  )}
                </TableCell>
                <TableCell>{round.createdAtLabel}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-center gap-2">
                    <StartGaRunButton
                      round={round}
                      onStarted={onGaRunStarted}
                    />
                    {round.hasActiveGaRun ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-md border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                        onClick={() => handleCancelGaRun(round)}
                        disabled={isPending}
                      >
                        ยกเลิกงาน GA
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-md"
                      onClick={() => onEditRound(round)}
                      disabled={isPending}
                    >
                      <HugeiconsIcon icon={Edit03Icon} size={15} strokeWidth={2} />
                      แก้ไข
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-md border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleDelete(round)}
                      disabled={isPending}
                    >
                      <HugeiconsIcon
                        icon={Delete02Icon}
                        size={15}
                        strokeWidth={2}
                      />
                      ลบ
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatGaGroupStatus(status: string) {
  const labels: Record<string, string> = {
    queued: "รอจัดตาราง",
    running: "กำลังจัดตาราง",
    processing: "กำลังประมวลผล",
    completed: "สำเร็จ",
    failed: "ล้มเหลว",
  };
  return labels[status] ?? status;
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

function GaRunStatusBadge({
  status,
  children,
}: {
  status: GaRunStatus;
  children: React.ReactNode;
}) {
  const classNameByStatus: Record<GaRunStatus, string> = {
    queued: "bg-sky-100 text-sky-700",
    running: "bg-violet-100 text-violet-700",
    processing: "bg-violet-100 text-violet-700",
    completed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classNameByStatus[status]}`}
    >
      {children}
    </span>
  );
}
