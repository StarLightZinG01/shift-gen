export type AdminTabId =
  | "system-overview"
  | "user-management"
  | "schedule-data"
  | "schedule-rounds";

export type AdminTab = {
  id: AdminTabId;
  label: string;
};

export type OverviewStatTone =
  | "teal"
  | "blue"
  | "green"
  | "purple"
  | "yellow"
  | "gray";

export type OverviewStat = {
  id:
    | "total-users"
    | "ward-heads"
    | "clinical-staff"
    | "total-wards"
    | "submitted-wards"
    | "pending-wards"
    | "running-ga"
    | "published-schedules";
  label: string;
  value: string;
  tone: OverviewStatTone;
};

export type LatestScheduleRound = {
  title: string;
  monthLabel: string;
  statusLabel: string;
  submittedWards: number;
  totalWards: number;
};

export type ScheduleRoundStatus =
  | "preparing"
  | "open"
  | "locked"
  | "generating"
  | "published";

export type ScheduleRoundRow = {
  id: string;
  year: number;
  month: number;
  monthLabel: string;
  status: ScheduleRoundStatus;
  statusLabel: string;
  submittedWards: number;
  totalWards: number;
  requestOpenDateLabel: string;
  requestCloseDateLabel: string;
  dataLockDateLabel: string;
  autoGenerateAtLabel: string;
  createdAtLabel: string;
};

export type ScheduleRoundsData = {
  rounds: ScheduleRoundRow[];
  totalWards: number;
};

export type WardPreparationStatus =
  | "draft"
  | "needs_fix"
  | "submitted"
  | "ready";

export type ScheduleDataSummary = {
  totalWards: number;
  completedWards: number;
  incompleteWards: number;
  draftWards: number;
};

export type WardScheduleDataRow = {
  wardId: string;
  wardCode: string;
  wardName: string;
  headNames: string[];
  status: WardPreparationStatus;
  statusLabel: string;
};

export type ScheduleDataOverview = {
  cycle: {
    id: string;
    month: number;
    year: number;
    monthLabel: string;
    status: string;
    statusLabel: string;
  } | null;
  summary: ScheduleDataSummary;
  rows: WardScheduleDataRow[];
};

export type AdminUserSummary = {
  displayName: string;
  employeeCode: string | null;
};

export type UserManagementRole = "nurse" | "ward_head" | "admin";

export type UserManagementWard = {
  id: string;
  code: string;
  name: string;
};

export type UserManagementRow = {
  id: string;
  username: string;
  displayName: string;
  employeeCode: string | null;
  status: string;
  role: UserManagementRole;
  staffId: string | null;
  staffCode: string;
  homeWardId: string | null;
  homeWardCode: string;
  allowedWardIds: string[];
  allowedWardCodes: string[];
  position: string;
  payPosition: string;
  otRate: string;
  shiftPayRate: string;
  isHead: boolean;
  isTrainee: boolean;
};

export type UserManagementData = {
  users: UserManagementRow[];
  wards: UserManagementWard[];
};
