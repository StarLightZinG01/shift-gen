"use client";

import { useTransition } from "react";
import { SaveIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { publishManualVersionAction } from "@/app/actions/manual-schedule";
import { Button } from "@/components/ui/button";

type SetPrimaryVersionButtonProps = {
  versionId: string;
  wardId: string;
  isPrimary: boolean;
};

export function SetPrimaryVersionButton({
  versionId,
  wardId,
  isPrimary,
}: SetPrimaryVersionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      className="h-10 rounded-md"
      disabled={isPrimary || isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await publishManualVersionAction(versionId, wardId);

          if (!result.ok) {
            toast.error(result.message);
            return;
          }

          toast.success(result.message);
          router.refresh();
        });
      }}
    >
      <HugeiconsIcon icon={SaveIcon} size={17} strokeWidth={2} />
      {isPrimary
        ? "เวอร์ชันหลักของวอร์ด"
        : isPending
          ? "กำลังตั้งเวอร์ชันหลัก..."
          : "ตั้งเป็นเวอร์ชันหลัก"}
    </Button>
  );
}
