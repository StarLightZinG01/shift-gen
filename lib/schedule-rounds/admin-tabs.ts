import type { AdminTab } from "./types";

export const adminTabs: AdminTab[] = [
  {
    id: "system-overview",
    label: "ภาพรวมระบบ",
  },
  {
    id: "user-management",
    label: "จัดการผู้ใช้",
  },
  {
    id: "schedule-data",
    label: "ข้อมูลการจัดตารางเวร",
  },
  {
    id: "schedule-rounds",
    label: "รอบการจัดตาราง",
  },
  {
    id: "compensation",
    label: "ค่าตอบแทน",
  },
  {
    id: "manual-schedule",
    label: "แก้ไขตารางเวร",
  },
  {
    id: "ga-settings",
    label: "ตั้งค่า GA",
  },
];
