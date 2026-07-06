import type { LeaveRequestType } from "./types";

export const leaveRequestTypes: Array<{
  value: LeaveRequestType;
  label: string;
  description: string;
}> = [
  { value: "Off", label: "Off", description: "ขอวันหยุด" },
  { value: "V", label: "V", description: "ขอพักร้อน" },
  { value: "ว", label: "ว", description: "ขอเวร" },
  { value: "ล", label: "ล", description: "ขอลา" },
];

export const leaveRequestMonthLabel = "สิงหาคม 2569";
export const leaveRequestWeekDays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const leaveRequestDaysInMonth = 31;
export const leaveRequestFirstDayOffset = 6;
export const leaveRequestTrailingEmptyCells =
  (7 - ((leaveRequestFirstDayOffset + leaveRequestDaysInMonth) % 7)) % 7;
