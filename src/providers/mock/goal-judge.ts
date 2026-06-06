import { detectCompletedGoalsFromUserTexts } from "@/domain/scenario-goal-heuristics";
import { mergeCompletedGoalIds } from "@/domain/scenario-ending";
import { createProviderError } from "../errors";
import type { LlmGoalJudgeProvider } from "../llm/contract";
import type { GoalJudgeInput, GoalJudgeResult } from "../llm/goal-judge-types";

export type MockGoalJudgeProviderOptions = {
  name?: string;
  failOnEvaluate?: boolean;
};

export class MockGoalJudgeProvider implements LlmGoalJudgeProvider {
  readonly name: string;
  private readonly failOnEvaluate: boolean;

  constructor(options: MockGoalJudgeProviderOptions = {}) {
    this.name = options.name ?? "mock-goal-judge";
    this.failOnEvaluate = options.failOnEvaluate ?? false;
  }

  async evaluateGoals(input: GoalJudgeInput): Promise<GoalJudgeResult> {
    if (this.failOnEvaluate) {
      throw createProviderError({
        provider: this.name,
        code: "provider_unavailable",
        message: "Mock goal judge provider is configured to fail evaluation.",
      });
    }

    const userTexts = input.turns
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.text)
      .filter((text) => text.trim().length > 0);

    const heuristic = detectCompletedGoalsFromUserTexts(
      {
        ...input.scenario,
        description: "",
        level: "A2",
        userRole: "",
        aiRole: "",
        situation: "",
        mission: "",
        constraints: [],
        evaluationRubric: { dimensions: [] },
      },
      userTexts,
      input.previousProgress?.completedGoalIds ?? [],
    );

    const completedGoalIds = mergeCompletedGoalIds(
      input.previousProgress?.completedGoalIds ?? [],
      heuristic.completedGoalIds,
    );

    return {
      provider: this.name,
      completedGoalIds,
      offTopic: heuristic.offTopic,
      metadata: {
        sessionId: input.sessionId,
        mock: true,
        userTurnCount: userTexts.length,
      },
    };
  }
}

export function createMockGoalJudgeProvider(
  options?: MockGoalJudgeProviderOptions,
): MockGoalJudgeProvider {
  return new MockGoalJudgeProvider(options);
}
