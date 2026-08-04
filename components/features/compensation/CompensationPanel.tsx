"use client";

import { useMemo, useState } from "react";
import {
  DollarCircleIcon,
  MoneyBag01Icon,
  Moon02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { RecalculateCompensationButton } from "@/components/features/compensation/RecalculateCompensationButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCompensationAmount } from "@/lib/compensation/formatters";
import type { CompensationSummaryData } from "@/lib/compensation/types";

type CompensationPanelProps = {
  data: CompensationSummaryData;
};

export function CompensationPanel({ data }: CompensationPanelProps) {
  const [selectedWardId, setSelectedWardId] = useState<string>(
    data.wards[0]?.wardId ?? "",
  );
  const [search, setSearch] = useState("");
  const selectedWard =
    data.wards.find((ward) => ward.wardId === selectedWardId) ??
    data.wards[0] ??
    null;
  const filteredStaff = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!selectedWard) {
      return [];
    }

    return selectedWard.staffSummaries.filter((staff) => {
      return (
        !keyword ||
        staff.staffCode.toLowerCase().includes(keyword) ||
        staff.fullName.toLowerCase().includes(keyword) ||
        staff.payPosition.toLowerCase().includes(keyword)
      );
    });
  }, [search, selectedWard]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">สรุปค่าตอบแทน</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              คำนวณจากตารางเวรที่สร้างแล้ว แยก OT และค่าเวร บ/ด ตามวอร์ด
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={data.scheduleVersionId ?? ""}
              disabled={data.versionOptions.length === 0}
              onValueChange={(versionId) => {
                const params = new URLSearchParams({
                  tab: "compensation",
                  compensationVersionId: versionId,
                });
                window.location.href = `/schedule-rounds?${params.toString()}`;
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-md bg-white sm:w-[320px]">
                <SelectValue placeholder="เลือกตารางเวร" />
              </SelectTrigger>
              <SelectContent>
                {data.versionOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RecalculateCompensationButton
              scheduleVersionId={data.scheduleVersionId}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            {data.scheduleVersionLabel}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              data.hasStoredSummary
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {data.hasStoredSummary
              ? "มีข้อมูลค่าตอบแทนที่บันทึกแล้ว"
              : "ยังไม่ได้บันทึก summary กดคำนวณใหม่เพื่อบันทึก"}
          </span>
        </div>
      </section>

      {data.scheduleVersionId ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              icon={Moon02Icon}
              label="รวม OT"
              value={formatCompensationAmount(data.totalOtAmount)}
              tone="amber"
            />
            <SummaryCard
              icon={MoneyBag01Icon}
              label="รวมค่าเวร บ/ด"
              value={formatCompensationAmount(data.totalRegularShiftAmount)}
              tone="teal"
            />
            <SummaryCard
              icon={DollarCircleIcon}
              label="รวมค่าตอบแทนทั้งหมด"
              value={formatCompensationAmount(data.totalAmount)}
              tone="green"
            />
          </div>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h3 className="font-semibold">สรุปแยกตามวอร์ด</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#EAF4F7]">
                  <TableRow className="hover:bg-[#EAF4F7]">
                    <TableHead className="min-w-56">วอร์ด</TableHead>
                    <TableHead className="min-w-40 text-right">OT รวม</TableHead>
                    <TableHead className="min-w-40 text-right">
                      ค่าเวรรวม
                    </TableHead>
                    <TableHead className="min-w-40 text-right">
                      รวมทั้งหมด
                    </TableHead>
                    <TableHead className="min-w-32 text-right">
                      รายละเอียด
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.wards.map((ward) => (
                    <TableRow key={ward.wardId} className="bg-white">
                      <TableCell>
                        <p className="font-semibold">{ward.wardCode}</p>
                        <p className="text-xs text-muted-foreground">
                          {ward.wardName}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompensationAmount(ward.totalOtAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompensationAmount(
                          ward.totalRegularShiftAmount,
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCompensationAmount(ward.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            selectedWard?.wardId === ward.wardId
                              ? "default"
                              : "outline"
                          }
                          className="rounded-md"
                          onClick={() => setSelectedWardId(ward.wardId)}
                        >
                          ดูรายละเอียด
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {selectedWard ? (
            <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b px-5 py-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="font-semibold">
                    รายละเอียดวอร์ด {selectedWard.wardCode}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    แสดงจำนวนเวรและค่าตอบแทนรายบุคคล
                  </p>
                </div>
                <div className="w-full space-y-1.5 md:w-72">
                  <Label>ค้นหารายชื่อ</Label>
                  <div className="relative">
                    <HugeiconsIcon
                      icon={Search01Icon}
                      size={18}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="รหัส / ชื่อ / ตำแหน่ง"
                      className="h-10 rounded-md bg-white pl-10"
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#EAF4F7]">
                    <TableRow className="hover:bg-[#EAF4F7]">
                      <TableHead className="min-w-24">รหัส</TableHead>
                      <TableHead className="min-w-52">ชื่อ</TableHead>
                      <TableHead className="min-w-32">ตำแหน่งเบิกจ่าย</TableHead>
                      <TableHead className="text-center">ช</TableHead>
                      <TableHead className="text-center">บ</TableHead>
                      <TableHead className="text-center">ด</TableHead>
                      <TableHead className="text-center">ว</TableHead>
                      <TableHead className="text-center">เวรรวม</TableHead>
                      <TableHead className="text-center">OT</TableHead>
                      <TableHead className="min-w-32 text-right">เงิน OT</TableHead>
                      <TableHead className="min-w-32 text-right">ค่าเวร</TableHead>
                      <TableHead className="min-w-32 text-right">รวม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.length > 0 ? (
                      filteredStaff.map((staff) => (
                        <TableRow key={staff.staffId} className="bg-white">
                          <TableCell className="font-medium">
                            {staff.staffCode}
                          </TableCell>
                          <TableCell>{staff.fullName}</TableCell>
                          <TableCell>{staff.payPosition}</TableCell>
                          <TableCell className="text-center">
                            {staff.morningCount}
                          </TableCell>
                          <TableCell className="text-center">
                            {staff.afternoonCount}
                          </TableCell>
                          <TableCell className="text-center">
                            {staff.nightCount}
                          </TableCell>
                          <TableCell className="text-center">
                            {staff.academicCount}
                          </TableCell>
                          <TableCell className="text-center">
                            {staff.totalWorkUnits}
                          </TableCell>
                          <TableCell className="text-center">
                            {staff.otCount}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCompensationAmount(staff.otAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCompensationAmount(staff.shiftPayAmount)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCompensationAmount(staff.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="h-28 text-center text-muted-foreground"
                        >
                          ไม่พบข้อมูลบุคลากรตามเงื่อนไขที่เลือก
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="rounded-2xl border border-dashed bg-white p-8 text-center shadow-sm">
          <h3 className="text-xl font-semibold">ยังไม่มีตารางเวร</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            เมื่อ GA สร้างตารางและบันทึก assignment แล้ว จะสามารถคำนวณค่าตอบแทนได้จากหน้านี้
          </p>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: typeof DollarCircleIcon;
  label: string;
  value: string;
  tone: "amber" | "teal" | "green";
}) {
  const toneClassName = {
    amber: "bg-amber-100 text-amber-700",
    teal: "bg-brand/10 text-brand",
    green: "bg-emerald-100 text-emerald-700",
  }[tone];

  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-bold">{value}</p>
        </div>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneClassName}`}
        >
          <HugeiconsIcon icon={icon} size={20} strokeWidth={2} />
        </div>
      </div>
    </article>
  );
}
