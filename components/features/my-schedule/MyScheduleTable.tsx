"use client";

import type { ReactNode } from "react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HorizontalScrollArea } from "@/components/features/schedule-table/HorizontalScrollArea";
import { WardCompensationSummary } from "@/components/features/my-schedule/WardCompensationSummary";
import { formatShiftLabel } from "@/lib/my-schedule/formatters";
import type {
  MyScheduleStaffRow,
  MyScheduleWardCompensationSummary,
} from "@/lib/my-schedule/types";

type MyScheduleTableProps = {
  daysInMonth: number;
  holidayDays: number[];
  month: number;
  year: number;
  rows: MyScheduleStaffRow[];
  compensationSummary: MyScheduleWardCompensationSummary;
};

const workShiftCodes = ["ด", "ช", "บ"] as const;
const noteShiftCodes = ["V", "ว", "ล"] as const;

export function MyScheduleTable({
  daysInMonth,
  holidayDays,
  month,
  year,
  rows,
  compensationSummary,
}: MyScheduleTableProps) {
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const holidayDaySet = new Set(holidayDays);
  const dayMetas = days.map((day) =>
    buildDayMeta(day, month, year, holidayDaySet),
  );
  const regularWorkTarget = dayMetas.filter((day) => !day.isHoliday).length;
  const dailyTotals = buildDailyTotals(rows, days);
  const summaryByStaffId = new Map(
    rows.map((row) => [row.id, summarizeRow(row, days, regularWorkTarget)]),
  );
  const footerSummary = summarizeAllRows(Array.from(summaryByStaffId.values()));

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">ตารางเวร</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ตารางนี้เพิ่มสรุปจำนวนเวรด้านขวา และสรุปกำลังคนรายวันด้านล่าง เพื่อให้อ่านเหมือนตารางเวรเดิม
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="hidden h-9 shrink-0 rounded-md lg:inline-flex"
              >
                <HugeiconsIcon icon={Calendar03Icon} size={17} strokeWidth={2} />
                ดูตารางเต็ม
              </Button>
            </DialogTrigger>
            <DialogContent className="grid !h-[96dvh] !w-[calc(100dvw-1.5rem)] !max-w-[calc(100dvw-1.5rem)] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-4">
              <DialogHeader className="pr-10">
                <DialogTitle>ตารางเวรแบบเต็ม</DialogTitle>
                <DialogDescription>
                  มุมมองย่อสำหรับดูทั้งตารางในหน้าจอเดียว
                </DialogDescription>
              </DialogHeader>
              <FullScheduleFitTable
                dayMetas={dayMetas}
                dailyTotals={dailyTotals}
                footerSummary={footerSummary}
                rows={rows}
                summaryByStaffId={summaryByStaffId}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <HorizontalScrollArea className="max-h-[680px]" minWidth={1520}>
        <Table className="min-w-[1520px] border-collapse">
          <TableHeader className="sticky top-0 z-30 bg-[#EAF7F7]">
            <TableRow className="hover:bg-[#EAF7F7]">
              <TableHead
                rowSpan={2}
                className="sticky left-0 z-40 w-[132px] min-w-[132px] border bg-[#D6F4F1] text-center align-middle text-brand sm:w-[180px] sm:min-w-[180px] md:w-[220px] md:min-w-[220px]"
              >
                ชื่อ - นามสกุล
              </TableHead>
              {dayMetas.map(({ day, isHoliday }) => (
                <TableHead
                  key={day}
                  className={`min-w-10 border border-[#DDEBED] px-1 text-center text-slate-900 ${
                    isHoliday ? "bg-[#E4F7F5] text-brand" : "bg-white"
                  }`}
                >
                  {day}
                </TableHead>
              ))}
              <TableHead
                colSpan={2}
                className="border border-[#DDEBED] bg-[#E4F7F5] text-center text-brand"
              >
                วันทำการ
              </TableHead>
              <TableHead
                rowSpan={2}
                className="min-w-12 border border-[#DDEBED] bg-amber-400 px-1 text-center align-middle text-slate-950"
              >
                OT
                <br />
                รวม
              </TableHead>
              <TableHead
                colSpan={4}
                className="border border-[#DDEBED] bg-brand/10 text-center text-brand"
              >
                จำนวนOT
              </TableHead>
              <TableHead
                colSpan={4}
                className="border border-[#DDEBED] bg-[#F0FAF9] text-center text-brand"
              >
                จำนวนวันทำการ
              </TableHead>
              <TableHead
                colSpan={3}
                className="border border-[#DDEBED] bg-slate-50 text-center text-slate-700"
              >
                หมายเหตุ
              </TableHead>
            </TableRow>
            <TableRow className="hover:bg-[#EAF7F7]">
              {dayMetas.map(({ day, weekday, isHoliday }) => (
                <TableHead
                  key={`weekday-${day}`}
                  className={`min-w-10 border border-[#DDEBED] px-1 py-1 text-center text-xs font-medium ${
                    isHoliday ? "bg-[#E4F7F5] text-brand" : "bg-white text-slate-600"
                  }`}
                >
                  {weekday}
                </TableHead>
              ))}
              <TableHead className="min-w-12 border border-[#DDEBED] bg-[#E4F7F5] px-1 text-center text-brand">
                ราชการ
              </TableHead>
              <TableHead className="min-w-12 border border-[#DDEBED] bg-[#E4F7F5] px-1 text-center text-brand">
                จริง
              </TableHead>
              {workShiftCodes.map((code) => (
                <TableHead
                  key={`ot-${code}`}
                  className="min-w-11 border border-[#DDEBED] bg-brand/10 px-1 text-center text-brand"
                >
                  {code}ot
                </TableHead>
              ))}
              <TableHead className="min-w-12 border border-[#DDEBED] bg-brand/10 px-1 text-center text-brand">
                OTรวม
              </TableHead>
              {workShiftCodes.map((code) => (
                <TableHead
                  key={`work-${code}`}
                  className="min-w-10 border border-[#DDEBED] bg-[#F0FAF9] px-1 text-center text-brand"
                >
                  {code}
                </TableHead>
              ))}
              <TableHead className="min-w-14 border border-[#DDEBED] bg-[#F0FAF9] px-1 text-center text-brand">
                รวมทำการ
              </TableHead>
              {noteShiftCodes.map((code) => (
                <TableHead
                  key={`note-${code}`}
                  className="min-w-10 border border-[#DDEBED] bg-slate-50 px-1 text-center text-slate-600"
                >
                  {code}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const summary = summaryByStaffId.get(row.id) ?? createEmptySummary();

              return (
                <TableRow
                  key={row.id}
                  className={
                    row.isCurrentUser
                      ? "bg-[#F3FBFA] hover:bg-[#EAF7F7]"
                      : "bg-white"
                  }
                >
                  <TableCell
                    className={`sticky left-0 z-20 w-[132px] min-w-[132px] border-r border-[#DDEBED] shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)] sm:w-[180px] sm:min-w-[180px] md:w-[220px] md:min-w-[220px] ${
                      row.isCurrentUser ? "bg-[#E4F7F5]" : "bg-white"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="truncate font-semibold">{row.staffCode}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {row.fullName}
                      </p>
                    </div>
                  </TableCell>
                  {dayMetas.map(({ day, isHoliday }) => (
                    <TableCell
                      key={day}
                      className={`border border-[#DDEBED] p-0.5 text-center ${
                        isHoliday ? "bg-[#F3FBFA]" : ""
                      }`}
                    >
                      <ShiftCell
                        isOt={row.otByDay[day] === true}
                        otShifts={row.otShiftsByDay[day]}
                        shiftCode={row.shiftsByDay[day] ?? "0"}
                      />
                    </TableCell>
                  ))}
                  <SummaryCell tone="holiday">{summary.regularWorkTarget}</SummaryCell>
                  <SummaryCell tone="holiday">{summary.actualWorkTotal}</SummaryCell>
                  <SummaryCell tone="otTotal">{summary.overtimeTotal}</SummaryCell>
                  {workShiftCodes.map((code) => (
                    <SummaryCell key={`${row.id}-ot-${code}`} tone="ot">
                      {summary.otShiftCounts[code]}
                    </SummaryCell>
                  ))}
                  <SummaryCell tone="ot">{summary.markedOtTotal}</SummaryCell>
                  {workShiftCodes.map((code) => (
                    <SummaryCell key={`${row.id}-${code}`}>
                      {summary.shiftCounts[code]}
                    </SummaryCell>
                  ))}
                  <SummaryCell tone="green">{summary.regularWorkTotal}</SummaryCell>
                  {noteShiftCodes.map((code) => (
                    <SummaryCell key={`${row.id}-${code}`} tone="note">
                      {summary.noteCounts[code]}
                    </SummaryCell>
                  ))}
                </TableRow>
              );
            })}
            {workShiftCodes.map((code, index) => {
              const isSummaryRow = index === 0;

              return (
                <TableRow key={`daily-total-${code}`} className="hover:bg-white">
                  <TableCell className="sticky left-0 z-10 border-r border-[#DDEBED] bg-white text-right text-sm font-semibold text-brand">
                    {code}
                  </TableCell>
                  {dayMetas.map(({ day, isHoliday }) => (
                    <TableCell
                      key={`${code}-${day}`}
                      className={`border border-[#DDEBED] px-1 py-1 text-center text-sm ${
                        isHoliday ? "bg-[#F3FBFA]" : "bg-white"
                      }`}
                    >
                      {dailyTotals[day]?.[code] ?? 0}
                    </TableCell>
                  ))}
                  <SummaryCell tone={isSummaryRow ? "total" : "muted"}>
                    {isSummaryRow ? footerSummary.regularWorkTarget : "-"}
                  </SummaryCell>
                  <SummaryCell tone={isSummaryRow ? "total" : "muted"}>
                    {isSummaryRow ? footerSummary.actualWorkTotal : "-"}
                  </SummaryCell>
                  <SummaryCell tone={isSummaryRow ? "total" : "muted"}>
                    {isSummaryRow ? footerSummary.overtimeTotal : "-"}
                  </SummaryCell>
                  {workShiftCodes.map((targetCode) => (
                    <SummaryCell
                      key={`${code}-ot-${targetCode}`}
                      tone={isSummaryRow ? "total" : "muted"}
                    >
                      {isSummaryRow ? footerSummary.otShiftCounts[targetCode] : "-"}
                    </SummaryCell>
                  ))}
                  <SummaryCell tone={isSummaryRow ? "total" : "muted"}>
                    {isSummaryRow ? footerSummary.markedOtTotal : "-"}
                  </SummaryCell>
                  {workShiftCodes.map((targetCode) => (
                    <SummaryCell
                      key={`${code}-right-${targetCode}`}
                      tone={isSummaryRow ? "total" : "muted"}
                    >
                      {isSummaryRow ? footerSummary.shiftCounts[targetCode] : "-"}
                    </SummaryCell>
                  ))}
                  <SummaryCell tone={isSummaryRow ? "total" : "muted"}>
                    {isSummaryRow ? footerSummary.regularWorkTotal : "-"}
                  </SummaryCell>
                  {noteShiftCodes.map((targetCode) => (
                    <SummaryCell
                      key={`${code}-note-${targetCode}`}
                      tone={isSummaryRow ? "total" : "muted"}
                    >
                      {isSummaryRow ? footerSummary.noteCounts[targetCode] : "-"}
                    </SummaryCell>
                  ))}
                </TableRow>
              );
            })}
            <CompensationSummaryRows
              daysInMonth={daysInMonth}
              summary={compensationSummary}
            />
          </TableBody>
        </Table>
      </HorizontalScrollArea>
      <WardCompensationSummary summary={compensationSummary} />
    </section>
  );
}

type DayMeta = ReturnType<typeof buildDayMeta>;
type StaffSummary = ReturnType<typeof createEmptySummary>;

function FullScheduleFitTable({
  dayMetas,
  dailyTotals,
  footerSummary,
  rows,
  summaryByStaffId,
}: {
  dayMetas: DayMeta[];
  dailyTotals: Record<number, Record<(typeof workShiftCodes)[number], number>>;
  footerSummary: StaffSummary;
  rows: MyScheduleStaffRow[];
  summaryByStaffId: Map<string, StaffSummary>;
}) {
  const compactClassName =
    rows.length > 24 ? "text-[8px] 2xl:text-[9px]" : "text-[9px] 2xl:text-[10px]";
  const staffColumnWidth =
    rows.length > 24
      ? "w-[clamp(7rem,9vw,10rem)]"
      : "w-[clamp(8rem,11vw,12rem)]";
  const dayColumnWidth =
    rows.length > 24
      ? "w-[clamp(1.75rem,1.65vw,2.25rem)]"
      : "w-[clamp(2rem,1.9vw,2.6rem)]";
  const summaryColumnWidth =
    rows.length > 24
      ? "w-[clamp(1.9rem,1.75vw,2.5rem)]"
      : "w-[clamp(2.15rem,2vw,2.85rem)]";

  return (
    <div className="min-h-0 overflow-hidden rounded-lg border border-[#DDEBED] bg-white">
      <table
        className={`h-full w-full table-fixed border-collapse leading-tight ${compactClassName}`}
      >
        <colgroup>
          <col className={staffColumnWidth} />
          {dayMetas.map((day) => (
            <col key={`full-col-day-${day.day}`} className={dayColumnWidth} />
          ))}
          {Array.from({ length: 14 }, (_, index) => (
            <col key={`full-col-summary-${index}`} className={summaryColumnWidth} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-[#EAF7F7] text-brand">
            <th rowSpan={2} className="border border-[#DDEBED] bg-[#D6F4F1] px-2">
              ชื่อ
            </th>
            {dayMetas.map(({ day, isHoliday }) => (
              <th
                key={`full-day-${day}`}
                className={`border border-[#DDEBED] px-1 py-1 ${
                  isHoliday ? "bg-[#E4F7F5]" : "bg-white text-slate-900"
                }`}
              >
                {day}
              </th>
            ))}
            <th colSpan={2} className="border border-[#DDEBED] bg-[#E4F7F5] px-1 py-1">
              วันทำการ
            </th>
            <th rowSpan={2} className="border border-[#DDEBED] bg-amber-400 px-1 text-slate-950">
              OT
            </th>
            <th colSpan={4} className="border border-[#DDEBED] bg-brand/10 px-1 py-1">
              จำนวนOT
            </th>
            <th colSpan={4} className="border border-[#DDEBED] bg-[#F0FAF9] px-1 py-1">
              จำนวนวันทำการ
            </th>
            <th colSpan={3} className="border border-[#DDEBED] bg-slate-50 px-1 py-1 text-slate-700">
              หมายเหตุ
            </th>
          </tr>
          <tr className="bg-[#F8FCFC] text-slate-600">
            {dayMetas.map(({ day, weekday, isHoliday }) => (
              <th
                key={`full-weekday-${day}`}
                className={`border border-[#DDEBED] px-1 py-1 font-medium ${
                  isHoliday ? "bg-[#E4F7F5] text-brand" : "bg-white"
                }`}
              >
                {weekday}
              </th>
            ))}
            <th className="border border-[#DDEBED] bg-[#E4F7F5] px-1 py-1 text-brand">ราช</th>
            <th className="border border-[#DDEBED] bg-[#E4F7F5] px-1 py-1 text-brand">จริง</th>
            {workShiftCodes.map((code) => (
              <th key={`full-ot-${code}`} className="border border-[#DDEBED] bg-brand/10 px-1 py-1 text-brand">
                {code}ot
              </th>
            ))}
            <th className="border border-[#DDEBED] bg-brand/10 px-1 py-1 text-brand">รวม</th>
            {workShiftCodes.map((code) => (
              <th key={`full-work-${code}`} className="border border-[#DDEBED] bg-[#F0FAF9] px-1 py-1 text-brand">
                {code}
              </th>
            ))}
            <th className="border border-[#DDEBED] bg-[#F0FAF9] px-1 py-1 text-brand">รวม</th>
            {noteShiftCodes.map((code) => (
              <th key={`full-note-${code}`} className="border border-[#DDEBED] bg-slate-50 px-1 py-1 text-slate-600">
                {code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const summary = summaryByStaffId.get(row.id) ?? createEmptySummary();

            return (
              <tr
                key={`full-row-${row.id}`}
                className={row.isCurrentUser ? "bg-[#E4F7F5]" : "bg-white"}
              >
                <td className="border border-[#DDEBED] px-2 py-1 font-semibold text-slate-950">
                  <div className="truncate">{row.staffCode}</div>
                </td>
                {dayMetas.map(({ day, isHoliday }) => {
                  const shiftCode = row.shiftsByDay[day] ?? "0";
                  const displayValue = formatShiftWithOt(
                    shiftCode,
                    row.otByDay[day] === true,
                    row.otShiftsByDay[day],
                  );

                  return (
                    <td
                      key={`full-cell-${row.id}-${day}`}
                      className={`border border-[#DDEBED] px-1 py-1 text-center font-semibold ${
                        isHoliday ? "bg-[#F3FBFA]" : ""
                      } ${displayValue === "0" ? "text-slate-300" : "text-slate-950"}`}
                    >
                      {displayValue}
                    </td>
                  );
                })}
                <FullSummaryCell tone="holiday">{summary.regularWorkTarget}</FullSummaryCell>
                <FullSummaryCell tone="holiday">{summary.actualWorkTotal}</FullSummaryCell>
                <FullSummaryCell tone="otTotal">{summary.overtimeTotal}</FullSummaryCell>
                {workShiftCodes.map((code) => (
                  <FullSummaryCell key={`full-row-${row.id}-ot-${code}`} tone="ot">
                    {summary.otShiftCounts[code]}
                  </FullSummaryCell>
                ))}
                <FullSummaryCell tone="ot">{summary.markedOtTotal}</FullSummaryCell>
                {workShiftCodes.map((code) => (
                  <FullSummaryCell key={`full-row-${row.id}-work-${code}`}>
                    {summary.shiftCounts[code]}
                  </FullSummaryCell>
                ))}
                <FullSummaryCell tone="green">{summary.regularWorkTotal}</FullSummaryCell>
                {noteShiftCodes.map((code) => (
                  <FullSummaryCell key={`full-row-${row.id}-note-${code}`} tone="note">
                    {summary.noteCounts[code]}
                  </FullSummaryCell>
                ))}
              </tr>
            );
          })}
          {workShiftCodes.map((code, index) => {
            const isSummaryRow = index === 0;

            return (
              <tr key={`full-daily-total-${code}`} className="bg-white text-brand">
                <td className="border border-[#DDEBED] px-2 py-1 text-right font-semibold">
                  {code}
                </td>
                {dayMetas.map(({ day, isHoliday }) => (
                  <td
                    key={`full-total-${code}-${day}`}
                    className={`border border-[#DDEBED] px-1 py-1 text-center ${
                      isHoliday ? "bg-[#F3FBFA]" : "bg-white"
                    }`}
                  >
                    {dailyTotals[day]?.[code] ?? 0}
                  </td>
                ))}
                <FullFooterSummaryCells footerSummary={footerSummary} show={isSummaryRow} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FullFooterSummaryCells({
  footerSummary,
  show,
}: {
  footerSummary: StaffSummary;
  show: boolean;
}) {
  const emptyValue = "-";

  return (
    <>
      <FullSummaryCell tone={show ? "total" : "muted"}>
        {show ? footerSummary.regularWorkTarget : emptyValue}
      </FullSummaryCell>
      <FullSummaryCell tone={show ? "total" : "muted"}>
        {show ? footerSummary.actualWorkTotal : emptyValue}
      </FullSummaryCell>
      <FullSummaryCell tone={show ? "total" : "muted"}>
        {show ? footerSummary.overtimeTotal : emptyValue}
      </FullSummaryCell>
      {workShiftCodes.map((code) => (
        <FullSummaryCell key={`full-footer-ot-${code}`} tone={show ? "total" : "muted"}>
          {show ? footerSummary.otShiftCounts[code] : emptyValue}
        </FullSummaryCell>
      ))}
      <FullSummaryCell tone={show ? "total" : "muted"}>
        {show ? footerSummary.markedOtTotal : emptyValue}
      </FullSummaryCell>
      {workShiftCodes.map((code) => (
        <FullSummaryCell key={`full-footer-work-${code}`} tone={show ? "total" : "muted"}>
          {show ? footerSummary.shiftCounts[code] : emptyValue}
        </FullSummaryCell>
      ))}
      <FullSummaryCell tone={show ? "total" : "muted"}>
        {show ? footerSummary.regularWorkTotal : emptyValue}
      </FullSummaryCell>
      {noteShiftCodes.map((code) => (
        <FullSummaryCell key={`full-footer-note-${code}`} tone={show ? "total" : "muted"}>
          {show ? footerSummary.noteCounts[code] : emptyValue}
        </FullSummaryCell>
      ))}
    </>
  );
}

function FullSummaryCell({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "holiday" | "otTotal" | "ot" | "green" | "note" | "total" | "muted";
}) {
  const toneClassName = {
    default: "bg-white text-slate-900",
    holiday: "bg-[#F3FBFA] text-brand",
    otTotal: "bg-amber-50 text-amber-800",
    ot: "bg-brand/5 text-brand",
    green: "bg-[#F4FBFA] text-brand",
    note: "bg-slate-50 text-slate-700",
    total: "bg-brand/10 font-semibold text-brand",
    muted: "bg-slate-50 text-slate-400",
  }[tone];

  return (
    <td className={`border border-[#DDEBED] px-1 py-1 text-center ${toneClassName}`}>
      {children}
    </td>
  );
}

function CompensationSummaryRows({
  daysInMonth,
  summary,
}: {
  daysInMonth: number;
  summary: MyScheduleWardCompensationSummary;
}) {
  const detailRows = summary.detailRows;
  const totalRows = summary.totalRows;
  const rowCount = Math.max(detailRows.length, totalRows.length, 1);

  return Array.from({ length: rowCount }, (_, index) => {
    const detail = detailRows[index];
    const total = totalRows[index];
    const isGrandTotal = total?.id === "total-all";

    return (
      <TableRow key={`compensation-summary-${index}`} className="hover:bg-white">
        <TableCell className="sticky left-0 z-10 border-r border-[#DDEBED] bg-white" />
        {Array.from({ length: daysInMonth }, (_, dayIndex) => (
          <TableCell
            key={`compensation-blank-${index}-${dayIndex}`}
            className="h-8 border border-[#DDEBED] bg-white"
          />
        ))}
        <TableCell
          colSpan={2}
          className="border border-[#DDEBED] bg-white px-2 py-1 text-right text-xs font-medium text-slate-900"
        >
          {detail?.label ?? ""}
        </TableCell>
        <TableCell
          colSpan={2}
          className="border border-[#DDEBED] bg-white px-2 py-1 text-right text-sm text-slate-900"
        >
          {detail ? formatNumber(detail.rate) : ""}
        </TableCell>
        <TableCell
          colSpan={2}
          className="border border-[#DDEBED] bg-white px-2 py-1 text-right text-sm text-slate-900"
        >
          {detail ? formatNumber(detail.quantity) : ""}
        </TableCell>
        <TableCell
          colSpan={3}
          className="border border-[#DDEBED] bg-white px-2 py-1 text-right text-sm font-semibold text-slate-900"
        >
          {detail ? formatMoney(detail.amount) : ""}
        </TableCell>
        <TableCell
          colSpan={3}
          className={`border border-[#DDEBED] px-2 py-1 text-center text-sm font-semibold ${
            isGrandTotal ? "bg-brand/10 text-slate-950" : "bg-white text-slate-900"
          }`}
        >
          {total?.label ?? ""}
        </TableCell>
        <TableCell
          colSpan={2}
          className={`border border-[#DDEBED] px-2 py-1 text-right text-sm font-semibold ${
            isGrandTotal ? "bg-brand/10 text-brand" : "bg-white text-slate-900"
          }`}
        >
          {total ? formatMoney(total.amount) : ""}
        </TableCell>
      </TableRow>
    );
  });
}

function ShiftCell({
  shiftCode,
  isOt,
  otShifts,
}: {
  shiftCode: string;
  isOt: boolean;
  otShifts: string | null;
}) {
  const isEmpty = !shiftCode || shiftCode === "0";
  const displayValue = formatShiftWithOt(shiftCode, isOt, otShifts);
  const className = isEmpty
    ? "text-slate-300"
    : isOt
      ? "text-slate-950"
      : "text-slate-950";

  return (
    <span
      className={`inline-flex h-8 min-w-8 items-center justify-center px-1 text-sm font-semibold ${className}`}
      data-ot-shifts={otShifts ?? undefined}
      title={isOt ? "มี OT" : undefined}
    >
      {displayValue}
    </span>
  );
}

function formatShiftWithOt(
  shiftCode: string,
  isOt: boolean,
  otShifts: string | null,
) {
  const normalizedShift = formatShiftLabel(shiftCode).trim();

  if (!normalizedShift || normalizedShift === "0" || !isOt) {
    return normalizedShift || "0";
  }

  const shiftParts = splitShiftCode(normalizedShift);
  const otParts = otShifts ? splitShiftCode(otShifts) : shiftParts;
  const otPartSet = new Set(otParts);

  if (shiftParts.length === 0) {
    return normalizedShift;
  }

  return shiftParts
    .map((part) => `${part}${otPartSet.has(part) ? "OT" : ""}`)
    .join("/");
}

function SummaryCell({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "holiday" | "otTotal" | "ot" | "green" | "note" | "total" | "muted";
}) {
  const toneClassName = {
    default: "bg-white text-slate-900",
    holiday: "bg-[#F3FBFA] text-brand",
    otTotal: "bg-amber-50 font-semibold text-amber-800",
    ot: "bg-brand/5 text-brand",
    green: "bg-[#F4FBFA] text-brand",
    note: "bg-slate-50 text-slate-700",
    total: "bg-brand/10 font-semibold text-brand",
    muted: "bg-slate-50 text-slate-400",
  }[tone];

  return (
    <TableCell
      className={`border border-[#DDEBED] px-1 py-1 text-center text-sm ${toneClassName}`}
    >
      {children}
    </TableCell>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildDayMeta(
  day: number,
  month: number,
  year: number,
  holidayDaySet: Set<number>,
) {
  const normalYear = year > 2400 ? year - 543 : year;
  const date = new Date(normalYear, month - 1, day);
  const weekdayIndex = date.getDay();
  const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;

  return {
    day,
    weekday: ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][weekdayIndex],
    isHoliday: isWeekend || holidayDaySet.has(day),
  };
}

function summarizeRow(
  row: MyScheduleStaffRow,
  days: number[],
  regularWorkTarget: number,
) {
  const summary = createEmptySummary();
  summary.regularWorkTarget = regularWorkTarget;

  for (const day of days) {
    const shiftCode = row.shiftsByDay[day] ?? "0";
    const shiftParts = splitShiftCode(shiftCode);
    const otParts = resolveOtShiftParts({
      isOt: row.otByDay[day],
      otShifts: row.otShiftsByDay[day],
      shiftParts,
    });
    const otPartSet = new Set(otParts);

    for (const code of shiftParts) {
      if (isWorkShiftCode(code)) {
        if (!otPartSet.has(code)) {
          summary.shiftCounts[code] += 1;
        }
        summary.actualWorkTotal += 1;
      } else if (isNoteShiftCode(code)) {
        summary.noteCounts[code] += 1;
        if (code === noteShiftCodes[1]) {
          summary.actualWorkTotal += 1;
        }
      }
    }

    if (otParts.length > 0) {
      for (const code of otParts) {
        if (isWorkShiftCode(code)) {
          summary.otShiftCounts[code] += 1;
          summary.markedOtTotal += 1;
        }
      }
    }
  }

  summary.regularWorkTotal =
    Object.values(summary.shiftCounts).reduce((sum, value) => sum + value, 0) +
    summary.noteCounts[noteShiftCodes[1]];
  summary.overtimeTotal = summary.markedOtTotal;

  return summary;
}

function createEmptySummary() {
  return {
    regularWorkTarget: 0,
    actualWorkTotal: 0,
    regularWorkTotal: 0,
    overtimeTotal: 0,
    markedOtTotal: 0,
    otShiftCounts: {
      "ช": 0,
      "บ": 0,
      "ด": 0,
    },
    shiftCounts: {
      "ช": 0,
      "บ": 0,
      "ด": 0,
    },
    noteCounts: {
      V: 0,
      "ว": 0,
      "ล": 0,
    },
  };
}

function buildDailyTotals(rows: MyScheduleStaffRow[], days: number[]) {
  const totals: Record<number, Record<(typeof workShiftCodes)[number], number>> =
    {};

  for (const day of days) {
    totals[day] = {
      "ช": 0,
      "บ": 0,
      "ด": 0,
    };
  }

  for (const row of rows) {
    for (const day of days) {
      for (const code of splitShiftCode(row.shiftsByDay[day] ?? "0")) {
        if (isWorkShiftCode(code)) {
          totals[day][code] += 1;
        }
      }
    }
  }

  return totals;
}

function summarizeAllRows(summaries: Array<ReturnType<typeof createEmptySummary>>) {
  const total = createEmptySummary();

  for (const summary of summaries) {
    total.regularWorkTarget += summary.regularWorkTarget;
    total.actualWorkTotal += summary.actualWorkTotal;
    total.regularWorkTotal += summary.regularWorkTotal;
    total.overtimeTotal += summary.overtimeTotal;
    total.markedOtTotal += summary.markedOtTotal;

    for (const code of workShiftCodes) {
      total.otShiftCounts[code] += summary.otShiftCounts[code];
      total.shiftCounts[code] += summary.shiftCounts[code];
    }

    for (const code of noteShiftCodes) {
      total.noteCounts[code] += summary.noteCounts[code];
    }
  }

  return total;
}

function splitShiftCode(value: string) {
  const code = value.trim().replace(/\s/g, "");

  if (!code || code === "0") {
    return [];
  }

  if (code.includes("/")) {
    return code.split("/").filter(Boolean);
  }

  if (code === "ชบ") {
    return ["ช", "บ"];
  }

  if (code === "ดบ") {
    return ["ด", "บ"];
  }

  return [code];
}

function resolveOtShiftParts({
  isOt,
  otShifts,
  shiftParts,
}: {
  isOt: boolean;
  otShifts: string | null;
  shiftParts: string[];
}) {
  if (otShifts) {
    return splitShiftCode(otShifts);
  }

  return isOt ? shiftParts : [];
}

function isWorkShiftCode(
  value: string,
): value is (typeof workShiftCodes)[number] {
  return workShiftCodes.includes(value as (typeof workShiftCodes)[number]);
}

function isNoteShiftCode(value: string): value is (typeof noteShiftCodes)[number] {
  return noteShiftCodes.includes(value as (typeof noteShiftCodes)[number]);
}

