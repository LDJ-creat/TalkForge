import { createProviderError } from "../errors";
import type { LlmGoalJudgeProvider } from "../llm/contract";
import { buildHeuristicGoalJudgeResult } from "../llm/goal-judge-heuristic";
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

    return buildHeuristicGoalJudgeResult(input, this.name, {
      metadata: {
        mock: true,
      },
    });
  }
}

export function createMockGoalJudgeProvider(
  options?: MockGoalJudgeProviderOptions,
): MockGoalJudgeProvider {
  return new MockGoalJudgeProvider(options);
}
