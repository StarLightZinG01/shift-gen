"use client";

import { AlertCircleIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { StartGaRunActionResult } from "@/app/actions/ga-runs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type {
  ScheduleRoundRow,
  ScheduleRoundWardOption,
} from "@/lib/schedule-rounds/types";

type GaRunConfirmDialogProps = {
  round: ScheduleRoundRow;
  open: boolean;
  isPending: boolean;
  result: Extract<StartGaRunActionResult, { status: "error" }> | null;
  targetWardIds: string[];
  onTargetWardIdsChange: (wardIds: string[]) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function GaRunConfirmDialog({
  round,
  open,
  isPending,
  result,
  targetWardIds,
  onTargetWardIdsChange,
  onOpenChange,
  onConfirm,
}: GaRunConfirmDialogProps) {
  const sortedWardOptions = [...round.wardOptions].sort((a, b) => {
    const readyDiff = Number(isReadyWard(b)) - Number(isReadyWard(a));

    if (readyDiff !== 0) {
      return readyDiff;
    }

    return a.code.localeCompare(b.code, "th");
  });
  const readyWardIds = sortedWardOptions
    .filter(isReadyWard)
    .map((ward) => ward.id);
  const selectedWardIdSet = new Set(targetWardIds);
  const selectedWards = sortedWardOptions.filter((ward) =>
    selectedWardIdSet.has(ward.id),
  );
  const selectedReadyCount = selectedWards.filter(isReadyWard).length;
  const selectedScope =
    selectedWards.length > 0
      ? selectedWards.map((ward) => ward.code).join(", ")
      : "ยังไม่ได้เลือก";

  function toggleWard(ward: ScheduleRoundWardOption) {
    if (!isReadyWard(ward) || isPending) {
      return;
    }

    const next = selectedWardIdSet.has(ward.id)
      ? targetWardIds.filter((wardId) => wardId !== ward.id)
      : [...targetWardIds, ward.id];

    onTargetWardIdsChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle>เริ่มจัดตารางด้วย GA</DialogTitle>
          <DialogDescription>
            เลือกวอร์ดที่ต้องการส่งให้ GA จัดตารางพร้อมกัน ระบบจะสร้างงานจากเฉพาะวอร์ดที่เลือก
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <Label>วอร์ดที่จะส่งเข้า GA</Label>
                <p className="text-xs text-muted-foreground">
                  วอร์ดที่ยังไม่ส่งข้อมูลครบจะแสดงไว้ให้เห็น แต่ไม่สามารถเลือกได้
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-md"
                  disabled={isPending || readyWardIds.length === 0}
                  onClick={() => onTargetWardIdsChange(readyWardIds)}
                >
                  เลือกวอร์ดที่พร้อมทั้งหมด
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-md"
                  disabled={isPending || targetWardIds.length === 0}
                  onClick={() => onTargetWardIdsChange([])}
                >
                  ล้าง
                </Button>
              </div>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border bg-[#F8FDFE] p-3">
              {sortedWardOptions.map((ward) => {
                const ready = isReadyWard(ward);
                const checked = selectedWardIdSet.has(ward.id);

                return (
                  <button
                    key={ward.id}
                    type="button"
                    disabled={!ready || isPending}
                    onClick={() => toggleWard(ward)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      checked
                        ? "border-brand bg-brand/10"
                        : "border-[#DDEBED] bg-white"
                    } ${
                      ready
                        ? "hover:border-brand/40 hover:bg-brand/5"
                        : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!ready || isPending}
                      onChange={() => toggleWard(ward)}
                      className="size-4 accent-[#008585]"
                      tabIndex={-1}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {ward.code} - {ward.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ward.statusLabel}
                      </p>
                    </div>
                    <WardStatusBadge ward={ward} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border bg-[#F8FDFE] p-4 sm:grid-cols-3">
            <SummaryItem label="รอบจัดตาราง" value={round.monthLabel} />
            <SummaryItem label="ขอบเขต" value={selectedScope} />
            <SummaryItem
              label="วอร์ดพร้อมส่งที่เลือก"
              value={`${selectedReadyCount}/${targetWardIds.length}`}
            />
          </div>

          {targetWardIds.length === 0 ? (
            <Notice tone="warning">
              กรุณาเลือกอย่างน้อย 1 วอร์ดก่อนเริ่ม GA
            </Notice>
          ) : (
            <Notice tone="success">
              ระบบจะส่ง {targetWardIds.length} วอร์ดที่เลือกเข้า GA พร้อมกัน
              เพื่อให้คนที่ขึ้นเวรข้ามวอร์ดถูกจัดร่วมกันในงานเดียว
            </Notice>
          )}

          {round.latestGaRun ? (
            <div className="rounded-xl border bg-white p-4 text-sm">
              <p className="font-medium">งาน GA ล่าสุด</p>
              <p className="mt-1 text-muted-foreground">
                {round.latestGaRun.statusLabel} · สร้างเมื่อ{" "}
                {round.latestGaRun.createdAtLabel}
              </p>
            </div>
          ) : null}

          {result?.errors && result.errors.length > 0 ? (
            <ValidationList title="จุดที่ต้องแก้" items={result.errors} />
          ) : null}

          {result?.warnings && result.warnings.length > 0 ? (
            <ValidationList title="คำเตือน" items={result.warnings} />
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t bg-white px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending || targetWardIds.length === 0}
          >
            <HugeiconsIcon icon={PlayIcon} size={17} strokeWidth={2} />
            {isPending ? "กำลังสร้างงาน..." : "ยืนยันเริ่ม GA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}

function WardStatusBadge({ ward }: { ward: ScheduleRoundWardOption }) {
  const ready = isReadyWard(ward);

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ready
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {ready ? "พร้อม" : "ยังไม่พร้อม"}
    </span>
  );
}

function isReadyWard(ward: ScheduleRoundWardOption) {
  return ward.status === "submitted" || ward.status === "ready";
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex gap-2 rounded-xl border p-3 text-sm ${
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      <HugeiconsIcon icon={AlertCircleIcon} size={18} strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}

function ValidationList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-sm font-semibold text-red-700">{title}</p>
      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm text-red-700">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
