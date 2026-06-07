import type { LlmGoalJudgeProvider } from "@/providers/llm/contract";
import type { AiInvocationTraceWriter } from "@/server/ai-tracing";
import { getRuntimeConfig } from "@/server/config";
import {
  getTextLlmGoalJudgeProvider,
  resetTextLlmGoalJudgeProviderForTests,
} from "@/server/llm/goal-judge-provider";

export type GetGoalJudgeProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
};

export function getGoalJudgeProvider(
  options?: GetGoalJudgeProviderOptions,
): LlmGoalJudgeProvider {
  const providerName = getRuntimeConfig().providers.llmGoalJudge.name;
  return getTextLlmGoalJudgeProvider(providerName, options);
}

export function resetGoalJudgeProviderForTests(): void {
  resetTextLlmGoalJudgeProviderForTests();
}
