export type HomeRole = "admin" | "ward_head" | "nurse";

export type HomeSummaryCard = {
  label: string;
  value: string;
  unit: string;
  tone: "white" | "green";
};

export type HomeTodayShift = {
  hasSchedule: boolean;
  label: string;
  shiftName: string;
  ward: string;
  time: string;
  summary: Array<{
    label: string;
    value: string;
  }>;
};

export type HomeUpcomingDay = {
  id: string;
  day: string;
  date: string;
  shift: string;
  shiftLabel: string;
  isToday: boolean;
};

export type HomeUserDashboardData = {
  variant: "user";
  displayName: string;
  role: HomeRole;
  wardLabel: string | null;
  monthLabel: string;
  summaryCards: HomeSummaryCard[];
  nextCycle: {
    label: string;
    date: string;
    time: string;
  };
  todayShift: HomeTodayShift;
  upcomingDays: HomeUpcomingDay[];
  emptyMessage: string | null;
};

export type HomeAdminDashboardData = {
  variant: "admin";
  displayName: string;
  summaryCards: HomeSummaryCard[];
  latestCycle: {
    monthLabel: string;
    statusLabel: string;
    submittedWards: number;
    totalWards: number;
  } | null;
  emptyMessage: string | null;
};

export type HomeDashboardData = HomeUserDashboardData | HomeAdminDashboardData;
