import type { WardContext } from "./types";

export function formatWardLabel(ward: WardContext) {
  return ward.code === ward.name ? ward.code : `${ward.code} - ${ward.name}`;
}

export function formatRequestDate(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatMonthYear(month: number, year: number) {
  const thaiMonths = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const displayYear = year < 2400 ? year + 543 : year;

  return `${thaiMonths[month - 1] ?? "ไม่ระบุเดือน"} ${displayYear}`;
}

export function formatDateRange(start: Date | null, end: Date | null) {
  if (!start || !end) {
    return "วันที่ 1-20 (mock)";
  }

  return `${formatThaiDay(start)}-${formatThaiDay(end)}`;
}

export function formatDateTime(date: Date | null) {
  if (!date) {
    return "วันที่ 26 เวลา 00.00 น. (mock)";
  }

  return `${formatThaiDay(date)} เวลา ${formatThaiTime(date)} น.`;
}

function formatThaiDay(date: Date) {
  return `วันที่ ${date.getDate()}`;
}

function formatThaiTime(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatCycleStatus(status: string) {
  const statusMap: Record<string, string> = {
    preparing: "เตรียมข้อมูล",
    draft: "ร่าง",
    open: "เปิดให้ตรวจสอบ",
    published: "เผยแพร่แล้ว",
    locked: "ล็อกข้อมูล",
  };

  return statusMap[status] ?? status;
}
