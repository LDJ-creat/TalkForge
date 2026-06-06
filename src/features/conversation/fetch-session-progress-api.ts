import type { EndingSuggestionReason } from "@/domain/scenario-ending";
import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export type ServerScenarioProgressSnapshot = {
  sessionId: string;
  currentStageId: string;
  completedGoalIds: string[];
  missingGoalIds: string[];
  shouldSuggestEnding: boolean;
  offTopic: boolean;
  updatedAt: string;
  endingSuggestionReason: EndingSuggestionReason | null;
  boundaries: {
    maxTurnsReached: boolean;
    maxDurationReached: boolean;
    userTurnCount: number;
    durationSec: number;
  };
};

export async function fetchSessionProgressFromServer(
  sessionId: string,
  userId?: string,
): Promise<ServerScenarioProgressSnapshot | null> {
  const resolvedUserId = resolveClientRequestUserId(userId);

  const response = await fetch(`/api/sessions/${sessionId}/progress`, {
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

    throw new Error(
      body?.error?.message ?? `Failed to fetch session progress (${response.status}).`,
    );
  }

  const payload = (await response.json()) as {
    progress: ServerScenarioProgressSnapshot;
  };

  return payload.progress;
}
