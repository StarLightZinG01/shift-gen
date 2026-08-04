export type GaRunStatus =
  | "queued"
  | "running"
  | "processing"
  | "completed"
  | "failed";

export type GaRunSummary = {
  id: string;
  status: GaRunStatus;
  statusLabel: string;
  createdAtLabel: string;
  startedAtLabel: string;
  finishedAtLabel: string;
  generationCount: number | null;
  objective: string | null;
  fitness: string | null;
};

export type GaRunReadiness = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};
