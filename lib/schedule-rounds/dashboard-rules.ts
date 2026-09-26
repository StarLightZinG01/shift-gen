export const userVisibleWardVersionStatuses = ["published"] as const;
export const submittedPreparationStatuses = ["submitted", "ready"] as const;

export function canManageWardScheduleVersions(roles: string[]) {
  return roles.includes("admin") || roles.includes("ward_head");
}

export function selectLatestPublishedWardVersion<
  T extends {
    status: string;
    createdAt: Date;
    scheduleVersion: { cycle: { year: number; month: number } };
  },
>(versions: T[]) {
  return (
    versions
      .filter((version) => version.status === "published")
      .sort((a, b) => {
        const cycleOrder =
          b.scheduleVersion.cycle.year - a.scheduleVersion.cycle.year ||
          b.scheduleVersion.cycle.month - a.scheduleVersion.cycle.month;
        return cycleOrder || b.createdAt.getTime() - a.createdAt.getTime();
      })[0] ?? null
  );
}

export function isSubmittedPreparationStatus(status: string) {
  return submittedPreparationStatuses.some((item) => item === status);
}
