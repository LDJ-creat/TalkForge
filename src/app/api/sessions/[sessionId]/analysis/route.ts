import { jsonError, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import {
  getCorrectionsByTurnIds,
  getFreeSpeechEvaluationsByTurnIds,
  getReportBySessionId,
  getSessionById,
  listShadowingItemsBySessionId,
  listTurnsBySessionId,
} from "@/server/db/repositories";
import { SessionServiceError } from "@/server/session";
import { fetchSessionAnalysisForUser } from "@/server/session/fetch-session-analysis";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId } = await context.params;
    const db = getDb();

    const analysis = await fetchSessionAnalysisForUser(sessionId, userId, {
      getSessionById: (id) => getSessionById(db, id),
      getReportBySessionId: (id) => getReportBySessionId(db, id),
      listTurnsBySessionId: (id) => listTurnsBySessionId(db, id),
      getFreeSpeechEvaluationsByTurnIds: (turnIds) =>
        getFreeSpeechEvaluationsByTurnIds(db, turnIds),
      getCorrectionsByTurnIds: (turnIds) => getCorrectionsByTurnIds(db, turnIds),
      listShadowingItemsBySessionId: (id) => listShadowingItemsBySessionId(db, id),
    });

    return Response.json({ analysis });
  } catch (error) {
    if (error instanceof SessionServiceError) {
      return Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status },
      );
    }

    return jsonError(error);
  }
}
