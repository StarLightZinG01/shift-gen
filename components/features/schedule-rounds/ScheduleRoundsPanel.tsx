"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Add01Icon,
  Calendar03Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { CreateScheduleRoundDialog } from "@/components/features/schedule-rounds/CreateScheduleRoundDialog";
import { EditScheduleRoundDialog } from "@/components/features/schedule-rounds/EditScheduleRoundDialog";
import { ScheduleRoundsTable } from "@/components/features/schedule-rounds/ScheduleRoundsTable";
import type {
  ScheduleRoundRow,
  ScheduleRoundsData,
} from "@/lib/schedule-rounds/types";

type ScheduleRoundsPanelProps = {
  data: ScheduleRoundsData;
};

export function ScheduleRoundsPanel({ data }: ScheduleRoundsPanelProps) {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<ScheduleRoundRow | null>(
    null,
  );

  function refreshRounds() {
    router.refresh();
  }

  function handleEditRound(round: ScheduleRoundRow) {
    setEditingRound(round);
    setIsEditDialogOpen(true);
  }

  function handleEditDialogOpenChange(open: boolean) {
    setIsEditDialogOpen(open);

    if (!open) {
      setEditingRound(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">รอบการจัดตาราง</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ใช้สำหรับสร้าง แก้ไข ติดตามรอบจัดตารางเวรรายเดือน และเริ่มงาน GA
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-md"
            onClick={refreshRounds}
          >
            <HugeiconsIcon icon={RefreshIcon} size={17} strokeWidth={2} />
            รีเฟรชสถานะ
          </Button>
          <Button
            type="button"
            className="h-10 rounded-md"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />
            สร้างรอบจัดตาราง
          </Button>
        </div>
      </section>

      {data.rounds.length > 0 ? (
        <ScheduleRoundsTable
          rounds={data.rounds}
          onEditRound={handleEditRound}
          onDeleted={refreshRounds}
          onGaRunStarted={refreshRounds}
        />
      ) : (
        <section className="rounded-2xl border border-dashed bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <HugeiconsIcon icon={Calendar03Icon} size={24} strokeWidth={2} />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            ยังไม่มีรอบจัดตาราง
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            เริ่มสร้างรอบจัดตารางรายเดือน เพื่อให้ระบบสร้างข้อมูลวอร์ดสำหรับเตรียมส่งเข้า GA
          </p>
          <Button
            type="button"
            className="mt-5 rounded-md"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />
            สร้างรอบจัดตาราง
          </Button>
        </section>
      )}

      <CreateScheduleRoundDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={refreshRounds}
      />
      <EditScheduleRoundDialog
        round={editingRound}
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogOpenChange}
        onSaved={refreshRounds}
      />
    </div>
  );
}
