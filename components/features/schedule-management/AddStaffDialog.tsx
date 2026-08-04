"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

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
import {
  buildExternalStaffRow,
  buildNewStaffRow,
  hasDuplicateStaff,
  validateNewStaffDraft,
  type NewStaffDraftInput,
} from "@/lib/schedule-management/staff-draft";
import type {
  ExternalStaffCandidate,
  StaffRow,
  WardContext,
} from "@/lib/schedule-management/types";
import { cn } from "@/lib/utils";

type AddStaffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ward: WardContext | null;
  existingRows: StaffRow[];
  externalStaffCandidates: ExternalStaffCandidate[];
  onAddStaff: (staffRow: StaffRow) => void;
};

const initialDraft: NewStaffDraftInput = {
  code: "",
  fullName: "",
  payPosition: "",
  otRate: "",
  shiftPayRate: "",
  isHead: false,
  isTrainee: false,
  off: "0",
  vacation: "0",
  leave: "0",
  academic: "0",
  preferredShifts: "0",
};

export function AddStaffDialog({
  open,
  onOpenChange,
  ward,
  existingRows,
  externalStaffCandidates,
  onAddStaff,
}: AddStaffDialogProps) {
  const [mode, setMode] = useState<"home" | "external">("home");
  const [draft, setDraft] = useState<NewStaffDraftInput>(initialDraft);
  const [search, setSearch] = useState("");

  const filteredCandidates = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return externalStaffCandidates.filter((candidate) => {
      const isDuplicate = hasDuplicateStaff(existingRows, {
        code: candidate.code,
        staffId: candidate.id,
      });

      if (isDuplicate) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return (
        candidate.code.toLowerCase().includes(keyword) ||
        candidate.fullName.toLowerCase().includes(keyword)
      );
    });
  }, [existingRows, externalStaffCandidates, search]);

  function updateDraft<K extends keyof NewStaffDraftInput>(
    key: K,
    value: NewStaffDraftInput[K],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function notifyError(message: string) {
    toast.error(message);
  }

  function handleAddHomeStaff() {
    if (!ward) {
      notifyError("ไม่พบวอร์ดสำหรับเพิ่มบุคลากร");
      return;
    }

    const validationError = validateNewStaffDraft(draft);

    if (validationError) {
      notifyError(validationError);
      return;
    }

    if (hasDuplicateStaff(existingRows, { code: draft.code })) {
      notifyError("มีบุคลากรรหัสนี้อยู่ในตารางแล้ว");
      return;
    }

    onAddStaff(buildNewStaffRow(draft, ward));
    toast.success("เพิ่มบุคลากรเข้าตารางแล้ว");
    setDraft(initialDraft);
    onOpenChange(false);
  }

  function handleAddExternalStaff(candidate: ExternalStaffCandidate) {
    if (hasDuplicateStaff(existingRows, { code: candidate.code, staffId: candidate.id })) {
      notifyError("มีบุคลากรคนนี้อยู่ในตารางแล้ว");
      return;
    }

    onAddStaff(buildExternalStaffRow(candidate));
    toast.success(`เพิ่ม ${candidate.fullName} เข้าวอร์ดนี้แล้ว`);
    setSearch("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold">เพิ่มบุคลากร</DialogTitle>
          <DialogDescription>
            เพิ่มข้อมูลเข้าตารางชั่วคราวก่อน ระบบจะบันทึกลงฐานข้อมูลเมื่อกดปุ่มบันทึกข้อมูลของหน้าหลัก
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-[#EEF7F8] p-1">
            <button
              type="button"
              onClick={() => {
                setMode("home");
              }}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                mode === "home"
                  ? "bg-white text-brand shadow-sm"
                  : "text-muted-foreground hover:bg-white/70 hover:text-foreground",
              )}
            >
              บุคลากรในวอร์ด
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("external");
              }}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                mode === "external"
                  ? "bg-white text-brand shadow-sm"
                  : "text-muted-foreground hover:bg-white/70 hover:text-foreground",
              )}
            >
              บุคลากรช่วยวอร์ดนี้
            </button>
          </div>

          {mode === "home" ? (
            <div className="space-y-4">
              <FormSection
                title="ข้อมูลพื้นฐาน"
                description="ระบุรหัสและชื่อบุคลากรที่จะเพิ่มเข้าในวอร์ดนี้"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="รหัสบุคลากร"
                    value={draft.code}
                    onChange={(value) => updateDraft("code", value)}
                  />
                  <Field
                    label="ชื่อ-นามสกุล"
                    value={draft.fullName}
                    onChange={(value) => updateDraft("fullName", value)}
                  />
                </div>
              </FormSection>

              <FormSection
                title="วอร์ดและค่าตอบแทน"
                description="ข้อมูลส่วนนี้ใช้ส่งต่อให้ GA และใช้สรุปค่าตอบแทนหลังจัดตาราง"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <ReadOnlyField label="วอร์ดหลัก" value={ward?.code ?? "-"} />
                  <ReadOnlyField
                    label="วอร์ดที่ขึ้นได้"
                    value={ward?.code ?? "-"}
                  />
                  <Field
                    label="ตำแหน่งเบิกจ่าย"
                    value={draft.payPosition}
                    onChange={(value) => updateDraft("payPosition", value)}
                  />
                  <Field
                    label="ค่า OT"
                    type="number"
                    value={draft.otRate}
                    onChange={(value) => updateDraft("otRate", value)}
                  />
                  <Field
                    label="ค่าเวร บ/ด"
                    type="number"
                    value={draft.shiftPayRate}
                    onChange={(value) => updateDraft("shiftPayRate", value)}
                  />
                </div>
              </FormSection>

              <FormSection
                title="คำขอและวันพิเศษ"
                description="กรอกเป็นตัวเลขหรือรายการวันที่ตามรูปแบบเดียวกับตารางหลัก"
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field
                    label="จำนวน off"
                    value={draft.off}
                    onChange={(value) => updateDraft("off", value)}
                  />
                  <Field
                    label="จำนวน V"
                    value={draft.vacation}
                    onChange={(value) => updateDraft("vacation", value)}
                  />
                  <Field
                    label="จำนวน ล"
                    value={draft.leave}
                    onChange={(value) => updateDraft("leave", value)}
                  />
                  <Field
                    label="ว (ประชุมวิชาการ)"
                    value={draft.academic}
                    onChange={(value) => updateDraft("academic", value)}
                  />
                  <Field
                    label="วันที่อยากเข้าเวร"
                    value={draft.preferredShifts}
                    onChange={(value) => updateDraft("preferredShifts", value)}
                  />
                </div>
              </FormSection>

              <FormSection
                title="บทบาท"
                description="เลือกเฉพาะบทบาทที่มีผลต่อการจัดตาราง"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <CheckboxField
                    checked={draft.isHead}
                    label="เป็นหัวหน้าวอร์ด"
                    onChange={(checked) => updateDraft("isHead", checked)}
                  />
                  <CheckboxField
                    checked={draft.isTrainee}
                    label="เป็นพยาบาลฝึกหัด"
                    onChange={(checked) => updateDraft("isTrainee", checked)}
                  />
                </div>
              </FormSection>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  ยกเลิก
                </Button>
                <Button type="button" onClick={handleAddHomeStaff}>
                  เพิ่มเข้าตาราง
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <FormSection
                title="เลือกบุคลากรช่วยวอร์ด"
                description="แสดงเฉพาะบุคลากรที่ผู้ดูแลระบบกำหนดว่าสามารถขึ้นเวรวอร์ดนี้ได้"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
                  <div className="space-y-1.5">
                    <Label>ค้นหาบุคลากร</Label>
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="ค้นหาจากรหัสหรือชื่อ"
                      className="rounded-md bg-white"
                    />
                  </div>
                  <div className="rounded-xl border bg-[#F8FDFE] px-4 py-3 text-sm">
                    <p className="text-muted-foreground">เลือกได้ตอนนี้</p>
                    <p className="mt-1 text-2xl font-semibold text-brand">
                      {filteredCandidates.length}
                    </p>
                  </div>
                </div>
              </FormSection>

              <FormSection
                title="รายชื่อที่เพิ่มได้"
                description="กดเพิ่มแล้วรายชื่อจะเข้าไปอยู่ในตารางชั่วคราวก่อน รอผู้ใช้กดบันทึกข้อมูลอีกครั้ง"
              >
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {filteredCandidates.length > 0 ? (
                    filteredCandidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                              {candidate.code}
                            </span>
                            <span className="truncate font-medium">
                              {candidate.fullName}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full bg-[#EEF7F8] px-2.5 py-1">
                              วอร์ดหลัก {candidate.homeWard}
                            </span>
                            <span className="rounded-full bg-[#EEF7F8] px-2.5 py-1">
                              {candidate.payPosition || "ไม่ระบุตำแหน่งเบิกจ่าย"}
                            </span>
                            {candidate.isTrainee ? (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                                พยาบาลฝึกหัด
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="h-9 rounded-md"
                          onClick={() => handleAddExternalStaff(candidate)}
                        >
                          เพิ่มเข้าวอร์ดนี้
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed bg-[#F8FDFE] px-4 py-8 text-center text-sm text-muted-foreground">
                      ไม่พบบุคลากรจากวอร์ดอื่นที่สามารถขึ้นเวรวอร์ดนี้ได้
                    </div>
                  )}
                </div>
              </FormSection>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  ยกเลิก
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md bg-white"
      />
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E4EEF1] bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-[#0F172A]">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} readOnly className="rounded-md bg-[#F8FDFE]" />
    </div>
  );
}

function CheckboxField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm font-medium">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[#008585]"
      />
      {label}
    </label>
  );
}
