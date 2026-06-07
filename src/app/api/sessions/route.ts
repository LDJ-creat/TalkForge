import { jsonError, readJsonBody, requireRequestUserId } from "@/server/api/http";
import { createAiInvocationTraceService } from "@/server/ai-tracing";
import { getDb } from "@/server/db/client";
import { ensureDevSessionPrerequisites } from "@/server/db/seeds/ensure-dev-session-prerequisites";
import {
  createSession,
  failSession,
  getScenarioById,
  updateSessionRealtimeProviderSessionId,
} from "@/server/db/repositories";
import { getRealtimeProvider } from "@/server/realtime/provider";
import { SessionServiceError } from "@/server/session";
import { startSessionForUser } from "@/server/session/start-session";

type StartSessionRequestBody = {
  scenarioId: string;
};

export async function POST(request: Request) {
  try {
    const userId = requireRequestUserId(request);
    const body = await readJsonBody<StartSessionRequestBody>(request);

    if (!body.scenarioId?.trim()) {
      throw new SessionServiceError(400, "invalid_scenario", "scenarioId is required.");
    }

    const db = getDb();
    await ensureDevSessionPrerequisites(db, userId, body.scenarioId.trim());

    const traceWriter = createAiInvocationTraceService({ db });

    const result = await startSessionForUser(userId, body.scenarioId.trim(), {
      getScenarioById: (scenarioId) => getScenarioById(db, scenarioId),
      createSession: (input) => createSession(db, input),
      updateRealtimeProviderSessionId: (sessionId, providerSessionId) =>
        updateSessionRealtimeProviderSessionId(db, sessionId, providerSessionId),
      failSession: (sessionId) => failSession(db, sessionId),
      realtimeProvider: getRealtimeProvider({ traceWriter }),
    });

    return Response.json(result);
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
