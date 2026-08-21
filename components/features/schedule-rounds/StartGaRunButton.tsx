"use client";

import { useEffect, useState, useTransition } from "react";
import { PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  startGaRunAction,
  previewGaRunGroupsAction,
  type PreviewGaRunGroupsActionResult,
  type StartGaRunActionResult,
} from "@/app/actions/ga-runs";
import { Button } from "@/components/ui/button";
import { GaRunConfirmDialog } from "@/components/features/schedule-rounds/GaRunConfirmDialog";
import type { ScheduleRoundRow } from "@/lib/schedule-rounds/types";

type StartGaRunButtonProps = {
  round: ScheduleRoundRow;
  onStarted: () => void;
};

export function StartGaRunButton({ round, onStarted }: StartGaRunButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetWardIds, setTargetWardIds] = useState<string[]>(() =>
    getReadyWardIds(round),
  );
  const [result, setResult] = useState<
    Extract<StartGaRunActionResult, { status: "error" }> | null
  >(null);
  const [groupPreview, setGroupPreview] =
    useState<PreviewGaRunGroupsActionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen || targetWardIds.length === 0) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      const preview = await previewGaRunGroupsAction({
        cycleId: round.id,
        targetWardIds,
      });
      if (!cancelled) {
        setGroupPreview(preview);
        setIsAnalyzing(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isOpen, round.id, targetWardIds]);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);

    if (open) {
      const readyWardIds = getReadyWardIds(round);
      setTargetWardIds(readyWardIds);
      setGroupPreview(null);
      setIsAnalyzing(readyWardIds.length > 0);
    }

    if (!open) {
      setResult(null);
      setTargetWardIds(getReadyWardIds(round));
      setGroupPreview(null);
      setIsAnalyzing(false);
    }
  }

  function handleTargetWardIdsChange(wardIds: string[]) {
    setTargetWardIds(wardIds);
    setGroupPreview(null);
    setIsAnalyzing(wardIds.length > 0);
  }

  function handleStartGaRun() {
    setResult(null);

    startTransition(async () => {
      if (targetWardIds.length === 0) {
        toast.error("กรุณาเลือกวอร์ดที่ต้องการส่งให้ GA");
        return;
      }

      const actionResult = await startGaRunAction({
        cycleId: round.id,
        targetWardIds,
      });

      if (actionResult.status === "error") {
        setResult(actionResult);
        toast.error(actionResult.message);
        return;
      }

      toast.success(actionResult.message);
      setIsOpen(false);
      onStarted();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="rounded-md"
        onClick={() => setIsOpen(true)}
        disabled={round.hasActiveGaRun}
      >
        <HugeiconsIcon icon={PlayIcon} size={15} strokeWidth={2} />
        {round.hasActiveGaRun ? "มีงานรันอยู่" : "เริ่ม GA"}
      </Button>
      <GaRunConfirmDialog
        round={round}
        open={isOpen}
        isPending={isPending}
        isAnalyzing={isAnalyzing}
        result={result}
        groupPreview={groupPreview}
        targetWardIds={targetWardIds}
        onTargetWardIdsChange={handleTargetWardIdsChange}
        onOpenChange={handleOpenChange}
        onConfirm={handleStartGaRun}
      />
    </>
  );
}

function getReadyWardIds(round: ScheduleRoundRow) {
  return round.wardOptions
    .filter((ward) => ward.status === "submitted" || ward.status === "ready")
    .map((ward) => ward.id);
}
