"use client";

import { useState } from "react";

import { AdminTabs } from "@/components/features/schedule-rounds/AdminTabs";
import { LatestScheduleRoundCard } from "@/components/features/schedule-rounds/LatestScheduleRoundCard";
import { OverviewStatsGrid } from "@/components/features/schedule-rounds/OverviewStatsGrid";
import { ScheduleDataPanel } from "@/components/features/schedule-rounds/ScheduleDataPanel";
import { ScheduleRoundsPanel } from "@/components/features/schedule-rounds/ScheduleRoundsPanel";
import { UserManagementPanel } from "@/components/features/schedule-rounds/UserManagementPanel";
import { adminTabs } from "@/lib/schedule-rounds/mock-data";
import type {
  AdminTabId,
  LatestScheduleRound,
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
};

export function ScheduleRoundsView({
  overviewStats,
  latestScheduleRound,
  userManagement,
  scheduleRounds,
  scheduleData,
}: ScheduleRoundsViewProps) {
  const [activeTab, setActiveTab] = useState<AdminTabId>("system-overview");
  const activeTabLabel =
    adminTabs.find((tab) => tab.id === activeTab)?.label ?? "ภาพรวมระบบ";

  return (
    <main className="container space-y-6 pb-8">
      <AdminTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={adminTabs}
      />

      {activeTab === "system-overview" ? (
        <div className="space-y-6">
          <OverviewStatsGrid stats={overviewStats} />
          <LatestScheduleRoundCard
            round={latestScheduleRound}
            onViewDetails={() => setActiveTab("schedule-data")}
          />
        </div>
      ) : activeTab === "user-management" ? (
        <UserManagementPanel data={userManagement} />
      ) : activeTab === "schedule-data" ? (
        <ScheduleDataPanel data={scheduleData} />
      ) : activeTab === "schedule-rounds" ? (
        <ScheduleRoundsPanel data={scheduleRounds} />
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
