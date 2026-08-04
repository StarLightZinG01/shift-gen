import type { AdminTab, LatestScheduleRound, OverviewStat } from "./types";

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

export const overviewStats: OverviewStat[] = [
  {
    id: "total-users",
    label: "ผู้ใช้ทั้งหมด",
    value: "20",
    tone: "teal",
  },
  {
    id: "ward-heads",
    label: "หัวหน้าวอร์ด",
    value: "6",
    tone: "blue",
  },
  {
    id: "clinical-staff",
    label: "พยาบาล/แพทย์",
    value: "12",
    tone: "green",
  },
  {
    id: "total-wards",
    label: "วอร์ดทั้งหมด",
    value: "8",
    tone: "purple",
  },
  {
    id: "submitted-wards",
    label: "วอร์ดส่งข้อมูลแล้ว",
    value: "5/8",
    tone: "green",
  },
  {
    id: "pending-wards",
    label: "วอร์ดยังไม่ส่งข้อมูล",
    value: "3",
    tone: "yellow",
  },
  {
    id: "running-ga",
    label: "งาน GA กำลังรัน",
    value: "1",
    tone: "teal",
  },
  {
    id: "published-schedules",
    label: "ตารางเผยแพร่แล้ว",
    value: "2",
    tone: "gray",
  },
];

export const latestScheduleRound: LatestScheduleRound = {
  title: "สถานะรอบจัดตารางล่าสุด",
  monthLabel: "สิงหาคม 2569",
  statusLabel: "กำลังสร้างตาราง",
  submittedWards: 5,
  totalWards: 8,
};
