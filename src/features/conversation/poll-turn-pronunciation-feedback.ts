import type { EvaluationStatus } from "@/domain/enums";

import {
  fetchSessionTurnsFromServer,
  type ServerTurnWithFeedback,
} from "./create-turn-api";

const TERMINAL_EVALUATION_STATUSES = new Set<EvaluationStatus>(["done", "failed"]);

export async function pollTurnPronunciationFeedback(
  sessionId: string,
  turnId: string,
  options: {
    userId?: string;
    attempts?: number;
    intervalMs?: number;
  } = {},
): Promise<ServerTurnWithFeedback | null> {
  const attempts = options.attempts ?? 30;
  const intervalMs = options.intervalMs ?? 1500;

  for (let index = 0; index < attempts; index += 1) {
    const result = await fetchSessionTurnsFromServer(sessionId, options.userId);
    const turn = result?.turns.find((entry) => entry.id === turnId);

    if (
      turn &&
      TERMINAL_EVALUATION_STATUSES.has(turn.evaluationStatus)
    ) {
      return turn;
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  }

  const result = await fetchSessionTurnsFromServer(sessionId, options.userId);
  return result?.turns.find((entry) => entry.id === turnId) ?? null;
}
