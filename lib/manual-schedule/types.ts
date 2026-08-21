export type ManualScheduleVersionOption = {
  id: string;
  label: string;
  source: string;
  status: string;
};

export type ManualScheduleWardOption = {
  id: string;
  code: string;
  name: string;
  hardScore: string | null;
  softScore: string | null;
  isFeasible: boolean | null;
  objective: string | null;
  fitness: string | null;
  generatedAtLabel: string;
  latestEditedAtLabel: string;
};

export type ManualScheduleStaffOption = {
  id: string;
  staffCode: string;
  fullName: string;
  homeWardCode: string;
};

export type ManualScheduleCell = {
  assignmentId: string | null;
  staffId: string;
  staffCode: string;
  fullName: string;
  day: number;
  shiftCode: string;
  isOt: boolean;
  otShifts: string | null;
  isEdited: boolean;
  violations: ManualScheduleViolation[];
};

export type ManualScheduleRow = {
  staffId: string;
  staffCode: string;
  fullName: string;
  isHead: boolean;
  cells: ManualScheduleCell[];
};

export type ManualChangeHistoryRow = {
  id: string;
  actionType: string;
  staffLabel: string;
  dateLabel: string;
  oldShiftCode: string | null;
  newShiftCode: string | null;
  reason: string | null;
  changedBy: string;
  changedAtLabel: string;
};

export type CoverageWarning = {
  day: number;
  shiftCode: string;
  message: string;
};

export type ManualScheduleViolation = {
  id: string;
  day: number | null;
  staffId: string | null;
  staffLabel: string | null;
  wardId: string | null;
  wardLabel: string | null;
  constraintCode: string;
  constraintLabel: string;
  severity: string;
  message: string;
};

export type ManualScheduleData = {
  version: {
    id: string;
    cycleId: string;
    cycleLabel: string;
    month: number;
    year: number;
    versionNo: number;
    source: string;
    status: string;
    parentVersionId: string | null;
    gaScore: {
      scoringMethod: string | null;
      hardScore: string | null;
      softScore: string | null;
      isFeasible: boolean | null;
      objective: string | null;
      fitness: string | null;
      sourceLabel: string;
    } | null;
  } | null;
  selectedWardId: string | null;
  selectedWardLabel: string;
  versionOptions: ManualScheduleVersionOption[];
  wardOptions: ManualScheduleWardOption[];
  staffOptions: ManualScheduleStaffOption[];
  rows: ManualScheduleRow[];
  daysInMonth: number;
  holidayDays: number[];
  canEdit: boolean;
  canCreateManualVersion: boolean;
  canPublish: boolean;
  history: ManualChangeHistoryRow[];
  coverageWarnings: CoverageWarning[];
  violations: ManualScheduleViolation[];
};
