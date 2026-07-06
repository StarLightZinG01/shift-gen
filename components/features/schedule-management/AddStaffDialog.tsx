"use client";

import { useMemo, useState } from "react";

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
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
  }

  function handleAddHomeStaff() {
    if (!ward) {
      setError("ไม่พบวอร์ดสำหรับเพิ่มบุคลากร");
      return;
    }

    const validationError = validateNewStaffDraft(draft);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (hasDuplicateStaff(existingRows, { code: draft.code })) {
      setError("มีบุคลากรรหัสนี้อยู่ในตารางแล้ว");
      return;
    }

    onAddStaff(buildNewStaffRow(draft, ward));
    setDraft(initialDraft);
    setError(null);
    onOpenChange(false);
  }

  function handleAddExternalStaff(candidate: ExternalStaffCandidate) {
    if (hasDuplicateStaff(existingRows, { code: candidate.code, staffId: candidate.id })) {
      setError("มีบุคลากรคนนี้อยู่ในตารางแล้ว");
      return;
    }

    onAddStaff(buildExternalStaffRow(candidate));
    setSearch("");
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
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
                setError(null);
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
                setError(null);
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

          {error ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          {mode === "home" ? (
            <div className="space-y-5">
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

              <div className="grid gap-4 md:grid-cols-3">
                <Field
                  label="จำนวน off"
                  type="number"
                  value={draft.off}
                  onChange={(value) => updateDraft("off", value)}
                />
                <Field
                  label="จำนวน V"
                  type="number"
                  value={draft.vacation}
                  onChange={(value) => updateDraft("vacation", value)}
                />
                <Field
                  label="จำนวน ล"
                  type="number"
                  value={draft.leave}
                  onChange={(value) => updateDraft("leave", value)}
                />
              </div>

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
              <div className="space-y-1.5">
                <Label>ค้นหาบุคลากร</Label>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหาจากรหัสหรือชื่อ"
                  className="rounded-md bg-white"
                />
              </div>

              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {filteredCandidates.length > 0 ? (
                  filteredCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{candidate.code}</span>
                          <span className="truncate font-medium">
                            {candidate.fullName}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          วอร์ดหลัก {candidate.homeWard} • {candidate.payPosition || "ไม่ระบุตำแหน่งเบิกจ่าย"}
                        </p>
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
