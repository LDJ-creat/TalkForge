import { detectCompletedGoalsFromUserTexts } from "@/domain/scenario-goal-heuristics";
import { mergeCompletedGoalIds } from "@/domain/scenario-ending";
import type { Scenario } from "@/domain/scenario";

import type {
  GoalJudgeInput,
  GoalJudgeResult,
  GoalJudgeScenarioContext,
} from "./goal-judge-types";

export function toHeuristicScenario(context: GoalJudgeScenarioContext): Scenario {
  return {
    ...context,
    description: "",
    level: "A2",
    userRole: "",
    aiRole: "",
    situation: context.title,
    mission: "",
    constraints: [],
    evaluationRubric: { dimensions: [] },
  };
}

export function buildHeuristicGoalJudgeResult(
  input: GoalJudgeInput,
  providerName: string,
  options?: {
    scenario?: Scenario;
    metadata?: Record<string, unknown>;
  },
): GoalJudgeResult {
  const scenario = options?.scenario ?? toHeuristicScenario(input.scenario);
  const userTexts = input.turns
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.text)
    .filter((text) => text.trim().length > 0);

  const heuristic = detectCompletedGoalsFromUserTexts(
    scenario,
    userTexts,
    input.previousProgress?.completedGoalIds ?? [],
  );

  const completedGoalIds = mergeCompletedGoalIds(
    input.previousProgress?.completedGoalIds ?? [],
    heuristic.completedGoalIds,
  );

  return {
    provider: providerName,
    completedGoalIds,
    offTopic: heuristic.offTopic,
    metadata: {
      sessionId: input.sessionId,
      userTurnCount: userTexts.length,
      ...options?.metadata,
    },
  };
}
