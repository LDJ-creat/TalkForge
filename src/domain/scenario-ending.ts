import type { ExitPolicy, Scenario } from "./scenario";
import type { ScenarioProgress } from "./scenario-progress";
import type { Session } from "./session";
import type { Turn } from "./turn";

export type EndingSuggestionReason =
  | "required_goals_complete"
  | "max_turns_reached"
  | "max_duration_reached";

export type ProtectiveBoundaryStatus = {
  maxTurnsReached: boolean;
  maxDurationReached: boolean;
  userTurnCount: number;
  durationSec: number;
};

export type ExitPolicyEvaluation = {
  shouldSuggestEnding: boolean;
  endingSuggestionReason: EndingSuggestionReason | null;
  boundaries: ProtectiveBoundaryStatus;
};

export function countUserTurns(turns: Turn[]): number {
  return turns.filter((turn) => turn.role === "user").length;
}

export function getSessionDurationSec(
  session: Pick<Session, "startedAt" | "endedAt">,
  now: Date = new Date(),
): number {
  const startedAtMs = Date.parse(session.startedAt);
  const endMs = session.endedAt ? Date.parse(session.endedAt) : now.getTime();

  if (Number.isNaN(startedAtMs) || Number.isNaN(endMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((endMs - startedAtMs) / 1000));
}

export function isMaxTurnsReached(exitPolicy: ExitPolicy, userTurnCount: number): boolean {
  return userTurnCount >= exitPolicy.maxTurns;
}

export function isMaxDurationReached(
  exitPolicy: ExitPolicy,
  durationSec: number,
): boolean {
  return durationSec >= exitPolicy.maxDurationSec;
}

export function areRequiredGoalsComplete(
  exitPolicy: ExitPolicy,
  completedGoalIds: string[],
): boolean {
  return exitPolicy.requiredGoals.every((goalId) => completedGoalIds.includes(goalId));
}

export function resolveMissingGoalIds(scenario: Scenario, completedGoalIds: string[]): string[] {
  const requiredGoalIds = scenario.goals.filter((goal) => goal.required).map((goal) => goal.id);
  return requiredGoalIds.filter((goalId) => !completedGoalIds.includes(goalId));
}

export function inferCurrentStageId(scenario: Scenario, completedGoalIds: string[]): string {
  const stages = scenario.stages;
  if (stages.length === 0) {
    return "unknown";
  }

  const completedRequiredCount = scenario.exitPolicy.requiredGoals.filter((goalId) =>
    completedGoalIds.includes(goalId),
  ).length;
  const stageIndex = Math.min(completedRequiredCount, stages.length - 1);
  return stages[stageIndex]?.id ?? "unknown";
}

export function createInitialScenarioProgress(
  sessionId: string,
  scenario: Scenario,
  updatedAt: string = new Date().toISOString(),
): ScenarioProgress {
  return {
    sessionId,
    currentStageId: scenario.stages[0]?.id ?? "unknown",
    completedGoalIds: [],
    missingGoalIds: resolveMissingGoalIds(scenario, []),
    shouldSuggestEnding: false,
    offTopic: false,
    updatedAt,
  };
}

export function evaluateExitPolicy(input: {
  exitPolicy: ExitPolicy;
  completedGoalIds: string[];
  userTurnCount: number;
  durationSec: number;
}): ExitPolicyEvaluation {
  const boundaries: ProtectiveBoundaryStatus = {
    maxTurnsReached: isMaxTurnsReached(input.exitPolicy, input.userTurnCount),
    maxDurationReached: isMaxDurationReached(input.exitPolicy, input.durationSec),
    userTurnCount: input.userTurnCount,
    durationSec: input.durationSec,
  };

  if (boundaries.maxTurnsReached) {
    return {
      shouldSuggestEnding: true,
      endingSuggestionReason: "max_turns_reached",
      boundaries,
    };
  }

  if (boundaries.maxDurationReached) {
    return {
      shouldSuggestEnding: true,
      endingSuggestionReason: "max_duration_reached",
      boundaries,
    };
  }

  const goalsComplete = areRequiredGoalsComplete(input.exitPolicy, input.completedGoalIds);
  if (
    goalsComplete &&
    input.exitPolicy.endWhenGoalsCompleted &&
    input.exitPolicy.aiCanSuggestEnd
  ) {
    return {
      shouldSuggestEnding: true,
      endingSuggestionReason: "required_goals_complete",
      boundaries,
    };
  }

  return {
    shouldSuggestEnding: false,
    endingSuggestionReason: null,
    boundaries,
  };
}

export function mergeCompletedGoalIds(
  previousGoalIds: string[],
  newlyCompletedGoalIds: string[],
): string[] {
  return [...new Set([...previousGoalIds, ...newlyCompletedGoalIds])];
}

export function buildScenarioProgressUpdate(input: {
  sessionId: string;
  scenario: Scenario;
  session: Pick<Session, "startedAt" | "endedAt">;
  turns: Turn[];
  completedGoalIds: string[];
  previousCompletedGoalIds?: string[];
  offTopic: boolean;
  updatedAt?: string;
}): ScenarioProgress & ExitPolicyEvaluation {
  const mergedCompletedGoalIds = mergeCompletedGoalIds(
    input.previousCompletedGoalIds ?? [],
    input.completedGoalIds,
  );
  const userTurnCount = countUserTurns(input.turns);
  const durationSec = getSessionDurationSec(input.session);
  const exitEvaluation = evaluateExitPolicy({
    exitPolicy: input.scenario.exitPolicy,
    completedGoalIds: mergedCompletedGoalIds,
    userTurnCount,
    durationSec,
  });

  return {
    sessionId: input.sessionId,
    currentStageId: inferCurrentStageId(input.scenario, mergedCompletedGoalIds),
    completedGoalIds: mergedCompletedGoalIds,
    missingGoalIds: resolveMissingGoalIds(input.scenario, mergedCompletedGoalIds),
    shouldSuggestEnding: exitEvaluation.shouldSuggestEnding,
    offTopic: input.offTopic,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    ...exitEvaluation,
  };
}
