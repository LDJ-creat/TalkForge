import { createProviderError } from "@/providers/errors";
import type { LlmGoalJudgeProvider } from "@/providers/llm/contract";
import { createMockGoalJudgeProvider } from "@/providers/mock/goal-judge";
import {
  isSupportedTextLlmProviderName,
  resolveTextLlmDefaults,
} from "@/providers/openai-compatible-text-llm";
import { getRuntimeConfig } from "@/server/config";
import type { AiInvocationTraceWriter } from "@/server/ai-tracing";

import {
  getOrCreateOpenAiCompatibleTextLlmProvider,
  resetOpenAiCompatibleTextLlmProviderCacheForTests,
} from "./openai-text-llm-instance-cache";
import { createTracedLlmGoalJudgeProvider } from "./tracing-wrapper";

export type GetTextLlmGoalJudgeProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
};

let mockGoalJudgeProvider: ReturnType<typeof createMockGoalJudgeProvider> | undefined;

function resolveBaseGoalJudgeProvider(providerName: string): LlmGoalJudgeProvider {
  if (providerName === "mock") {
    mockGoalJudgeProvider ??= createMockGoalJudgeProvider();
    return mockGoalJudgeProvider;
  }

  const { secrets } = getRuntimeConfig();
  if (
    !isSupportedTextLlmProviderName(providerName, {
      llmBaseUrl: secrets.llmBaseUrl,
    })
  ) {
    throw createProviderError({
      provider: providerName,
      code: "configuration",
      message: `Unsupported LLM goal judge provider "${providerName}". Supported values: "mock", "openai", "dashscope", or a custom OpenAI-compatible id with LLM_BASE_URL configured.`,
      retryable: false,
    });
  }

  return getOrCreateOpenAiCompatibleTextLlmProvider(providerName);
}

function resolveModel(providerName: string): string {
  const { secrets } = getRuntimeConfig();

  if (providerName === "mock") {
    return "mock-goal-judge";
  }

  if (secrets.llmModel) {
    return secrets.llmModel;
  }

  if (providerName === "openai" || providerName === "dashscope") {
    return resolveTextLlmDefaults(providerName).model;
  }

  return secrets.llmModel ?? "gpt-4o-mini";
}

export function getTextLlmGoalJudgeProvider(
  providerName: string,
  options?: GetTextLlmGoalJudgeProviderOptions,
): LlmGoalJudgeProvider {
  const provider = resolveBaseGoalJudgeProvider(providerName);

  if (!options?.traceWriter || providerName === "mock") {
    return provider;
  }

  return createTracedLlmGoalJudgeProvider(provider, options.traceWriter, {
    model: resolveModel(providerName),
  });
}

export function resetTextLlmGoalJudgeProviderForTests(): void {
  mockGoalJudgeProvider = undefined;
  resetOpenAiCompatibleTextLlmProviderCacheForTests();
}
