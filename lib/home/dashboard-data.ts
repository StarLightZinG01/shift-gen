import {
  CalendarCheckIcon,
  CalendarXIcon,
  CircleIcon,
  Clock01Icon,
  Coffee01Icon,
  Moon02Icon,
  Sun01Icon,
} from "@hugeicons/core-free-icons";

export const dashboardStats = [
  {
    label: "จำนวนเวรของฉันในเดือนนี้",
    value: "20",
    unit: "เวร",
    icon: Clock01Icon,
  },
  {
    label: "จำนวน off ของเดือนนี้",
    value: "10",
    unit: "เวร",
    icon: CalendarXIcon,
  },
  {
    label: "จำนวน OT เดือนนี้",
    value: "10",
    unit: "เวร",
    icon: Clock01Icon,
  },
] as const;

export const nextCycle = {
  label: "รอบจัดเวรถัดไป",
  date: "20 ก.ค.",
  icon: CalendarCheckIcon,
};

export const todayShift = {
  label: "เวรของฉันวันนี้",
  shiftName: "เช้า",
  ward: "PED3",
  time: "08.00 - 16.00 น.",
  summary: [
    { label: "ดึก", value: "2" },
    { label: "เช้า", value: "6" },
    { label: "บ่าย", value: "2" },
  ],
};

export const shiftLegends = [
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

export const upcomingDays = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1,
  day: "อ",
  date: "20",
  shift: "เช้า",
}));
