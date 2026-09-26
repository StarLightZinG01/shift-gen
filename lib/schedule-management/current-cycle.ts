export const CURRENT_CYCLE_STATUSES = [
  "preparing",
  "draft",
  "open",
  "locked",
  "generating",
] as const;

export function isCurrentCycleStatus(status: string) {
  return CURRENT_CYCLE_STATUSES.some((currentStatus) => currentStatus === status);
}
