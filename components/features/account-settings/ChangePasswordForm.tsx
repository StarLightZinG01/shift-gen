"use client";

import { useState, useTransition } from "react";
import { LockPasswordIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { changePasswordAction } from "@/app/actions/account-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PasswordField
        id="currentPassword"
        label="รหัสผ่านปัจจุบัน"
        value={currentPassword}
        autoComplete="current-password"
        onChange={setCurrentPassword}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <PasswordField
          id="newPassword"
          label="รหัสผ่านใหม่"
          value={newPassword}
          autoComplete="new-password"
          onChange={setNewPassword}
        />
        <PasswordField
          id="confirmPassword"
          label="ยืนยันรหัสผ่านใหม่"
          value={confirmPassword}
          autoComplete="new-password"
          onChange={setConfirmPassword}
        />
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร และต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน
      </p>

      <Button
        type="submit"
        disabled={
          isPending ||
          !currentPassword ||
          newPassword.length < 8 ||
          !confirmPassword
        }
      >
        <HugeiconsIcon icon={LockPasswordIcon} size={18} strokeWidth={1.8} />
        {isPending ? "กำลังเปลี่ยนรหัสผ่าน..." : "เปลี่ยนรหัสผ่าน"}
      </Button>
    </form>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
};

function PasswordField({
  id,
  label,
  value,
  autoComplete,
  onChange,
}: PasswordFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}
