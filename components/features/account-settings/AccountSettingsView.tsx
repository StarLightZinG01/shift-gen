import {
  AccountSetting01Icon,
  LockPasswordIcon,
  Profile02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ChangePasswordForm } from "./ChangePasswordForm";
import { DisplayNameForm } from "./DisplayNameForm";

type AccountSettingsViewProps = {
  displayName: string;
  username: string;
  employeeCode: string | null;
  hasStaffProfile: boolean;
};

export function AccountSettingsView({
  displayName,
  username,
  employeeCode,
  hasStaffProfile,
}: AccountSettingsViewProps) {
  return (
    <main className="container space-y-6">
      <section className="rounded-lg border bg-[#EBF3F7] px-6 py-7 shadow-sm md:px-8">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <HugeiconsIcon icon={AccountSetting01Icon} size={23} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ตั้งค่าบัญชี</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              จัดการชื่อที่แสดงและรหัสผ่านสำหรับเข้าสู่ระบบ
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card className="rounded-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-[#E4F7F5] text-brand">
                <HugeiconsIcon icon={Profile02Icon} size={20} strokeWidth={1.8} />
              </div>
              <div>
                <CardTitle>ข้อมูลบัญชี</CardTitle>
                <CardDescription>ข้อมูลอ้างอิงสำหรับบัญชีนี้</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <AccountValue label="ชื่อปัจจุบัน" value={displayName} />
            <AccountValue label="รหัสผู้ใช้" value={username} />
            <AccountValue
              label="รหัสบุคลากร"
              value={employeeCode || "ไม่ได้ระบุ"}
            />
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="border-b">
            <CardTitle>เปลี่ยนชื่อที่แสดง</CardTitle>
            <CardDescription>
              ใช้ชื่อจริงเพื่อให้ผู้ใช้อื่นระบุตัวตนได้ถูกต้อง
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DisplayNameForm
              initialDisplayName={displayName}
              hasStaffProfile={hasStaffProfile}
            />
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-lg">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-[#FFF4D8] text-[#9A6500]">
              <HugeiconsIcon icon={LockPasswordIcon} size={20} strokeWidth={1.8} />
            </div>
            <div>
              <CardTitle>ความปลอดภัย</CardTitle>
              <CardDescription>
                ยืนยันรหัสผ่านปัจจุบันก่อนกำหนดรหัสผ่านใหม่
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}

function AccountValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right text-sm font-semibold break-words">
        {value}
      </span>
    </div>
  );
}
