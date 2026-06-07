import { jsonError, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import { SessionServiceError } from "@/server/session";
import { skipTurnEvaluationForUser } from "@/server/session/skip-turn-evaluation";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; turnId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId, turnId } = await context.params;

    await skipTurnEvaluationForUser(sessionId, turnId, userId, getDb());

    return Response.json({ ok: true });
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
