"use client";

import { useState, useTransition } from "react";
import { SaveIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateDisplayNameAction } from "@/app/actions/account-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DisplayNameFormProps = {
  initialDisplayName: string;
  hasStaffProfile: boolean;
};

export function DisplayNameForm({
  initialDisplayName,
  hasStaffProfile,
}: DisplayNameFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [isPending, startTransition] = useTransition();
  const hasChanged = displayName.trim() !== initialDisplayName;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await updateDisplayNameAction({ displayName });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="displayName">ชื่อที่แสดง</Label>
        <Input
          id="displayName"
          name="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="ชื่อ - นามสกุล"
          autoComplete="name"
          maxLength={150}
          required
        />
        <p className="text-xs leading-5 text-muted-foreground">
          {hasStaffProfile
            ? "ชื่อนี้จะแสดงบนบัญชีผู้ใช้ รายชื่อบุคลากร และตารางเวรทั้งหมด"
            : "ชื่อนี้จะแสดงบนบัญชีและหน้าใช้งานของคุณ"}
        </p>
      </div>

      <Button
        type="submit"
        disabled={isPending || !hasChanged || displayName.trim().length < 2}
      >
        <HugeiconsIcon icon={SaveIcon} size={18} strokeWidth={1.8} />
        {isPending ? "กำลังบันทึก..." : "บันทึกชื่อที่แสดง"}
      </Button>
    </form>
  );
}
