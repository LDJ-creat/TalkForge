import type { ScenarioProgress } from "@/domain/scenario-progress";
import type { Session } from "@/domain/session";
import type { Turn } from "@/domain/turn";
import {
  evaluateExitPolicy,
  countUserTurns,
  getSessionDurationSec,
  resolveMissingGoalIds,
  type EndingSuggestionReason,
  type ProtectiveBoundaryStatus,
} from "@/domain/scenario-ending";
import type { Scenario } from "@/domain/scenario";

import { SessionServiceError } from "@/server/session/errors";

export type ScenarioProgressView = ScenarioProgress & {
  endingSuggestionReason: EndingSuggestionReason | null;
  boundaries: ProtectiveBoundaryStatus;
};

export type FetchSessionProgressDeps = {
  getSessionById: (sessionId: string) => Promise<Session | null>;
  getScenarioById: (scenarioId: string) => Promise<Scenario | null>;
  listTurnsBySessionId: (sessionId: string) => Promise<Turn[]>;
  getScenarioProgressBySessionId: (
    sessionId: string,
  ) => Promise<ScenarioProgress | null>;
};

export async function fetchSessionProgressForUser(
  sessionId: string,
  userId: string,
  deps: FetchSessionProgressDeps,
): Promise<ScenarioProgressView> {
  const session = await deps.getSessionById(sessionId);
  if (!session) {
    throw new SessionServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== userId) {
    throw new SessionServiceError(403, "forbidden", "You do not have access to this session.");
  }

  const scenario = await deps.getScenarioById(session.scenarioId);
  if (!scenario) {
    throw new SessionServiceError(404, "scenario_not_found", "Scenario was not found.");
  }

  const [turns, progress] = await Promise.all([
    deps.listTurnsBySessionId(sessionId),
    deps.getScenarioProgressBySessionId(sessionId),
  ]);

  const userTurnCount = countUserTurns(turns);
  const durationSec = getSessionDurationSec(session);
  const completedGoalIds = progress?.completedGoalIds ?? [];
  const exitEvaluation = evaluateExitPolicy({
    exitPolicy: scenario.exitPolicy,
    completedGoalIds,
    userTurnCount,
    durationSec,
  });

  const baseProgress =
    progress ??
    ({
      sessionId,
      currentStageId: scenario.stages[0]?.id ?? "unknown",
      completedGoalIds: [],
      missingGoalIds: resolveMissingGoalIds(scenario, []),
      shouldSuggestEnding: exitEvaluation.shouldSuggestEnding,
      offTopic: false,
      updatedAt: new Date().toISOString(),
    } satisfies ScenarioProgress);

  return {
    ...baseProgress,
    shouldSuggestEnding: exitEvaluation.shouldSuggestEnding,
    endingSuggestionReason: exitEvaluation.endingSuggestionReason,
    boundaries: exitEvaluation.boundaries,
  };
}
