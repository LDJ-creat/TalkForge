import type { Report } from "./report";

export type ScenarioHistoricalReport = {
  sessionId: string;
  sessionStartedAt: string;
  sessionEndedAt?: string;
  evaluatedAt: string;
  report: Report;
};
