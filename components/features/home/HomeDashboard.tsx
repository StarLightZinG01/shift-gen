import { Fragment } from "react";
import Link from "next/link";
import {
  Calendar03Icon,
  CalendarCheckIcon,
  CalendarXIcon,
  CircleIcon,
  Clock01Icon,
  Coffee01Icon,
  Hospital02Icon,
  Moon02Icon,
  Sun01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import type {
  HomeAdminDashboardData,
  HomeDashboardData,
  HomeSummaryCard,
  HomeUpcomingDay,
  HomeUserDashboardData,
} from "@/lib/home/types";

type HomeDashboardProps = {
  data: HomeDashboardData;
};

export function HomeDashboard({ data }: HomeDashboardProps) {
  if (data.variant === "admin") {
    return <AdminHomeDashboard data={data} />;
  }

  return <UserHomeDashboard data={data} />;
}

function UserHomeDashboard({ data }: { data: HomeUserDashboardData }) {
  return (
    <div className="container space-y-6">
      <header className="rounded-2xl border bg-[#EBF3F7] p-8 shadow-sm md:p-14">
        <span className="text-3xl font-bold">
          สวัสดีคุณ {data.displayName}
        </span>
        <p className="mt-2 text-muted-foreground">
          {data.wardLabel
            ? `ตรวจสอบเวรของคุณใน ${data.wardLabel} หรือแจ้งวันที่ไม่สะดวกก่อนรอบจัดเวรถัดไป`
            : "บัญชีนี้ยังไม่มีวอร์ดที่ผูกไว้ ระบบจึงยังไม่สามารถแสดงเวรส่วนตัวได้"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="rounded-full px-4 font-normal">
            <Link href="/home/my-schedule">
              <HugeiconsIcon icon={Calendar03Icon} />
              ตารางเวรของฉัน
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full px-4 font-normal"
          >
            <Link href="/home/leave-requests">แจ้งวันลา</Link>
          </Button>
          {data.role === "ward_head" ? (
            <Button
              asChild
              variant="outline"
              className="rounded-full px-4 font-normal"
            >
              <Link href="/home/schedule-management">จัดตารางเวร</Link>
            </Button>
          ) : null}
        </div>
      </header>

      {data.emptyMessage ? <NoticeCard message={data.emptyMessage} /> : null}

      <main className="space-y-6">
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {data.summaryCards.slice(0, 3).map((stat) => (
            <SummaryCard key={stat.label} stat={stat} />
          ))}

          <div className="rounded-3xl border border-[#AFEFC2] bg-[#D2F9DC] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <p className="flex items-center gap-2 text-sm text-[#6B7B80]">
              <HugeiconsIcon
                icon={CalendarCheckIcon}
                size={18}
                strokeWidth={1.8}
              />
              {data.nextCycle.label}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-4xl font-bold leading-none text-black">
                {data.nextCycle.date}
              </p>
              <p className="text-sm font-medium text-[#6B7B80]">
                {data.nextCycle.time}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <TodayShiftCard data={data} />
          <UpcomingDaysCard
            monthLabel={data.monthLabel}
            upcomingDays={data.upcomingDays}
          />
        </section>
      </main>
    </div>
  );
}

function AdminHomeDashboard({ data }: { data: HomeAdminDashboardData }) {
  return (
    <div className="container space-y-6">
      <header className="rounded-2xl border bg-[#EBF3F7] p-8 shadow-sm md:p-14">
        <span className="text-3xl font-bold">
          สวัสดีคุณ {data.displayName}
        </span>
        <p className="mt-2 text-muted-foreground">
          ภาพรวมระบบสำหรับผู้ดูแลระบบ ใช้ตรวจสถานะผู้ใช้ วอร์ด รอบจัดตาราง และงาน GA
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="rounded-full px-4 font-normal">
            <Link href="/home/schedule-rounds">
              <HugeiconsIcon icon={CalendarCheckIcon} />
              รอบจัดตารางเวร
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full px-4 font-normal"
          >
            <Link href="/admin/import-users">นำเข้าบุคลากร</Link>
          </Button>
        </div>
      </header>

      {data.emptyMessage ? <NoticeCard message={data.emptyMessage} /> : null}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {data.summaryCards.map((stat) => (
          <SummaryCard key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="rounded-3xl border bg-white p-7 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">สถานะรอบจัดตารางล่าสุด</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ข้อมูลภาพรวมสำหรับติดตามการส่งข้อมูลของทุกวอร์ด
            </p>
          </div>
          <Button asChild className="rounded-md">
            <Link href="/home/schedule-rounds">ดูรายละเอียด</Link>
          </Button>
        </div>

        {data.latestCycle ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <InfoBlock label="รอบเดือน" value={data.latestCycle.monthLabel} />
            <InfoBlock label="สถานะ" value={data.latestCycle.statusLabel} />
            <InfoBlock
              label="วอร์ดที่ส่งข้อมูล"
              value={`${data.latestCycle.submittedWards}/${data.latestCycle.totalWards}`}
            />
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed bg-[#F8FDFE] p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีรอบจัดตารางในระบบ
          </div>
        )}
      </section>
    </div>
  );
}

function TodayShiftCard({ data }: { data: HomeUserDashboardData }) {
  const { todayShift } = data;
  const shifts = todayShift.hasSchedule ? todayShift.shifts : ["off"];
  const isCombo = todayShift.hasSchedule && shifts.length > 1;
  const shiftNames = splitToMatch(todayShift.shiftName, shifts.length);
  const shiftTimes = splitToMatch(todayShift.time, shifts.length);

  return (
    <div className="rounded-3xl bg-brand p-7 text-white shadow-[0_16px_35px_rgba(0,133,133,0.24)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-medium text-white/90">{todayShift.label}</p>
        {isCombo ? (
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90">
            เวรควบ
          </span>
        ) : null}
      </div>

      {isCombo ? (
        <div className="mt-5">
          <div className="flex items-start">
            {shifts.map((shift, index) => (
              <Fragment key={`${shift}-${index}`}>
                {index > 0 ? <ShiftConnector /> : null}
                <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-[#FFF2C2] text-[#B46A00]">
                    <HugeiconsIcon icon={getShiftIcon(shift)} size={26} strokeWidth={1.7} />
                  </div>
                  <p className="mt-2 text-lg font-bold leading-none">{shiftNames[index]}</p>
                  <p className="mt-1 whitespace-nowrap text-xs font-medium text-white/80">
                    {shiftTimes[index]}
                  </p>
                </div>
              </Fragment>
            ))}
          </div>
          <p className="mt-4 text-center text-sm font-semibold text-white/85">
            {todayShift.ward}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-5">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-[#FFF2C2] text-[#B46A00]">
            <HugeiconsIcon icon={getShiftIcon(shifts[0])} size={34} strokeWidth={1.7} />
          </div>
          <div>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
              <p className="text-3xl font-bold leading-none">{todayShift.shiftName}</p>
              {todayShift.hasSchedule ? (
                <p className="pb-0.5 text-base font-semibold text-white/85">{todayShift.ward}</p>
              ) : null}
            </div>
            {todayShift.time ? (
              <p className="mt-1 text-sm font-medium text-white/85">{todayShift.time}</p>
            ) : null}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3">
        {todayShift.summary.map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-white/85 px-3 py-2 text-center text-brand"
          >
            <p className="text-xs font-medium text-[#6B7B80]">{item.label}</p>
            <p className="text-2xl font-bold leading-tight">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShiftConnector() {
  return (
    <div className="flex h-14 w-6 shrink-0 items-center justify-center sm:w-8">
      <div className="relative h-px w-full bg-white/30">
        <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      </div>
    </div>
  );
}

function splitToMatch(text: string, count: number): string[] {
  const parts = text.split("/").map((part) => part.trim()).filter(Boolean);
  return parts.length === count ? parts : Array.from({ length: count }, () => text);
}

function UpcomingDaysCard({
  monthLabel,
  upcomingDays,
}: {
  monthLabel: string;
  upcomingDays: HomeUpcomingDay[];
}) {
  return (
    <div className="rounded-3xl border bg-white p-7 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-none">7 วันถัดไป</h2>
          <p className="mt-1 text-sm text-muted-foreground">{monthLabel}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {shiftLegends.map((legend) => (
            <div
              key={legend.label}
              className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium ${legend.className}`}
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-white/70">
                <HugeiconsIcon
                  icon={legend.icon}
                  size={13}
                  strokeWidth={1.8}
                />
              </span>
              {legend.label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {upcomingDays.map((day) => (
          <div
            key={day.id}
            className={`flex min-h-24 flex-col items-center justify-center rounded-xl border px-3 py-4 ${
              day.isToday
                ? "border-brand bg-brand/10"
                : "border-[#B8D4DE] bg-[#F6FDFF]"
            }`}
          >
            <p className="text-sm font-medium text-[#6B7B80]">{day.day}</p>
            <p className="mt-2 text-2xl font-bold leading-none text-black">
              {day.date}
            </p>
            <div className="mt-2 flex min-h-6 items-center justify-center gap-1" title={day.shiftLabel}>
              {(day.shifts.length > 0 ? day.shifts : ["off"]).map((shift) => (
                <span
                  key={shift}
                  className={`flex size-6 items-center justify-center rounded-full ${getShiftTone(shift)}`}
                >
                  <HugeiconsIcon icon={getShiftIcon(shift)} size={15} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ stat }: { stat: HomeSummaryCard }) {
  const icon = getSummaryIcon(stat.label);

  return (
    <div
      className={`rounded-3xl border p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] ${
        stat.tone === "green"
          ? "border-[#AFEFC2] bg-[#D2F9DC]"
          : "bg-white"
      }`}
    >
      <p className="flex items-center gap-2 text-sm text-[#6B7B80]">
        <HugeiconsIcon icon={icon} size={18} strokeWidth={1.8} />
        {stat.label}
      </p>
      <div className="mt-4 flex items-end gap-2">
        <p className="text-4xl font-bold leading-none text-black">
          {stat.value}
        </p>
        <p className="pb-1 text-sm font-medium text-[#6B7B80]">{stat.unit}</p>
      </div>
    </div>
  );
}

function NoticeCard({ message }: { message: string }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
      {message}
    </section>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-[#F8FDFE] p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

const shiftLegends = [
  {
    label: "เช้า",
    icon: Sun01Icon,
    className: "border-[#F8D99B] bg-[#FFF7E6] text-[#B46A00]",
  },
  {
    label: "บ่าย",
    icon: CircleIcon,
    className: "border-[#BDEAFF] bg-[#EBFAFF] text-[#0085B8]",
  },
  {
    label: "ดึก",
    icon: Moon02Icon,
    className: "border-[#D5D0FF] bg-[#F0EFFF] text-[#6B63C7]",
  },
  {
    label: "หยุด",
    icon: Coffee01Icon,
    className: "border-[#E7DED2] bg-[#FBF7F1] text-[#8E7A65]",
  },
] as const;

function getSummaryIcon(label: string) {
  if (label.includes("ผู้ใช้")) {
    return UserMultiple02Icon;
  }

  if (label.includes("วอร์ด")) {
    return Hospital02Icon;
  }

  if (label.includes("off") || label.includes("คำขอ")) {
    return CalendarXIcon;
  }

  return Clock01Icon;
}

function getShiftIcon(shift: string) {
  if (shift === "morning") {
    return Sun01Icon;
  }

  if (shift === "afternoon") {
    return CircleIcon;
  }

  if (shift === "night") {
    return Moon02Icon;
  }

  return Coffee01Icon;
}

function getShiftTone(shift: string) {
  if (shift === "morning") {
    return "bg-[#FFF2C2] text-[#B46A00]";
  }

  if (shift === "afternoon") {
    return "bg-[#D7EFFB] text-[#0085B8]";
  }

  if (shift === "night") {
    return "bg-[#DEDBFF] text-[#6B63C7]";
  }

  return "bg-[#FBF7F1] text-[#8E7A65]";
}
