import type { Correction } from "@/domain/correction";
import type { Report } from "@/domain/report";
import type { Session } from "@/domain/session";
import type { SessionAnalysis, SessionAnalysisTurn } from "@/domain/session-analysis";
import type { ShadowingItem } from "@/domain/shadowing";
import type { PronunciationEvaluation } from "@/domain/pronunciation-evaluation";
import type { Turn } from "@/domain/turn";
import { buildTurnPronunciationFeedback } from "@/domain/pronunciation-feedback";

import { SessionServiceError } from "./errors";
import type { SessionTurnWithFeedback } from "./list-session-turns-with-feedback";

export type FetchSessionAnalysisDeps = {
  getSessionById: (sessionId: string) => Promise<Session | null>;
  getReportBySessionId: (sessionId: string) => Promise<Report | null>;
  listTurnsBySessionId: (sessionId: string) => Promise<Turn[]>;
  getFreeSpeechEvaluationsByTurnIds: (
    turnIds: string[],
  ) => Promise<Map<string, PronunciationEvaluation>>;
  getCorrectionsByTurnIds: (turnIds: string[]) => Promise<Map<string, Correction[]>>;
  listShadowingItemsBySessionId: (sessionId: string) => Promise<ShadowingItem[]>;
};

function toTurnWithFeedback(
  turn: Turn,
  evaluationsByTurnId: Map<string, PronunciationEvaluation>,
): SessionTurnWithFeedback {
  return {
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
  };
}

export async function fetchSessionAnalysisForUser(
  sessionId: string,
  userId: string,
  deps: FetchSessionAnalysisDeps,
): Promise<SessionAnalysis> {
  const session = await deps.getSessionById(sessionId);
  if (!session) {
    throw new SessionServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== userId) {
    throw new SessionServiceError(403, "forbidden", "You do not have access to this session.");
  }

  const report = await deps.getReportBySessionId(sessionId);
  if (!report) {
    throw new SessionServiceError(404, "report_not_found", "Report was not found for this session.");
  }

  const [turns, shadowingItems] = await Promise.all([
    deps.listTurnsBySessionId(sessionId),
    deps.listShadowingItemsBySessionId(sessionId),
  ]);

  const userTurnIds = turns.filter((turn) => turn.role === "user").map((turn) => turn.id);
  const [evaluationsByTurnId, correctionsByTurnId] = await Promise.all([
    deps.getFreeSpeechEvaluationsByTurnIds(userTurnIds),
    deps.getCorrectionsByTurnIds(turns.map((turn) => turn.id)),
  ]);

  const analysisTurns: SessionAnalysisTurn[] = turns.map((turn) => {
    const withFeedback = toTurnWithFeedback(turn, evaluationsByTurnId);
    return {
      ...withFeedback,
      corrections: correctionsByTurnId.get(turn.id) ?? [],
    };
  });

  return {
    session: {
      id: session.id,
      scenarioId: session.scenarioId,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    },
    report,
    turns: analysisTurns,
    shadowingItems,
  };
}
