import type { ScenarioHistoricalReport } from "@/domain/scenario-report-history";
import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export async function fetchScenarioReportsFromServer(
  scenarioId: string,
  userId?: string,
): Promise<ScenarioHistoricalReport[]> {
  let resolvedUserId: string;
  try {
    resolvedUserId = resolveClientRequestUserId(userId);
  } catch {
    return [];
  }

  let response: Response;
  try {
    response = await fetch(`/api/scenarios/${scenarioId}/reports`, {
      headers: {
        [REQUEST_USER_ID_HEADER]: resolvedUserId,
      },
    });
  } catch {
    return [];
  }

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `Failed to fetch scenario reports (${response.status}).`,
    );
  }

  const body = (await response.json()) as { reports: ScenarioHistoricalReport[] };
  return body.reports;
}

export function formatReportEvaluatedAt(evaluatedAt: string): string {
  return new Date(evaluatedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatTaskCompletionSummary(report: Report): string {
  const completed = report.taskCompletion.completedGoalIds.length;
  const missing = report.taskCompletion.missingGoalIds.length;
  const total = completed + missing;

  if (typeof report.taskCompletion.score === "number") {
    return `${report.taskCompletion.score}% goals completed (${completed}/${total})`;
  }

  if (total === 0) {
    return "Task completion unavailable";
  }

  return `${completed}/${total} goals completed`;
}
