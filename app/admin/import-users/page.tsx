"use client";

import { useActionState } from "react";

import {
  importUsersAction,
  type ImportUsersActionState,
} from "@/app/actions/import-users";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ImportUsersActionState = {
  message: "",
  summary: null,
};

const exampleColumns = [
  "รหัส",
  "ชื่อ",
  "วอร์ดหลัก",
  "บทบาท",
  "ตำแหน่ง",
  "ตำแหน่งเบิกจ่าย",
  "OT",
  "ค่าเวร",
  "พยาบาลฝึกหัด",
];

export default function ImportUsersPage() {
  const [state, formAction, isPending] = useActionState(
    importUsersAction,
    initialState,
  );
  const summary = state.summary;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-sm font-medium text-brand">Admin</p>
        <h1 className="text-3xl font-bold text-foreground">
          Import รายชื่อผู้ใช้จาก Excel
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ใช้สำหรับสร้างหรืออัปเดตบัญชีผู้ใช้ บุคลากร วอร์ด บทบาท และสิทธิ์ขึ้นวอร์ดจากไฟล์ Excel
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>อัปโหลดไฟล์</CardTitle>
          <CardDescription>
            รองรับไฟล์ .xlsx, .xls, .csv ขนาดไม่เกิน 5MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" action={formAction}>
            <div className="space-y-2">
              <Label htmlFor="staff-file">ไฟล์รายชื่อบุคลากร</Label>
              <Input
                id="staff-file"
                name="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                required
              />
            </div>

            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <input type="checkbox" className="mt-1" name="resetPassword" />
              <span>
                <span className="block font-medium text-foreground">
                  รีเซ็ตรหัสผ่านผู้ใช้เดิม
                </span>
                <span className="text-muted-foreground">
                  ถ้าไม่เลือก ระบบจะตั้งรหัสผ่านเริ่มต้นเฉพาะผู้ใช้ใหม่เท่านั้น
                </span>
              </span>
            </label>

            <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
              รหัสผ่านเริ่มต้นคือ{" "}
              <span className="font-semibold">Nuh + รหัสพยาบาล</span> เช่น
              username NP001 ใช้รหัสผ่านเริ่มต้น NuhNP001
            </div>

            {state.message ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {state.message}
              </div>
            ) : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? "กำลัง import..." : "Import"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle>ผลการ Import</CardTitle>
            <CardDescription>
              สำเร็จ {summary.successCount} แถว ไม่สำเร็จ{" "}
              {summary.failedCount} แถว จากทั้งหมด {summary.totalRows} แถว
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem label="สร้างผู้ใช้ใหม่" value={summary.createdUsers} />
              <SummaryItem label="อัปเดตผู้ใช้" value={summary.updatedUsers} />
              <SummaryItem
                label="สร้างบุคลากรใหม่"
                value={summary.createdStaff}
              />
              <SummaryItem
                label="อัปเดตบุคลากร"
                value={summary.updatedStaff}
              />
              <SummaryItem label="สร้างวอร์ดใหม่" value={summary.createdWards} />
            </div>

            {summary.errors.length > 0 ? (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">แถว</th>
                      <th className="px-3 py-2 font-medium">รหัส</th>
                      <th className="px-3 py-2 font-medium">ปัญหา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.errors.map((error) => (
                      <tr
                        key={`${error.rowNumber}-${error.staffCode ?? ""}`}
                        className="border-t"
                      >
                        <td className="px-3 py-2">{error.rowNumber}</td>
                        <td className="px-3 py-2">
                          {error.staffCode ?? "-"}
                        </td>
                        <td className="px-3 py-2">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>รูปแบบไฟล์ที่รองรับ</CardTitle>
          <CardDescription>
            ใช้ column ตามตัวอย่างนี้ได้เลย ระบบจะอ่าน sheet แรกของไฟล์
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  {exampleColumns.map((column) => (
                    <th key={column} className="px-3 py-2 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-3 py-2">NP001</td>
                  <td className="px-3 py-2">สมหญิง ใจดี</td>
                  <td className="px-3 py-2">Ward A</td>
                  <td className="px-3 py-2">nurse</td>
                  <td className="px-3 py-2">หัวหน้าวอร์ด</td>
                  <td className="px-3 py-2">RN</td>
                  <td className="px-3 py-2">120</td>
                  <td className="px-3 py-2">80</td>
                  <td className="px-3 py-2">ไม่ใช่</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            ช่องที่จำเป็นคือ รหัส, ชื่อ และวอร์ดหลัก ถ้าช่องตำแหน่งมีคำว่า
            &quot;หัวหน้า&quot; ระบบจะตั้งบุคลากรคนนั้นเป็นหัวหน้าวอร์ดให้อัตโนมัติ
            ส่วนช่องพยาบาลฝึกหัดใส่ได้เป็น ใช่ / ไม่ใช่
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
