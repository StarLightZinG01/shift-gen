export type SelectableWard = {
  id: string;
  code: string;
  name: string;
};

export type LeaveRequestType = "Off" | "V" | "ว" | "ล" | "PreferredShift";
export type PreferredShiftCode = "ช" | "บ" | "ด" | "ช/บ" | "ด/บ";

export type LeaveRequestDraft = {
  date: number;
  type: LeaveRequestType;
  preferredShift?: PreferredShiftCode | "";
  reason: string;
};

export type LeaveRequestCycle = {
  id: string;
  month: number;
  year: number;
  monthLabel: string;
  daysInMonth: number;
  firstDayOffset: number;
  trailingEmptyCells: number;
  requestCloseLabel: string;
};

export type LeaveRequestPageData = {
  isAdmin: boolean;
  staffId: string | null;
  cycle: LeaveRequestCycle | null;
  allowedWards: SelectableWard[];
  existingRequests: LeaveRequestDraft[];
  message: string | null;
};
