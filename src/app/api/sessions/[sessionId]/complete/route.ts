import { jsonError, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import { completeSession, getSessionById } from "@/server/db/repositories";
import { getQueueAdapter } from "@/server/queue/provider";
import { ReportServiceError } from "@/server/report/errors";
import {
  completeSessionForUser,
  createCompleteSessionDeps,
} from "@/server/session";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId } = await context.params;
    const db = getDb();

    const result = await completeSessionForUser(
      sessionId,
      userId,
      createCompleteSessionDeps(
        (id) => getSessionById(db, id),
        (id, endedAt) => completeSession(db, id, endedAt),
        getQueueAdapter(),
      ),
      { endedAt: new Date().toISOString() },
    );

    return Response.json(result);
  } catch (error) {
    if (error instanceof ReportServiceError) {
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
