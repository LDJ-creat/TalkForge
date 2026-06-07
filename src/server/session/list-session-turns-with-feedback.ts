import { buildTurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
import type { Turn } from "@/domain/turn";
import type { TurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
import type { PronunciationEvaluation } from "@/domain/pronunciation-evaluation";

import { SessionServiceError } from "./errors";
import type { ListSessionTurnsDeps } from "./create-turn";

export type SessionTurnWithFeedback = {
  id: string;
  sessionId: string;
  role: Turn["role"];
  startedAt: string;
  endedAt: string;
  transcriptText?: string;
  evaluationStatus: Turn["evaluationStatus"];
  pronunciationFeedback?: TurnPronunciationFeedback;
};

export type ListSessionTurnsWithFeedbackDeps = ListSessionTurnsDeps & {
  getFreeSpeechEvaluationsByTurnIds: (
    turnIds: string[],
  ) => Promise<Map<string, PronunciationEvaluation>>;
};

export async function listSessionTurnsWithFeedbackForUser(
  sessionId: string,
  userId: string,
  deps: ListSessionTurnsWithFeedbackDeps,
): Promise<SessionTurnWithFeedback[]> {
  const session = await deps.getSessionById(sessionId);
  if (!session) {
    throw new SessionServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== userId) {
    throw new SessionServiceError(403, "forbidden", "You do not have access to this session.");
  }

  const turns = await deps.listTurnsBySessionId(sessionId);
  const userTurnIds = turns.filter((turn) => turn.role === "user").map((turn) => turn.id);
  const evaluationsByTurnId = await deps.getFreeSpeechEvaluationsByTurnIds(userTurnIds);

  return turns.map((turn) => ({
    id: turn.id,
    sessionId: turn.sessionId,
    role: turn.role,
    startedAt: turn.startedAt,
    endedAt: turn.endedAt,
    transcriptText: turn.transcriptText,
    evaluationStatus: turn.evaluationStatus,
    pronunciationFeedback: buildTurnPronunciationFeedback({
      evaluationStatus: turn.evaluationStatus,
      evaluation: evaluationsByTurnId.get(turn.id) ?? null,
    }),
  }));
}
