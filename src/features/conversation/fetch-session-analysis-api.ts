import type { SessionAnalysis } from "@/domain/session-analysis";
import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export async function fetchSessionAnalysisFromServer(
  sessionId: string,
  userId?: string,
): Promise<SessionAnalysis> {
  const resolvedUserId = resolveClientRequestUserId(userId);

  const response = await fetch(`/api/sessions/${sessionId}/analysis`, {
    headers: {
      [REQUEST_USER_ID_HEADER]: resolvedUserId,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `Failed to fetch session analysis (${response.status}).`,
    );
  }

  const body = (await response.json()) as { analysis: SessionAnalysis };
  return body.analysis;
}
