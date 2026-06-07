import type { Report } from "./report";

export type ScenarioHistoricalReportStatus = "ready" | "failed" | "generating";

export type ScenarioHistoricalReport = {
  sessionId: string;
  sessionStartedAt: string;
  sessionEndedAt?: string;
  evaluatedAt: string;
  status: ScenarioHistoricalReportStatus;
  report?: Report;
};
