import type { Report } from "@/domain/report";
import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export async function fetchSessionReportFromServer(
  sessionId: string,
  userId?: string,
): Promise<Report | null> {
  const resolvedUserId = resolveClientRequestUserId(userId);

  const response = await fetch(`/api/sessions/${sessionId}/report`, {
    headers: {
      [REQUEST_USER_ID_HEADER]: resolvedUserId,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `Failed to fetch report (${response.status}).`);
  }

  const body = (await response.json()) as { report: Report };
  return body.report;
}

export async function pollSessionReportFromServer(
  sessionId: string,
  options: {
    userId?: string;
    attempts?: number;
    intervalMs?: number;
  } = {},
): Promise<Report | null> {
  const attempts = options.attempts ?? 20;
  const intervalMs = options.intervalMs ?? 750;

  for (let index = 0; index < attempts; index += 1) {
    const report = await fetchSessionReportFromServer(sessionId, options.userId);
    if (report) {
      return report;
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  }

  return null;
}
