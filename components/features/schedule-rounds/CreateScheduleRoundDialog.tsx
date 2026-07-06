"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createScheduleRoundAction } from "@/app/actions/schedule-rounds";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const thaiMonths = [
  { label: "มกราคม", value: "1" },
  { label: "กุมภาพันธ์", value: "2" },
  { label: "มีนาคม", value: "3" },
  { label: "เมษายน", value: "4" },
  { label: "พฤษภาคม", value: "5" },
  { label: "มิถุนายน", value: "6" },
  { label: "กรกฎาคม", value: "7" },
  { label: "สิงหาคม", value: "8" },
  { label: "กันยายน", value: "9" },
  { label: "ตุลาคม", value: "10" },
  { label: "พฤศจิกายน", value: "11" },
  { label: "ธันวาคม", value: "12" },
];

type CreateScheduleRoundDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateScheduleRoundDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateScheduleRoundDialogProps) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear() + 543));
  const [requestOpenDate, setRequestOpenDate] = useState("");
  const [requestCloseDate, setRequestCloseDate] = useState("");
  const [dataLockDate, setDataLockDate] = useState("");
  const [autoGenerateAt, setAutoGenerateAt] = useState("");
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setMonth(String(now.getMonth() + 1));
    setYear(String(now.getFullYear() + 543));
    setRequestOpenDate("");
    setRequestCloseDate("");
    setDataLockDate("");
    setAutoGenerateAt("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createScheduleRoundAction({
        month,
        year,
        requestOpenDate,
        requestCloseDate,
        dataLockDate,
        autoGenerateAt,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      resetForm();
      onOpenChange(false);
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>สร้างรอบจัดตาราง</DialogTitle>
          <DialogDescription>
            กำหนดรอบจัดตารางรายเดือนและช่วงเวลาที่แต่ละวอร์ดต้องส่งข้อมูล
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-schedule-round-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="เดือน">
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {thaiMonths.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="ปี">
              <Input
                type="number"
                min={2400}
                max={3000}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                required
                className="rounded-md bg-white"
              />
            </Field>

            <Field label="วันที่เปิดรับคำขอวันลา/ไม่สะดวก">
              <Input
                type="date"
                value={requestOpenDate}
                onChange={(event) => setRequestOpenDate(event.target.value)}
                required
                className="rounded-md bg-white"
              />
            </Field>

            <Field label="วันที่ปิดรับคำขอ">
              <Input
                type="date"
                value={requestCloseDate}
                onChange={(event) => setRequestCloseDate(event.target.value)}
                required
                className="rounded-md bg-white"
              />
            </Field>

            <Field label="วันที่ล็อกข้อมูล">
              <Input
                type="date"
                value={dataLockDate}
                onChange={(event) => setDataLockDate(event.target.value)}
                required
                className="rounded-md bg-white"
              />
            </Field>

            <Field label="วันที่ให้ GA เริ่มจัดตาราง">
              <Input
                type="datetime-local"
                value={autoGenerateAt}
                onChange={(event) => setAutoGenerateAt(event.target.value)}
                required
                className="rounded-md bg-white"
              />
            </Field>
          </div>
        </form>

        <DialogFooter className="border-t bg-white px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            form="create-schedule-round-form"
            disabled={isPending}
          >
            {isPending ? "กำลังสร้าง..." : "สร้างรอบ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
