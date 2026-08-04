export type MyScheduleVersionOption = {
  id: string;
  label: string;
  status: string;
};

export type MyScheduleWard = {
  id: string;
  code: string;
  name: string;
};

export type MyScheduleStaff = {
  id: string;
  staffCode: string;
  fullName: string;
  isHead: boolean;
  isCurrentUser: boolean;
  payPosition: string;
  otRate: number;
  shiftPayRate: number;
};

export type MyScheduleAssignment = {
  id: string;
  staffId: string;
  staffCode: string;
  fullName: string;
  isHead: boolean;
  payPosition: string;
  otRate: number;
  shiftPayRate: number;
  wardId: string;
  wardCode: string;
  wardName: string;
  day: number;
  shiftCode: string;
  isOt: boolean;
  otShifts: string | null;
  payAmount: number;
};

export type MyScheduleStaffRow = MyScheduleStaff & {
  shiftsByDay: Record<number, string>;
  otByDay: Record<number, boolean>;
  otShiftsByDay: Record<number, string | null>;
};

export type MyScheduleSummary = {
  myShiftCount: number;
  myOffCount: number;
  myVacationCount: number;
  myLeaveCount: number;
  myOtCount: number;
  estimatedPayAmount: number;
};

export type MyScheduleCompensationDetailRow = {
  id: string;
  label: string;
  position: string;
  rate: number;
  quantity: number;
  amount: number;
  category: "ot" | "shift_pay" | "extra";
};

export type MyScheduleCompensationTotalRow = {
  id: string;
  label: string;
  amount: number;
};

export type MyScheduleWardCompensationSummary = {
  detailRows: MyScheduleCompensationDetailRow[];
  totalRows: MyScheduleCompensationTotalRow[];
  totalOtAmount: number;
  totalShiftPayAmount: number;
  totalExtraAmount: number;
  totalAmount: number;
};

export type MyScheduleLoadedData = {
  status: "loaded";
  currentUserStaffId: string;
  ward: MyScheduleWard;
  cycle: {
    id: string;
    month: number;
    year: number;
    monthLabel: string;
  };
  selectedVersionId: string;
  versionOptions: MyScheduleVersionOption[];
  canManageSchedule: boolean;
  daysInMonth: number;
  holidayDays: number[];
  staffRows: MyScheduleStaffRow[];
  crossWardAssignments: MyScheduleAssignment[];
  summary: MyScheduleSummary;
  compensationSummary: MyScheduleWardCompensationSummary;
};

export type MyScheduleEmptyData = {
  status: "empty";
  reason:
    | "no-session"
    | "admin-no-ward"
    | "no-staff"
    | "no-published-version"
    | "no-assignments";
  title: string;
  description: string;
};

export type MySchedulePageData = MyScheduleLoadedData | MyScheduleEmptyData;
