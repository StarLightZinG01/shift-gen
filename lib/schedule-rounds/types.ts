import type { GaRunSummary } from "@/lib/ga-runs/types";
import type { CompensationSummaryData } from "@/lib/compensation/types";
import type { ManualScheduleData } from "@/lib/manual-schedule/types";

export type AdminTabId =
  | "system-overview"
  | "user-management"
  | "schedule-data"
  | "schedule-rounds"
  | "compensation"
  | "manual-schedule"
  | "ga-settings";

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
  requestOpenDate: string;
  requestCloseDate: string;
  dataLockDate: string;
  autoGenerateAt: string;
  holidayDates: string[];
  holidayDateLabels: string;
  submittedWards: number;
  totalWards: number;
  requestOpenDateLabel: string;
  requestCloseDateLabel: string;
  dataLockDateLabel: string;
  autoGenerateAtLabel: string;
  createdAtLabel: string;
  latestGaRun: GaRunSummary | null;
  latestGaBatch: {
    groupCount: number;
    completedGroupCount: number;
    failedGroupCount: number;
    groups: Array<{
      id: string;
      index: number;
      status: string;
      wardCodes: string[];
    }>;
  } | null;
  hasActiveGaRun: boolean;
  wardOptions: ScheduleRoundWardOption[];
};

export type ScheduleRoundWardOption = {
  id: string;
  code: string;
  name: string;
  status: WardPreparationStatus;
  statusLabel: string;
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

export type GaSettingsData = {
  profileKey: string;
  profileName: string;
  isActive: boolean;
  populationSize: number;
  generations: number;
  patience: number;
  eliteSize: number;
  tournamentSize: number;
  crossoverRate: number;
  mutationRate: number;
  fullRepairEvery: number;
  repairEliteEvery: number;
  randomSeed: number | null;
  maxSeconds: number;
  maxShiftsPer7Days: number;
  weeklyMinDaysOff: number;
  maxConsecutiveNights: number;
  maxConsecutiveWorkDays: number;
  maxTraineePerShift: number;
  minRestHours: number;
  targetOffDaysPerStaff: number | null;
  enableMorningEveningDouble: boolean;
  enableNightEveningDouble: boolean;
  preferMorningOt: boolean;
  morningRegularRequired: boolean;
  updatedAtLabel: string;
  source: "database" | "default";
};

export type { CompensationSummaryData };
export type { ManualScheduleData };
