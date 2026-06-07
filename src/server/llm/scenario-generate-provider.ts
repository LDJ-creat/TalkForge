import { createProviderError } from "@/providers/errors";
import type { LlmScenarioGenerateProvider } from "@/providers/llm/contract";
import { createMockScenarioGenerateProvider } from "@/providers/mock/scenario-generate";
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
import { createTracedLlmScenarioGenerateProvider } from "./tracing-wrapper";

export type GetTextLlmScenarioGenerateProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
};

let mockScenarioGenerateProvider:
  | ReturnType<typeof createMockScenarioGenerateProvider>
  | undefined;

function resolveBaseScenarioGenerateProvider(
  providerName: string,
): LlmScenarioGenerateProvider {
  if (providerName === "mock") {
    mockScenarioGenerateProvider ??= createMockScenarioGenerateProvider();
    return mockScenarioGenerateProvider;
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
      message: `Unsupported scenario generate provider "${providerName}". Supported values: "mock", "openai", "dashscope", or a custom OpenAI-compatible id with LLM_BASE_URL configured.`,
      retryable: false,
    });
  }

  return getOrCreateOpenAiCompatibleTextLlmProvider(providerName);
}

function resolveModel(providerName: string): string {
  const { secrets } = getRuntimeConfig();

  if (providerName === "mock") {
    return "mock-scenario-generate";
  }

  if (secrets.llmModel) {
    return secrets.llmModel;
  }

  if (providerName === "openai" || providerName === "dashscope") {
    return resolveTextLlmDefaults(providerName).model;
  }

  return secrets.llmModel ?? "gpt-4o-mini";
}

export function getTextLlmScenarioGenerateProvider(
  providerName: string,
  options?: GetTextLlmScenarioGenerateProviderOptions,
): LlmScenarioGenerateProvider {
  const provider = resolveBaseScenarioGenerateProvider(providerName);

  if (!options?.traceWriter || providerName === "mock") {
    return provider;
  }

  return createTracedLlmScenarioGenerateProvider(provider, options.traceWriter, {
    model: resolveModel(providerName),
  });
}

export function resetTextLlmScenarioGenerateProviderForTests(): void {
  mockScenarioGenerateProvider = undefined;
  resetOpenAiCompatibleTextLlmProviderCacheForTests();
}
