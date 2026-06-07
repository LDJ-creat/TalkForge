import { jsonError, readJsonBody, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import { countAsrTranscribeAttemptsForSession } from "@/server/db/repositories/ai-invocation-metrics-repository";
import {
  createTurn,
  getFreeSpeechEvaluationsByTurnIds,
  getScenarioById,
  getSessionById,
  listTurnsBySessionId,
} from "@/server/db/repositories";
import { SessionServiceError } from "@/server/session";
import { createTurnForUser } from "@/server/session/create-turn";
import { listSessionTurnsWithFeedbackForUser } from "@/server/session/list-session-turns-with-feedback";
import type { TurnRole } from "@/domain/enums";

type CreateTurnRequestBody = {
  role: TurnRole;
  transcriptText?: string;
  startedAt?: string;
  endedAt?: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId } = await context.params;
    const db = getDb();

    const turns = await listSessionTurnsWithFeedbackForUser(sessionId, userId, {
      getSessionById: (id) => getSessionById(db, id),
      listTurnsBySessionId: (id) => listTurnsBySessionId(db, id),
      getFreeSpeechEvaluationsByTurnIds: (turnIds) =>
        getFreeSpeechEvaluationsByTurnIds(db, turnIds),
    });

    return Response.json({ turns });
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

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId } = await context.params;
    const body = await readJsonBody<CreateTurnRequestBody>(request);
    const db = getDb();

    if (body.role !== "user" && body.role !== "assistant") {
      throw new SessionServiceError(400, "invalid_role", "Turn role must be user or assistant.");
    }

    const turn = await createTurnForUser(
      sessionId,
      userId,
      {
        role: body.role,
        transcriptText: body.transcriptText,
        startedAt: body.startedAt,
        endedAt: body.endedAt,
      },
      {
        getSessionById: (id) => getSessionById(db, id),
        getScenarioById: (scenarioId) => getScenarioById(db, scenarioId),
        listTurnsBySessionId: (id) => listTurnsBySessionId(db, id),
        countAsrInvocationAttempts: (id) => countAsrTranscribeAttemptsForSession(db, id),
        createTurn: (input) => createTurn(db, input),
      },
    );

    return Response.json({ turn });
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
