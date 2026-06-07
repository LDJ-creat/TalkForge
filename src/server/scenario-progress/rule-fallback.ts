import type { Scenario } from "@/domain/scenario";
import { buildHeuristicGoalJudgeResult } from "@/providers/llm/goal-judge-heuristic";
import type { GoalJudgeInput, GoalJudgeResult } from "@/providers/llm/goal-judge-types";

export function buildRuleFallbackGoalJudgeResult(
  input: GoalJudgeInput,
  scenario: Scenario,
  providerName: string,
): GoalJudgeResult {
  return buildHeuristicGoalJudgeResult(input, providerName, {
    scenario,
    metadata: {
      ruleFallback: true,
    },
  });
}
