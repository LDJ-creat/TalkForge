import type { TalkForgeDatabase } from "@/server/db/client";
import {
  getSessionById,
  listTurnsBySessionId,
  markTurnEvaluationSkipped,
  updateTurnEvaluationStatus,
} from "@/server/db/repositories";

import { SessionServiceError } from "./errors";

export async function skipTurnEvaluationForUser(
  sessionId: string,
  turnId: string,
  userId: string,
  db: TalkForgeDatabase,
): Promise<void> {
  const session = await getSessionById(db, sessionId);
  if (!session) {
    throw new SessionServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== userId) {
    throw new SessionServiceError(403, "forbidden", "You do not have access to this session.");
  }

  const turns = await listTurnsBySessionId(db, sessionId);
  const turn = turns.find((item) => item.id === turnId);
  if (!turn) {
    throw new SessionServiceError(404, "turn_not_found", "Turn was not found.");
  }

  if (turn.role !== "user") {
    throw new SessionServiceError(
      400,
      "invalid_turn",
      "Only user turns can skip pronunciation evaluation.",
    );
  }

  if (turn.evaluationStatus === "done") {
    return;
  }

  await markTurnEvaluationSkipped(db, turnId);
}

export async function skipPendingEvaluationsWithoutAudio(
  sessionId: string,
  db: TalkForgeDatabase,
): Promise<number> {
  const turns = await listTurnsBySessionId(db, sessionId);
  let updated = 0;

  for (const turn of turns) {
    if (
      turn.role === "user" &&
      turn.evaluationStatus === "pending" &&
      !turn.audioSegmentId
    ) {
      await updateTurnEvaluationStatus(db, turn.id, "skipped");
      updated += 1;
    }
  }

  return updated;
}
