"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminTabs } from "@/components/features/schedule-rounds/AdminTabs";
import { CompensationPanel } from "@/components/features/compensation/CompensationPanel";
import { LatestScheduleRoundCard } from "@/components/features/schedule-rounds/LatestScheduleRoundCard";
import { GaSettingsPanel } from "@/components/features/schedule-rounds/GaSettingsPanel";
import { ManualScheduleWardList } from "@/components/features/manual-schedule/ManualScheduleWardList";
import { OverviewStatsGrid } from "@/components/features/schedule-rounds/OverviewStatsGrid";
import { ScheduleDataPanel } from "@/components/features/schedule-rounds/ScheduleDataPanel";
import { ScheduleRoundsPanel } from "@/components/features/schedule-rounds/ScheduleRoundsPanel";
import { UserManagementPanel } from "@/components/features/schedule-rounds/UserManagementPanel";
import { adminTabs } from "@/lib/schedule-rounds/mock-data";
import type {
  AdminTabId,
  CompensationSummaryData,
  GaSettingsData,
  LatestScheduleRound,
  ManualScheduleData,
  OverviewStat,
  ScheduleDataOverview,
  ScheduleRoundsData,
  UserManagementData,
} from "@/lib/schedule-rounds/types";

type ScheduleRoundsViewProps = {
  overviewStats: OverviewStat[];
  latestScheduleRound: LatestScheduleRound;
  userManagement: UserManagementData;
  scheduleRounds: ScheduleRoundsData;
  scheduleData: ScheduleDataOverview;
  gaSettings: GaSettingsData;
  gaSettingsProfiles: GaSettingsData[];
  compensation: CompensationSummaryData;
  manualSchedule: ManualScheduleData;
  initialActiveTab?: AdminTabId;
};

const ADMIN_TAB_STORAGE_KEY = "shiftgen.admin.activeTab";

function isAdminTabId(value: string | null): value is AdminTabId {
  return adminTabs.some((tab) => tab.id === value);
}

export function ScheduleRoundsView({
  overviewStats,
  latestScheduleRound,
  userManagement,
  scheduleRounds,
  scheduleData,
  gaSettings,
  gaSettingsProfiles,
  compensation,
  manualSchedule,
  initialActiveTab,
}: ScheduleRoundsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTabId>(() => {
    if (initialActiveTab) {
      return initialActiveTab;
    }

    if (typeof window === "undefined") {
      return "system-overview";
    }

    const savedTab = window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
    return isAdminTabId(savedTab) ? savedTab : "system-overview";
  });
  const activeTabLabel =
    adminTabs.find((tab) => tab.id === activeTab)?.label ?? "ภาพรวมระบบ";

  useEffect(() => {
    if (initialActiveTab) {
      window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, initialActiveTab);
    }
  }, [initialActiveTab]);

  const handleTabChange = (tabId: AdminTabId) => {
    setActiveTab(tabId);
    window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, tabId);

    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabId);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  };

  return (
    <main className="container space-y-6 pb-8">
      <AdminTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabs={adminTabs}
      />

      {activeTab === "system-overview" ? (
        <div className="space-y-6">
          <OverviewStatsGrid stats={overviewStats} />
          <LatestScheduleRoundCard
            round={latestScheduleRound}
            onViewDetails={() => handleTabChange("schedule-data")}
          />
        </div>
      ) : activeTab === "user-management" ? (
        <UserManagementPanel data={userManagement} />
      ) : activeTab === "schedule-data" ? (
        <ScheduleDataPanel data={scheduleData} />
      ) : activeTab === "schedule-rounds" ? (
        <ScheduleRoundsPanel data={scheduleRounds} />
      ) : activeTab === "compensation" ? (
        <CompensationPanel data={compensation} />
      ) : activeTab === "manual-schedule" ? (
        <ManualScheduleWardList data={manualSchedule} />
      ) : activeTab === "ga-settings" ? (
        <GaSettingsPanel data={gaSettings} profiles={gaSettingsProfiles} />
      ) : (
        <PlaceholderContent title={activeTabLabel} />
      )}
    </main>
  );
}

function PlaceholderContent({ title }: { title: string }) {
  return (
    <section className="rounded-2xl border border-dashed bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        เตรียมพื้นที่ไว้สำหรับต่อยอดข้อมูลจริงและเครื่องมือจัดการในขั้นถัดไป
      </p>
    </section>
  );
}
