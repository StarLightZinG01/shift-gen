"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Calculator01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { recalculateCompensationAction } from "@/app/actions/compensation";
import { Button } from "@/components/ui/button";

type RecalculateCompensationButtonProps = {
  scheduleVersionId: string | null;
};

export function RecalculateCompensationButton({
  scheduleVersionId,
}: RecalculateCompensationButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      className="h-10 rounded-md"
      disabled={!scheduleVersionId || isPending}
      onClick={() => {
        if (!scheduleVersionId) {
          return;
        }

        startTransition(async () => {
          const result = await recalculateCompensationAction(scheduleVersionId);

          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else {
            toast.error(result.message);
          }
        });
      }}
    >
      <HugeiconsIcon icon={Calculator01Icon} size={18} />
      {isPending ? "กำลังคำนวณ..." : "คำนวณค่าตอบแทนใหม่"}
    </Button>
  );
}
