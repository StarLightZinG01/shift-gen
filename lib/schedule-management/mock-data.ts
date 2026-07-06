import type { CycleContext } from "./types";

export const mockCycle: CycleContext = {
  id: null,
  month: 8,
  year: 2569,
  status: "preparing",
  requestOpenDate: new Date("2026-08-01T00:00:00"),
  requestCloseDate: new Date("2026-08-20T00:00:00"),
  dataLockDate: new Date("2026-08-25T00:00:00"),
  autoGenerateAt: new Date("2026-08-26T00:00:00"),
};
