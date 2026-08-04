export type CompensationCategory = "ot" | "shift_pay";

export type CompensationRate = {
  otRate: number;
  shiftPayRate: number;
};

export type ParsedShiftCode = {
  morning: number;
  afternoon: number;
  night: number;
  academic: number;
  workUnits: number;
};

export type StaffCompensationSummary = {
  staffId: string;
  staffCode: string;
  fullName: string;
  payPosition: string;
  regularWorkTarget: number;
  morningCount: number;
  afternoonCount: number;
  nightCount: number;
  academicCount: number;
  totalWorkUnits: number;
  otCount: number;
  otRate: number;
  shiftPayRate: number;
  otAmount: number;
  shiftPayAmount: number;
  totalAmount: number;
};

export type CompensationItemSummary = {
  category: CompensationCategory;
  staffType: string;
  rate: number;
  quantity: number;
  amount: number;
};

export type WardCompensationResult = {
  wardId: string;
  wardCode: string;
  wardName: string;
  totalOtAmount: number;
  totalRegularShiftAmount: number;
  totalAmount: number;
  staffSummaries: StaffCompensationSummary[];
  items: CompensationItemSummary[];
};

export type ScheduleVersionOption = {
  id: string;
  label: string;
  status: string;
};

export type CompensationSummaryData = {
  scheduleVersionId: string | null;
  scheduleVersionLabel: string;
  versionOptions: ScheduleVersionOption[];
  totalOtAmount: number;
  totalRegularShiftAmount: number;
  totalAmount: number;
  wards: WardCompensationResult[];
  hasStoredSummary: boolean;
};
