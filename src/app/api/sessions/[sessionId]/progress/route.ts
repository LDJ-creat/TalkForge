import { jsonError, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import {
  getScenarioById,
  getScenarioProgressBySessionId,
  getSessionById,
  listTurnsBySessionId,
} from "@/server/db/repositories";
import { fetchSessionProgressForUser } from "@/server/scenario-progress/fetch-session-progress";
import { SessionServiceError } from "@/server/session/errors";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId } = await context.params;
    const db = getDb();

    const progress = await fetchSessionProgressForUser(sessionId, userId, {
      getSessionById: (id) => getSessionById(db, id),
      getScenarioById: (id) => getScenarioById(db, id),
      listTurnsBySessionId: (id) => listTurnsBySessionId(db, id),
      getScenarioProgressBySessionId: (id) => getScenarioProgressBySessionId(db, id),
    });

    return Response.json({ progress });
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
