"use client";

import { useActionState } from "react";

import {
  createAdminUserAction,
  type CreateAdminUserActionState,
} from "@/app/actions/admin-users";
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

const initialState: CreateAdminUserActionState = {
  message: "",
  status: "idle",
  username: null,
};

export default function CreateAdminPage() {
  const [state, formAction, isPending] = useActionState(
    createAdminUserAction,
    initialState,
  );

  return (
    <main className="container py-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-brand">Temporary Admin Tool</p>
        <h1 className="text-2xl font-bold text-foreground">
          เพิ่มผู้ดูแลระบบ
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          หน้านี้ใช้ชั่วคราวสำหรับสร้าง user role admin ที่ไม่ผูกกับวอร์ดและไม่สร้างข้อมูลในตาราง staff
          เมื่อตั้งค่าผู้ดูแลระบบเสร็จแล้วสามารถลบโฟลเดอร์นี้ออกได้ง่าย
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>ข้อมูลบัญชี admin</CardTitle>
          <CardDescription>
            ถ้า username นี้มีอยู่แล้วและไม่ได้ผูกกับ staff ระบบจะอัปเดตชื่อ รหัสผ่าน และ role admin ให้ใหม่
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="admin"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">ชื่อที่แสดง</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  placeholder="ผู้ดูแลระบบ"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeCode">รหัสพนักงาน/รหัสอ้างอิง</Label>
              <Input
                id="employeeCode"
                name="employeeCode"
                placeholder="ADMIN001"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                ไม่บังคับกรอก ถ้าเว้นว่างระบบจะบันทึกเป็น null
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              บัญชีที่สร้างจากหน้านี้จะมี role เป็น{" "}
              <span className="font-semibold text-foreground">admin</span>{" "}
              และจะไม่มีข้อมูลในตาราง staff, ไม่มี home ward, ไม่มีสิทธิ์ขึ้นตรงกับวอร์ดใด
            </div>

            {state.message ? (
              <div
                className={
                  state.status === "success"
                    ? "rounded-md border border-brand/30 bg-brand/10 p-3 text-sm text-brand"
                    : "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                }
              >
                {state.message}
                {state.username ? (
                  <span className="font-medium">: {state.username}</span>
                ) : null}
              </div>
            ) : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? "กำลังบันทึก..." : "สร้าง / อัปเดต admin"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
