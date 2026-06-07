import type { LlmGoalJudgeProvider } from "@/providers/llm/contract";
import { createMockGoalJudgeProvider } from "@/providers/mock/goal-judge";
import { getRuntimeConfig } from "@/server/config";

let mockGoalJudgeProvider: ReturnType<typeof createMockGoalJudgeProvider> | undefined;

export function getGoalJudgeProvider(): LlmGoalJudgeProvider {
  const providerName = getRuntimeConfig().providers.llmGoalJudge.name;

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
