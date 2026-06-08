import type { Report } from "@/domain/report";
import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export type FetchSessionReportResult =
  | { status: "ready"; report: Report }
  | { status: "generating" }
  | { status: "missing" }
  | { status: "failed"; message: string };

export async function fetchSessionReportFromServer(
  sessionId: string,
  userId?: string,
): Promise<FetchSessionReportResult> {
  const resolvedUserId = resolveClientRequestUserId(userId);

  const response = await fetch(`/api/sessions/${sessionId}/report`, {
    headers: {
      [REQUEST_USER_ID_HEADER]: resolvedUserId,
    },
  });

  if (response.status === 404) {
    return { status: "missing" };
  }

  if (response.status === 202) {
    return { status: "generating" };
  }

  if (response.status === 503) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return {
      status: "failed",
      message: body?.error?.message ?? "Report generation failed.",
    };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `Failed to fetch report (${response.status}).`);
  }

  const body = (await response.json()) as { report: Report };
  return { status: "ready", report: body.report };
}

export async function pollSessionReportFromServer(
  sessionId: string,
  options: {
    userId?: string;
    attempts?: number;
    intervalMs?: number;
    /** Keep polling through stale 503 failures while a retry job is in flight. */
    isRetry?: boolean;
  } = {},
): Promise<Report | null> {
  const attempts = options.attempts ?? 20;
  const intervalMs = options.intervalMs ?? 750;

  for (let index = 0; index < attempts; index += 1) {
    const result = await fetchSessionReportFromServer(sessionId, options.userId);

    if (result.status === "ready") {
      return result.report;
    }

    if (result.status === "failed" && !options.isRetry) {
      return null;
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  }

  return null;
}
