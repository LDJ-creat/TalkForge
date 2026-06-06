import type { Scenario } from "@/domain/scenario";
import type { Session, CreateSessionInput } from "@/domain/session";
import { generateScenarioSystemInstructions } from "@/domain/scenario-prompt";
import type { RealtimeProvider } from "@/providers/realtime/contract";
import type { RealtimeSessionCredentials } from "@/providers/realtime/types";
import { isProviderError } from "@/providers/errors";
import { logSessionLifecycle } from "@/server/observability/log";

import { SessionServiceError } from "./errors";

export type StartSessionResult = {
  session: Session;
  realtimeCredentials: RealtimeSessionCredentials;
};

export type StartSessionDeps = {
  getScenarioById: (scenarioId: string) => Promise<Scenario | null>;
  createSession: (input: CreateSessionInput) => Promise<Session>;
  updateRealtimeProviderSessionId: (
    sessionId: string,
    providerSessionId: string,
  ) => Promise<Session | null>;
  failSession?: (sessionId: string) => Promise<Session | null>;
  realtimeProvider: RealtimeProvider;
};

export async function startSessionForUser(
  userId: string,
  scenarioId: string,
  deps: StartSessionDeps,
): Promise<StartSessionResult> {
  const scenario = await deps.getScenarioById(scenarioId);
  if (!scenario) {
    throw new SessionServiceError(404, "scenario_not_found", "Scenario was not found.");
  }

  const session = await deps.createSession({
    userId,
    scenarioId,
    realtimeProvider: deps.realtimeProvider.name,
  });

  logSessionLifecycle("created", {
    sessionId: session.id,
    userId,
    scenarioId,
  });

  try {
    const systemInstructions = generateScenarioSystemInstructions(scenario);
    const realtimeCredentials = await deps.realtimeProvider.createSession({
      userId,
      sessionId: session.id,
      scenarioId,
      systemInstructions,
    });

    await deps.updateRealtimeProviderSessionId(
      session.id,
      realtimeCredentials.providerSessionId,
    );

    logSessionLifecycle("realtime_ready", {
      sessionId: session.id,
      provider: realtimeCredentials.provider,
      providerSessionId: realtimeCredentials.providerSessionId,
    });

    return {
      session: {
        ...session,
        realtimeProviderSessionId: realtimeCredentials.providerSessionId,
      },
      realtimeCredentials,
    };
  } catch (error) {
    if (deps.failSession) {
      await deps.failSession(session.id);
      logSessionLifecycle("failed", {
        sessionId: session.id,
        reason: "realtime_start_failed",
      });
    }

    if (error instanceof SessionServiceError) {
      throw error;
    }

    throw new SessionServiceError(
      isProviderError(error) ? 503 : 500,
      "realtime_unavailable",
      "Could not start the mock realtime session.",
    );
  }
}
