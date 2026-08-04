import type { LeaveRequestType, PreferredShiftCode } from "./types";

export const leaveRequestTypes: Array<{
  value: LeaveRequestType;
  label: string;
  description: string;
}> = [
  { value: "Off", label: "Off", description: "ขอวันหยุด" },
  { value: "V", label: "V", description: "ขอพักร้อน" },
  { value: "ว", label: "ว", description: "ประชุมวิชาการ" },
  { value: "ล", label: "ล", description: "ขอลา" },
  { value: "PreferredShift", label: "อยากเข้าเวร", description: "ระบุกะที่อยากเข้า" },
];

export const preferredShiftOptions: Array<{
  value: PreferredShiftCode;
  label: string;
}> = [
  { value: "ช", label: "เช้า (ช)" },
  { value: "บ", label: "บ่าย (บ)" },
  { value: "ด", label: "ดึก (ด)" },
  { value: "ช/บ", label: "เช้า/บ่าย (ช/บ)" },
  { value: "ด/บ", label: "ดึก/บ่าย (ด/บ)" },
];

export const leaveRequestMonthLabel = "สิงหาคม 2569";
export const leaveRequestWeekDays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const leaveRequestDaysInMonth = 31;
export const leaveRequestFirstDayOffset = 6;
export const leaveRequestTrailingEmptyCells =
  (7 - ((leaveRequestFirstDayOffset + leaveRequestDaysInMonth) % 7)) % 7;
