import type { LlmGoalJudgeProvider } from "@/providers/llm/contract";
import { createMockGoalJudgeProvider } from "@/providers/mock/goal-judge";

let mockGoalJudgeProvider: ReturnType<typeof createMockGoalJudgeProvider> | undefined;

export function getGoalJudgeProvider(): LlmGoalJudgeProvider {
  const providerName = process.env.LLM_GOAL_JUDGE_PROVIDER ?? "mock";

  if (providerName === "mock") {
    mockGoalJudgeProvider ??= createMockGoalJudgeProvider();
    return mockGoalJudgeProvider;
  }

  throw new Error(
    `Unsupported LLM goal judge provider "${providerName}". P0 supports "mock" only.`,
  );
}

export function resetGoalJudgeProviderForTests(): void {
  mockGoalJudgeProvider = undefined;
}
