"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateScheduleRoundAction } from "@/app/actions/schedule-rounds";
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
import type { ScheduleRoundRow } from "@/lib/schedule-rounds/types";

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

type EditScheduleRoundDialogProps = {
  round: ScheduleRoundRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function EditScheduleRoundDialog({
  round,
  open,
  onOpenChange,
  onSaved,
}: EditScheduleRoundDialogProps) {
  return (
    <Dialog open={open && Boolean(round)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>แก้ไขรอบจัดตาราง</DialogTitle>
          <DialogDescription>
            ปรับวันรับคำขอ วันล็อกข้อมูล วันเริ่ม GA และวันหยุดนักขัตฤกษ์ของรอบนี้
          </DialogDescription>
        </DialogHeader>

        {round ? (
          <EditScheduleRoundForm
            key={round.id}
            round={round}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditScheduleRoundForm({
  round,
  onClose,
  onSaved,
}: {
  round: ScheduleRoundRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [month, setMonth] = useState(String(round.month));
  const [year, setYear] = useState(String(round.year));
  const [requestOpenDate, setRequestOpenDate] = useState(round.requestOpenDate);
  const [requestCloseDate, setRequestCloseDate] = useState(round.requestCloseDate);
  const [dataLockDate, setDataLockDate] = useState(round.dataLockDate);
  const [autoGenerateAt, setAutoGenerateAt] = useState(round.autoGenerateAt);
  const [holidayDates, setHolidayDates] = useState<string[]>(round.holidayDates);
  const [holidayInput, setHolidayInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function addHolidayDate() {
    if (!holidayInput || holidayDates.includes(holidayInput)) {
      setHolidayInput("");
      return;
    }

    setHolidayDates((current) =>
      [...current, holidayInput].sort((a, b) => a.localeCompare(b)),
    );
    setHolidayInput("");
  }

  function removeHolidayDate(date: string) {
    setHolidayDates((current) => current.filter((item) => item !== date));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await updateScheduleRoundAction({
        cycleId: round.id,
        month,
        year,
        requestOpenDate,
        requestCloseDate,
        dataLockDate,
        autoGenerateAt,
        holidayDates,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onClose();
      onSaved();
    });
  }

  return (
    <>
      <form
        id="edit-schedule-round-form"
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

        <HolidayEditor
          holidayDates={holidayDates}
          holidayInput={holidayInput}
          onHolidayInputChange={setHolidayInput}
          onAddHoliday={addHolidayDate}
          onRemoveHoliday={removeHolidayDate}
        />
      </form>

      <DialogFooter className="border-t bg-white px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          form="edit-schedule-round-form"
          disabled={isPending}
        >
          {isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
        </Button>
      </DialogFooter>
    </>
  );
}

function HolidayEditor({
  holidayDates,
  holidayInput,
  onHolidayInputChange,
  onAddHoliday,
  onRemoveHoliday,
}: {
  holidayDates: string[];
  holidayInput: string;
  onHolidayInputChange: (value: string) => void;
  onAddHoliday: () => void;
  onRemoveHoliday: (date: string) => void;
}) {
  return (
    <div className="rounded-2xl border bg-[#F8FDFE] p-4">
      <Label>วันหยุดนักขัตฤกษ์ของรอบนี้</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        กดวันที่ที่เพิ่มไว้เพื่อลบออก หรือเลือกวันที่ใหม่แล้วกดเพิ่มวันหยุด
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          type="date"
          value={holidayInput}
          onChange={(event) => onHolidayInputChange(event.target.value)}
          className="rounded-md bg-white"
        />
        <Button type="button" variant="outline" onClick={onAddHoliday}>
          เพิ่มวันหยุด
        </Button>
      </div>
      {holidayDates.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {holidayDates.map((date) => (
            <button
              key={date}
              type="button"
              className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-medium text-brand hover:bg-brand/15"
              onClick={() => onRemoveHoliday(date)}
            >
              {formatDateInputLabel(date)} x
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          ยังไม่ได้เพิ่มวันหยุดนักขัตฤกษ์
        </p>
      )}
    </div>
  );
}

function formatDateInputLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
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
