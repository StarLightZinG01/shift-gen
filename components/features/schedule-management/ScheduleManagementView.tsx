import {
  Add01Icon,
  Calendar03Icon,
  CancelCircleHalfDotIcon,
  CrownIcon,
  Delete02Icon,
  GraduationCapIcon,
  Hospital02Icon,
  SaveIcon,
  Sun01Icon,
  SunCloud01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ReadinessCheckCard } from "@/components/features/schedule-management/ReadinessCheckCard";
import { ScheduleManagementForm } from "@/components/features/schedule-management/ScheduleManagementForm";
import { StaffTable as StaffDraftTable } from "@/components/features/schedule-management/StaffTable";
import { WardSummaryCard } from "@/components/features/schedule-management/WardSummaryCard";
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
import {
  formatCycleStatus,
  formatDateRange,
  formatDateTime,
  formatHolidayList,
  formatMonthYear,
  formatRequestDate,
  formatWardLabel,
} from "@/lib/schedule-management/formatters";
import type {
  CycleContext,
  ExternalStaffCandidate,
  RequestSummaryRow,
  StaffingRequirements,
  StaffRow,
  WardContext,
} from "@/lib/schedule-management/types";

type ScheduleManagementViewProps = {
  ward: WardContext | null;
  cycle: CycleContext;
  externalStaffCandidates: ExternalStaffCandidate[];
  staffRows: StaffRow[];
  requestRows: RequestSummaryRow[];
  staffingRequirements: StaffingRequirements | null;
  mode?: "ward_head" | "admin";
};

export function ScheduleManagementView({
  ward,
  cycle,
  externalStaffCandidates,
  staffRows,
  requestRows,
  staffingRequirements,
  mode = "ward_head",
}: ScheduleManagementViewProps) {
  const monthYearLabel = formatMonthYear(cycle.month, cycle.year);
  const canManageWard = Boolean(ward);
  const canSaveData = Boolean(ward && cycle.id);
  const isAdminMode = mode === "admin";

  return (
    <div className="container pb-8">
      <header className="mb-6 space-y-1 rounded-2xl border bg-white px-8 py-12 shadow-sm">
        <p className="text-xl font-bold">
          {isAdminMode ? (
            <>
              ตรวจสอบข้อมูลวอร์ด:{" "}
              <span className="text-brand">
                {ward ? formatWardLabel(ward) : "ไม่พบวอร์ด"}
              </span>
            </>
          ) : (
            <>
              กรอกข้อมูลสำหรับจัดตารางเวรของเดือน{" "}
              <span className="text-brand">{monthYearLabel}</span>
            </>
          )}
        </p>
        <p className="text-muted-foreground">
          {isAdminMode
            ? "โหมดผู้ดูแลระบบ สามารถตรวจสอบและแก้ไขข้อมูลของวอร์ดนี้ได้"
            : "ตรวจสอบข้อมูลก่อนระบบจัดตารางเวรอัตโนมัติ"}
        </p>
        <ul className="my-4 list-inside list-disc pl-4 text-sm text-muted-foreground">
          <li>
            เปิดให้ตรวจสอบและแก้ไขข้อมูล{" "}
            {formatDateRange(cycle.requestOpenDate, cycle.requestCloseDate)}
          </li>
          <li>เริ่มจัดตาราง{formatDateTime(cycle.autoGenerateAt)}</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <div className="inline-block rounded-full bg-[#EBF3F7] px-4 py-1 text-sm font-medium">
            สถานะ: {formatCycleStatus(cycle.status)}
          </div>
          {ward ? (
            <div className="inline-block rounded-full bg-brand/10 px-4 py-1 text-sm font-medium text-brand">
              วอร์ด: {formatWardLabel(ward)}
            </div>
          ) : (
            <div className="inline-block rounded-full bg-amber-100 px-4 py-1 text-sm font-medium text-amber-900">
              ไม่มีวอร์ดที่ผูกกับบัญชีนี้
            </div>
          )}
          {isAdminMode ? (
            <div className="inline-block rounded-full bg-violet-100 px-4 py-1 text-sm font-medium text-violet-700">
              โหมดผู้ดูแลระบบ
            </div>
          ) : null}
        </div>
      </header>

      {!canManageWard ? (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-950 shadow-sm">
          <h2 className="font-semibold">ไม่พบวอร์ดสำหรับผู้ใช้คนนี้</h2>
          <p className="mt-1 text-sm">
            บัญชีนี้ยังไม่ได้ผูกกับข้อมูลบุคลากรหรือวอร์ด
            จึงไม่สามารถตรวจสอบข้อมูลสำหรับจัดตารางเวรได้
          </p>
        </section>
      ) : null}

      <ScheduleManagementForm>
        <input name="cycleId" type="hidden" value={cycle.id ?? ""} />
        <input name="wardId" type="hidden" value={ward?.id ?? ""} />
        <input name="mode" type="hidden" value={mode} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ScheduleCycleCard
            cycle={cycle}
            ward={ward}
            monthYearLabel={monthYearLabel}
          />
          <StaffingRequirementsCard
            staffingRequirements={staffingRequirements}
          />
        </div>

        <StaffDraftTable
          canManageWard={canManageWard}
          externalStaffCandidates={externalStaffCandidates}
          initialStaffRows={staffRows}
          ward={ward}
        />

        <RequestSummaryTable requestRows={requestRows} ward={ward} />

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <ReadinessCheckCard
            staffRows={staffRows}
            staffingRequirements={staffingRequirements}
          />
          <WardSummaryCard
            requestRows={requestRows}
            staffRows={staffRows}
            staffingRequirements={staffingRequirements}
            ward={ward}
          />
        </div>
        <Button
          type="submit"
          disabled={!canSaveData}
          className="h-14 w-full rounded-md text-lg font-semibold shadow-sm"
        >
          <HugeiconsIcon icon={SaveIcon} size={22} strokeWidth={2} />
          บันทึกข้อมูล
        </Button>
      </ScheduleManagementForm>
    </div>
  );
}

type ScheduleCycleCardProps = {
  cycle: CycleContext;
  ward: WardContext | null;
  monthYearLabel: string;
};

function ScheduleCycleCard({ cycle, ward, monthYearLabel }: ScheduleCycleCardProps) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <span className="font-medium">1. ข้อมูลรอบจัดตาราง</span>
      <div className="mt-4 flex gap-4">
        <IconBox icon={Hospital02Icon} />
        <div className="w-full space-y-1.5">
          <Label className="text-muted-foreground">หน่วยงาน</Label>
          <Input
            value={ward ? formatWardLabel(ward) : "ไม่มีวอร์ด"}
            readOnly
            className="bg-white"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-4">
        <IconBox icon={Calendar03Icon} />
        <div className="w-full space-y-1.5">
          <Label className="text-muted-foreground">เดือน / ปี</Label>
          <Input value={monthYearLabel} readOnly className="bg-white" />
        </div>
      </div>

      <div className="mt-4 flex gap-4">
        <IconBox icon={CancelCircleHalfDotIcon} />
        <div className="w-full space-y-1.5">
          <Label className="text-muted-foreground">วันหยุดนักขัตฤกษ์</Label>
          <Input
            value={formatHolidayList(cycle.holidays)}
            readOnly
            className="bg-white text-muted-foreground"
          />
        </div>
      </div>
    </section>
  );
}

function StaffingRequirementsCard({
  staffingRequirements,
}: {
  staffingRequirements: StaffingRequirements | null;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">2. กำหนดกำลังคน</span>
        {!staffingRequirements ? (
          <span className="rounded-full bg-[#EBF3F7] px-3 py-1 text-xs font-medium text-muted-foreground">
            ยังไม่บันทึกข้อมูล
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StaffingCard
          title="เวรดึก"
          icon={Sun01Icon}
          namePrefix="night"
          className="bg-[#DEDBFF]"
          min={staffingRequirements?.night?.min}
          max={staffingRequirements?.night?.max}
        />
        <StaffingCard
          title="เวรเช้า"
          icon={Sun01Icon}
          namePrefix="morning"
          className="bg-[#FFFAD4]"
          min={staffingRequirements?.morning?.min}
          max={staffingRequirements?.morning?.max}
        />
        <StaffingCard
          title="เวรบ่าย"
          icon={SunCloud01Icon}
          namePrefix="afternoon"
          className="bg-[#D7EFFB]"
          min={staffingRequirements?.afternoon?.min}
          max={staffingRequirements?.afternoon?.max}
        />
      </div>
    </section>
  );
}

type StaffTableProps = {
  canManageWard: boolean;
  staffRows: StaffRow[];
  ward: WardContext | null;
};

export function StaffTable({ canManageWard, staffRows, ward }: StaffTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">3. ข้อมูลบุคลากร</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ward
              ? `แสดงข้อมูลบุคลากรในวอร์ด ${formatWardLabel(ward)}`
              : "ยังไม่มีวอร์ดสำหรับใช้แสดงรายชื่อบุคลากร"}
          </p>
        </div>
        <Button
          className="h-9 w-full rounded-md sm:w-auto"
          disabled={!canManageWard}
        >
          <HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />
          เพิ่มบุคลากร
        </Button>
      </div>

      <Table>
        <TableHeader className="bg-[#EAF4F7]">
          <TableRow className="hover:bg-[#EAF4F7]">
            <TableHead className="min-w-16 text-center">ลำดับ</TableHead>
            <TableHead className="min-w-24">รหัส</TableHead>
            <TableHead className="min-w-44">ชื่อ</TableHead>
            <TableHead className="min-w-32">วอร์ดหลัก</TableHead>
            <TableHead className="min-w-44">วอร์ดที่ขึ้นได้</TableHead>
            <TableHead className="min-w-44">ตำแหน่งเบิกจ่าย</TableHead>
            <TableHead className="min-w-28">ค่า OT</TableHead>
            <TableHead className="min-w-28">ค่าเวร (บ)</TableHead>
            <TableHead className="min-w-28">บทบาท</TableHead>
            <TableHead className="min-w-24">O (off)</TableHead>
            <TableHead className="min-w-24">V</TableHead>
            <TableHead className="min-w-24">ล</TableHead>
            <TableHead className="w-14 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {staffRows.length > 0 ? (
            staffRows.map((row, index) => (
              <StaffTableRow key={row.id} index={index} row={row} />
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={13}
                className="h-28 text-center text-muted-foreground"
              >
                {ward
                  ? "ยังไม่มีข้อมูลบุคลากรในวอร์ดนี้"
                  : "ไม่มีวอร์ดที่ผูกกับบัญชีนี้"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}

function StaffTableRow({ row, index }: { row: StaffRow; index: number }) {
  return (
    <TableRow className="bg-white">
      <TableCell className="text-center font-medium text-muted-foreground">
        <input name="staffId" type="hidden" value={row.id} />
        {index + 1}
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.code`}
          defaultValue={row.code}
          className="h-8 rounded-md"
          required
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.fullName`}
          defaultValue={row.fullName}
          className="h-8 rounded-md"
          required
        />
      </TableCell>
      <TableCell>
        <Select defaultValue={row.homeWard}>
          <SelectTrigger className="h-8 rounded-md bg-white">
            <SelectValue placeholder="เลือกวอร์ด" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={row.homeWard}>{row.homeWard}</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          defaultValue={row.allowedWards.join(", ")}
          className="h-8 rounded-md"
          placeholder="เช่น PED3, PICU"
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.payPosition`}
          defaultValue={row.payPosition}
          className="h-8 rounded-md"
          required
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.otRate`}
          type="number"
          min={0}
          step="0.01"
          defaultValue={row.otRate}
          className="h-8 rounded-md"
          required
        />
      </TableCell>
      <TableCell>
        <Input
          name={`staff.${row.id}.shiftPayRate`}
          type="number"
          min={0}
          step="0.01"
          defaultValue={row.shiftPayRate}
          className="h-8 rounded-md"
          required
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <RoleBadge active={row.isHead} icon={CrownIcon} label="หัวหน้า" />
          <RoleBadge
            active={row.isTrainee}
            icon={GraduationCapIcon}
            label="พยาบาลฝึกหัด"
          />
        </div>
      </TableCell>
      <TableCell>
        <Input defaultValue={row.off} className="h-8 rounded-md" />
      </TableCell>
      <TableCell>
        <Input defaultValue={row.vacation} className="h-8 rounded-md" />
      </TableCell>
      <TableCell>
        <Input defaultValue={row.leave} className="h-8 rounded-md" />
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-md text-red-500 hover:bg-red-50 hover:text-red-600"
          aria-label={`ลบบุคลากร ${row.code}`}
        >
          <HugeiconsIcon icon={Delete02Icon} size={17} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function RequestSummaryTable({
  requestRows,
  ward,
}: {
  requestRows: RequestSummaryRow[];
  ward: WardContext | null;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">
            4. สรุปคำขอลา / วัน off ที่พนักงานส่งมา
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ward
              ? `รายการคำขอของบุคลากรในวอร์ด ${formatWardLabel(ward)}`
              : "ยังไม่มีวอร์ดสำหรับใช้แสดงรายการคำขอ"}
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
          {requestRows.length} รายการ
        </span>
      </div>

      <div className="max-h-[320px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-[#EAF4F7]">
            <TableRow className="hover:bg-[#EAF4F7]">
              <TableHead className="min-w-24">รหัส</TableHead>
              <TableHead className="min-w-52">ชื่อ</TableHead>
              <TableHead className="min-w-24">คำขอ</TableHead>
              <TableHead className="min-w-32">วันที่</TableHead>
              <TableHead className="min-w-[360px]">เหตุผล</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requestRows.length > 0 ? (
              requestRows.map((request) => (
                <TableRow key={request.id} className="bg-white">
                  <TableCell className="font-medium">
                    {request.staffCode}
                  </TableCell>
                  <TableCell>{request.displayName}</TableCell>
                  <TableCell>
                    <RequestTypeBadge
                      type={request.requestType}
                      preferredShift={request.preferredShift}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRequestDate(request.requestDate)}
                  </TableCell>
                  <TableCell>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {request.reason || "ไม่มีเหตุผลเพิ่มเติม"}
                    </p>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-28 text-center text-muted-foreground"
                >
                  {ward
                    ? "ยังไม่มีคำขอลา / วัน off จากพนักงานในวอร์ดนี้"
                    : "ไม่มีวอร์ดที่ผูกกับบัญชีนี้"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

type IconBoxProps = {
  icon: typeof Hospital02Icon;
};

function IconBox({ icon }: IconBoxProps) {
  return (
    <div className="flex items-center justify-center rounded-md bg-[#D1F7F7] p-3 text-brand">
      <HugeiconsIcon icon={icon} size={32} />
    </div>
  );
}

type StaffingCardProps = {
  title: string;
  icon: typeof Sun01Icon;
  namePrefix: "morning" | "afternoon" | "night";
  className: string;
  min?: number;
  max?: number;
};

function StaffingCard({
  title,
  icon,
  namePrefix,
  className,
  min,
  max,
}: StaffingCardProps) {
  return (
    <div className={`${className} space-y-4 rounded-lg p-4`}>
      <div className="flex items-center gap-2 font-medium">
        <HugeiconsIcon icon={icon} />
        {title}
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">ขั้นต่ำ</Label>
        <Input
          name={`${namePrefix}Min`}
          type="number"
          min={0}
          defaultValue={min ?? ""}
          placeholder="ยังไม่กำหนด"
          className="bg-white"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">สูงสุด</Label>
        <Input
          name={`${namePrefix}Max`}
          type="number"
          min={0}
          defaultValue={max ?? ""}
          placeholder="ยังไม่กำหนด"
          className="bg-white"
          required
        />
      </div>
    </div>
  );
}

type RoleBadgeProps = {
  active: boolean;
  icon: typeof CrownIcon;
  label: string;
};

function RoleBadge({ active, icon, label }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex size-8 items-center justify-center rounded-md border ${
        active
          ? "border-brand/20 bg-brand/10 text-brand"
          : "border-[#DDEBED] bg-white text-muted-foreground"
      }`}
      title={label}
    >
      <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} />
    </span>
  );
}

function RequestTypeBadge({
  type,
  preferredShift,
}: {
  type: string;
  preferredShift?: string | null;
}) {
  const normalizedType = type.toLowerCase();
  const tone =
    normalizedType === "off"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : normalizedType === "v"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : type === "ว"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : type === "PreferredShift"
            ? "border-brand/25 bg-brand/10 text-brand"
            : "border-rose-200 bg-rose-50 text-rose-700";
  const label =
    type === "PreferredShift"
      ? `อยากเข้าเวร${preferredShift ? ` ${preferredShift}` : ""}`
      : type;

  return (
    <span
      className={`inline-flex min-w-14 justify-center rounded-md border px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}
