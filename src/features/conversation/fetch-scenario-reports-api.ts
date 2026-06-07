import type { Report } from "@/domain/report";
import type {
  ScenarioHistoricalReport,
  ScenarioHistoricalReportStatus,
} from "@/domain/scenario-report-history";
import { errorCopy, scenarioEntryCopy, taskCompletionCopy } from "@/lib/ui-copy";
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
      body?.error?.message ?? errorCopy.fetchReportsFailed(response.status),
    );
  }

  const body = (await response.json()) as { reports: ScenarioHistoricalReport[] };
  return body.reports;
}

export function formatReportEvaluatedAt(evaluatedAt: string): string {
  return new Date(evaluatedAt).toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatHistoricalReportHeadline(item: ScenarioHistoricalReport): string {
  if (item.status === "ready" && item.report) {
    return item.report.summary;
  }

  if (item.status === "generating") {
    return scenarioEntryCopy.historicalReportGenerating;
  }

  return scenarioEntryCopy.historicalReportFailed;
}

export function formatHistoricalReportMeta(
  status: ScenarioHistoricalReportStatus,
  report?: Report,
): string {
  if (status !== "ready" || !report) {
    return taskCompletionCopy.unavailable;
  }

  return formatTaskCompletionSummary(report);
}

export function formatTaskCompletionSummary(report: Report): string {
  const completed = report.taskCompletion.completedGoalIds.length;
  const missing = report.taskCompletion.missingGoalIds.length;
  const total = completed + missing;

  if (typeof report.taskCompletion.score === "number") {
    return taskCompletionCopy.scoreCompleted(report.taskCompletion.score, completed, total);
  }

  if (total === 0) {
    return taskCompletionCopy.unavailable;
  }

  return taskCompletionCopy.countCompleted(completed, total);
}
