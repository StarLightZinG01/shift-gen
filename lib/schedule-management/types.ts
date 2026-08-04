export type WardContext = {
  id: string;
  code: string;
  name: string;
  isHead: boolean;
};

export type CycleContext = {
  id: string | null;
  month: number;
  year: number;
  status: string;
  requestOpenDate: Date | null;
  requestCloseDate: Date | null;
  dataLockDate: Date | null;
  autoGenerateAt: Date | null;
  holidays: Array<{
    date: Date;
    label: string | null;
  }>;
};

export type StaffRow = {
  id: string;
  staffId: string | null;
  rowType: "home" | "new" | "external";
  code: string;
  fullName: string;
  homeWard: string;
  allowedWards: string[];
  payPosition: string;
  otRate: string;
  shiftPayRate: string;
  off: string;
  vacation: string;
  leave: string;
  academic: string;
  preferredShifts: string;
  isHead: boolean;
  isTrainee: boolean;
};

export type ExternalStaffCandidate = {
  id: string;
  code: string;
  fullName: string;
  homeWard: string;
  allowedWards: string[];
  payPosition: string;
  otRate: string;
  shiftPayRate: string;
  isHead: boolean;
  isTrainee: boolean;
};

export type RequestSummaryRow = {
  id: string;
  staffCode: string;
  displayName: string;
  requestType: string;
  preferredShift: string | null;
  requestDate: Date;
  reason: string;
};

export type ShiftStaffingRequirement = {
  min: number;
  max: number;
};

export type StaffingRequirements = {
  night?: ShiftStaffingRequirement;
  morning?: ShiftStaffingRequirement;
  afternoon?: ShiftStaffingRequirement;
};
