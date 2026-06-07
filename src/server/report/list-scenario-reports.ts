import type { ScenarioHistoricalReport } from "@/domain/scenario-report-history";
import type { Scenario } from "@/domain/scenario";

import { ReportServiceError } from "./errors";

export type ListScenarioReportsDeps = {
  getScenarioById: (scenarioId: string) => Promise<Scenario | null>;
  listCompletedReportsByScenarioForUser: (
    userId: string,
    scenarioId: string,
  ) => Promise<ScenarioHistoricalReport[]>;
};

export async function listScenarioReportsForUser(
  scenarioId: string,
  userId: string,
  deps: ListScenarioReportsDeps,
): Promise<{ reports: ScenarioHistoricalReport[] }> {
  const scenario = await deps.getScenarioById(scenarioId);
  if (!scenario) {
    throw new ReportServiceError(404, "scenario_not_found", "Scenario was not found.");
  }

  const reports = await deps.listCompletedReportsByScenarioForUser(userId, scenarioId);
  return { reports };
}
