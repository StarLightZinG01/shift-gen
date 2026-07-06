import type { AdminTab, AdminTabId } from "@/lib/schedule-rounds/types";

type AdminTabsProps = {
  activeTab: AdminTabId;
  tabs: AdminTab[];
  onTabChange: (tabId: AdminTabId) => void;
};

export function AdminTabs({ activeTab, tabs, onTabChange }: AdminTabsProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-[#EEF7F8] p-1 shadow-sm">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`h-10 rounded-xl px-4 text-sm font-medium transition ${
                isActive
                  ? "bg-white text-brand shadow-sm"
                  : "text-[#65737A] hover:bg-white/70 hover:text-brand"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
