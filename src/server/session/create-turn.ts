import type { TurnRole } from "@/domain/enums";
import type { Scenario } from "@/domain/scenario";
import type { Session } from "@/domain/session";
import type { CreateTurnInput, Turn } from "@/domain/turn";
import { assertSessionWithinLimitsOrThrow } from "@/server/observability/enforce-session-limits";
import { logTurnLifecycle } from "@/server/observability/log";

import { SessionServiceError } from "./errors";

export type CreateTurnForUserInput = {
  role: TurnRole;
  transcriptText?: string;
  startedAt?: string;
  endedAt?: string;
};

export type CreateTurnForUserDeps = {
  getSessionById: (sessionId: string) => Promise<Session | null>;
  getScenarioById: (scenarioId: string) => Promise<Scenario | null>;
  listTurnsBySessionId: (sessionId: string) => Promise<Turn[]>;
  countAsrInvocationAttempts?: (sessionId: string) => Promise<number>;
  createTurn: (input: CreateTurnInput) => Promise<Turn>;
};

export async function createTurnForUser(
  sessionId: string,
  userId: string,
  input: CreateTurnForUserInput,
  deps: CreateTurnForUserDeps,
): Promise<Turn> {
  const session = await deps.getSessionById(sessionId);
  if (!session) {
    throw new SessionServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== userId) {
    throw new SessionServiceError(403, "forbidden", "You do not have access to this session.");
  }

  if (session.status !== "active") {
    throw new SessionServiceError(
      409,
      "session_not_active",
      "Turns can only be added to active sessions.",
    );
  }

  if (input.role === "user") {
    const [scenario, turns, asrInvocationCount] = await Promise.all([
      deps.getScenarioById(session.scenarioId),
      deps.listTurnsBySessionId(sessionId),
      deps.countAsrInvocationAttempts?.(sessionId) ?? Promise.resolve(0),
    ]);

    if (!scenario) {
      throw new SessionServiceError(404, "scenario_not_found", "Scenario was not found.");
    }

    assertSessionWithinLimitsOrThrow({
      scenario,
      session,
      turns,
      asrInvocationCount,
      pending: { additionalUserTurns: 1 },
    });
  }

  const endedAt = input.endedAt ?? new Date().toISOString();
  const startedAt =
    input.startedAt ?? new Date(new Date(endedAt).getTime() - 2_000).toISOString();

  const turn = await deps.createTurn({
    sessionId,
    role: input.role,
    startedAt,
    endedAt,
    transcriptText: input.transcriptText,
    evaluationStatus: input.role === "user" ? "pending" : "none",
  });

  logTurnLifecycle("created", {
    sessionId,
    turnId: turn.id,
    role: input.role,
  });

  return turn;
}

export type ListSessionTurnsDeps = {
  getSessionById: (sessionId: string) => Promise<Session | null>;
  listTurnsBySessionId: (sessionId: string) => Promise<Turn[]>;
};

export async function listSessionTurnsForUser(
  sessionId: string,
  userId: string,
  deps: ListSessionTurnsDeps,
): Promise<Turn[]> {
  const session = await deps.getSessionById(sessionId);
  if (!session) {
    throw new SessionServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== userId) {
    throw new SessionServiceError(403, "forbidden", "You do not have access to this session.");
  }

  return deps.listTurnsBySessionId(sessionId);
}
