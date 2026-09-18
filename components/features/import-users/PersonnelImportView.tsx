"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Alert02Icon,
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  FileCheckIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  confirmPersonnelImportAction,
  previewPersonnelImportAction,
} from "@/app/actions/import-users";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ImportStaffUsersSummary,
  PersonnelImportPreview,
} from "@/lib/import-users/types";

export function PersonnelImportView() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PersonnelImportPreview | null>(null);
  const [summary, setSummary] = useState<ImportStaffUsersSummary | null>(null);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isImportPending, startImportTransition] = useTransition();

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setSummary(null);
    setMessage("");
  }

  function handlePreview() {
    if (!file) return;

    startPreviewTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await previewPersonnelImportAction(formData);
      setPreview(result.preview);
      setSummary(null);
      setMessage(result.message);

      if (!result.preview) toast.error(result.message);
    });
  }

  function handleImport() {
    if (!file || !preview || preview.invalidRows > 0) return;

    startImportTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await confirmPersonnelImportAction(formData);
      setConfirmOpen(false);
      setSummary(result.summary);
      setMessage(result.message);

      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  const canImport = Boolean(preview && preview.invalidRows === 0 && file);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 py-2">
      <header className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-3" asChild>
          <Link href="/home/schedule-rounds?tab=user-management">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={17} />
            กลับไปจัดการผู้ใช้
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">นำเข้าข้อมูลบุคลากร</h1>
        <p className="text-sm text-muted-foreground">
          ตรวจสอบข้อมูลจาก Excel ก่อนเพิ่มหรืออัปเดตบุคลากรในระบบ
        </p>
      </header>

      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="personnel-file">ไฟล์ข้อมูลบุคลากร</Label>
            <Input
              id="personnel-file"
              type="file"
              accept=".xlsx,.xls"
              className="h-11 cursor-pointer bg-white file:mr-4 file:font-medium"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              รองรับ .xlsx และ .xls ขนาดไม่เกิน 10 MB ระบบจะอ่านแผ่นงานแรก
            </p>
          </div>
          <Button
            type="button"
            className="h-10 min-w-40"
            disabled={!file || isPreviewPending || isImportPending}
            onClick={handlePreview}
          >
            <HugeiconsIcon icon={FileCheckIcon} size={18} />
            {isPreviewPending ? "กำลังตรวจสอบ..." : "ตรวจสอบไฟล์"}
          </Button>
        </div>
      </section>

      {preview ? (
        <>
          <section
            className={`flex items-start gap-3 rounded-lg border p-4 ${
              preview.invalidRows > 0
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            <HugeiconsIcon
              icon={preview.invalidRows > 0 ? Alert02Icon : CheckmarkCircle02Icon}
              size={20}
              className="mt-0.5 shrink-0"
            />
            <div>
              <p className="font-semibold">{message}</p>
              <p className="mt-1 text-sm opacity-80">
                ไฟล์ {preview.fileName} · แผ่นงาน {preview.sheetName}
              </p>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Metric label="ทั้งหมด" value={preview.totalRows} />
            <Metric label="พร้อมนำเข้า" value={preview.validRows} tone="success" />
            <Metric label="ต้องแก้ไข" value={preview.invalidRows} tone="danger" />
            <Metric label="หน่วยงาน" value={preview.wardCount} />
            <Metric label="หัวหน้า" value={preview.headCount} />
            <Metric label="พยาบาลใหม่" value={preview.newNurseCount} />
            <Metric label="Incharge" value={preview.inChargeCount} />
            <Metric label="สร้างรหัสให้" value={preview.generatedCodeCount} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold">สรุปประเภทบุคลากร</h2>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4 xl:grid-cols-2">
                {Object.entries(preview.categoryCounts).map(([category, count]) => (
                  <div key={category} className="bg-white p-4">
                    <p className="text-sm text-muted-foreground">{category}</p>
                    <p className="mt-1 text-xl font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold">จำนวนบุคลากรแยกตามหน่วยงาน</h2>
              </div>
              <div className="max-h-64 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-[#EAF4F7]">
                    <TableRow>
                      <TableHead>หน่วยงาน</TableHead>
                      <TableHead className="w-32 text-right">จำนวน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.wardCounts.map((item) => (
                      <TableRow key={item.ward}>
                        <TableCell className="font-medium">{item.ward}</TableCell>
                        <TableCell className="text-right">{item.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>

          <IssueSection title="ข้อมูลที่ต้องแก้ไข" items={preview.errors} tone="danger" />
          <IssueSection title="ข้อสังเกตจากระบบ" items={preview.warnings} tone="warning" />

          <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">ตัวอย่างข้อมูลที่จะแปลง</h2>
              <p className="text-xs text-muted-foreground">
                แสดง 50 รายการแรกจากข้อมูลที่ผ่านการตรวจสอบ
              </p>
            </div>
            <div className="max-h-[480px] overflow-auto">
              <Table className="min-w-[1120px]">
                <TableHeader className="sticky top-0 bg-[#EAF4F7]">
                  <TableRow>
                    <TableHead>แถว</TableHead>
                    <TableHead>รหัส</TableHead>
                    <TableHead>หน่วยงาน</TableHead>
                    <TableHead>ตำแหน่ง</TableHead>
                    <TableHead>กลุ่ม</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">ค่าเวร</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.sampleRows.map((row) => (
                    <TableRow key={`${row.rowNumber}-${row.staffCode}`}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell className="font-medium">
                        {row.staffCode}
                        {row.generatedStaffCode ? (
                          <span className="ml-2 text-xs text-amber-700">สร้างอัตโนมัติ</span>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.homeWard}</TableCell>
                      <TableCell>{row.position}</TableCell>
                      <TableCell>{row.staffCategory}</TableCell>
                      <TableCell className="text-right">{row.otRate.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.shiftPayRate.toLocaleString()}</TableCell>
                      <TableCell>
                        {[row.isHead && "หัวหน้า", row.isNewNurse && "พยาบาลใหม่", row.canBeInCharge && "Incharge"]
                          .filter(Boolean)
                          .join(", ") || "ทั่วไป"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-lg border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">ยืนยันหลังตรวจสอบข้อมูลครบแล้ว</p>
              <p className="mt-1 text-sm text-muted-foreground">
                การนำเข้าจะเพิ่มข้อมูลใหม่และอัปเดตรหัสที่มีอยู่ แต่จะยังไม่ลบบุคลากรเดิม
              </p>
            </div>
            <Button
              type="button"
              className="h-10 min-w-44"
              disabled={!canImport || isImportPending}
              onClick={() => setConfirmOpen(true)}
            >
              <HugeiconsIcon icon={Upload01Icon} size={18} />
              ยืนยันนำเข้า
            </Button>
          </section>
        </>
      ) : null}

      {summary ? <ImportSummary summary={summary} /> : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ยืนยันนำเข้าข้อมูลบุคลากร</DialogTitle>
            <DialogDescription>
              ระบบจะนำเข้าข้อมูล {preview?.validRows ?? 0} รายการจากไฟล์ {file?.name}
              และอัปเดตบุคลากรที่มีรหัสตรงกัน
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            ขั้นตอนนี้ยังไม่ลบบุคลากรเดิมออกจากฐานข้อมูล
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isImportPending} onClick={() => setConfirmOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="button" disabled={isImportPending} onClick={handleImport}>
              {isImportPending ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "danger" }) {
  const valueClass = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-red-700" : "text-foreground";
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function IssueSection({ title, items, tone }: { title: string; items: PersonnelImportPreview["errors"]; tone: "danger" | "warning" }) {
  if (items.length === 0) return null;
  const toneClass = tone === "danger" ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50";
  return (
    <section className={`overflow-hidden rounded-lg border ${toneClass}`}>
      <div className="border-b border-inherit px-5 py-3">
        <h2 className="font-semibold">{title} ({items.length})</h2>
      </div>
      <div className="max-h-64 overflow-auto bg-white/70">
        <Table>
          <TableHeader className="sticky top-0 bg-white">
            <TableRow>
              <TableHead className="w-24">แถว</TableHead>
              <TableHead className="w-52">รหัส</TableHead>
              <TableHead>รายละเอียด</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={`${item.rowNumber}-${item.staffCode ?? ""}-${index}`}>
                <TableCell>{item.rowNumber}</TableCell>
                <TableCell>{item.staffCode ?? "-"}</TableCell>
                <TableCell>{item.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function ImportSummary({ summary }: { summary: ImportStaffUsersSummary }) {
  const hasFailures = summary.failedCount > 0;

  return (
    <section
      className={`rounded-lg border p-5 ${
        hasFailures
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <HugeiconsIcon
          icon={hasFailures ? Alert02Icon : CheckmarkCircle02Icon}
          size={22}
          className={`mt-0.5 ${hasFailures ? "text-amber-700" : "text-emerald-700"}`}
        />
        <div>
          <h2 className={`font-semibold ${hasFailures ? "text-amber-900" : "text-emerald-900"}`}>
            ผลการนำเข้า
          </h2>
          <p className={`mt-1 text-sm ${hasFailures ? "text-amber-800" : "text-emerald-800"}`}>
            สำเร็จ {summary.successCount} รายการ · สร้างใหม่ {summary.createdStaff} รายการ · อัปเดต {summary.updatedStaff} รายการ · สร้างหน่วยงาน {summary.createdWards} รายการ
          </p>
          {hasFailures ? (
            <div className="mt-3 space-y-1 text-sm text-amber-900">
              {summary.errors.slice(0, 10).map((error, index) => (
                <p key={`${error.rowNumber}-${index}`}>
                  แถว {error.rowNumber}: {error.message}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
