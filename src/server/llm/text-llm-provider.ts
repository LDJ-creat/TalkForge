import { createProviderError } from "@/providers/errors";
import type { LlmCorrectionProvider, LlmReportProvider } from "@/providers/llm/contract";
import { createMockLlmProvider } from "@/providers/mock/llm";
import {
  buildTextLlmProviderCacheKey,
  createOpenAiCompatibleTextLlmProvider,
  isSupportedTextLlmProviderName,
  resolveTextLlmDefaults,
} from "@/providers/openai-compatible-text-llm";
import { getRuntimeConfig } from "@/server/config";
import type { AiInvocationTraceWriter } from "@/server/ai-tracing";

import {
  createTracedLlmCorrectionProvider,
  createTracedLlmReportProvider,
} from "./tracing-wrapper";

export type GetTextLlmProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
};

type CachedTextLlmProvider = ReturnType<typeof createOpenAiCompatibleTextLlmProvider>;

let mockTextLlmProvider: ReturnType<typeof createMockLlmProvider> | undefined;
const cachedTextLlmProviders = new Map<string, CachedTextLlmProvider>();

function buildConfiguredProviderCacheKey(providerName: string): string {
  const { secrets } = getRuntimeConfig();

  return buildTextLlmProviderCacheKey({
    providerName,
    apiKey: secrets.llmApiKey ?? "",
    apiBaseUrl: secrets.llmBaseUrl,
    model: secrets.llmModel,
  });
}

function createConfiguredTextLlmProvider(providerName: string): CachedTextLlmProvider {
  const { secrets } = getRuntimeConfig();
  const cacheKey = buildConfiguredProviderCacheKey(providerName);
  const cached = cachedTextLlmProviders.get(cacheKey);

  if (cached) {
    return cached;
  }

  const provider = createOpenAiCompatibleTextLlmProvider({
    providerName,
    apiKey: secrets.llmApiKey ?? "",
    apiBaseUrl: secrets.llmBaseUrl,
    model: secrets.llmModel,
  });
  cachedTextLlmProviders.set(cacheKey, provider);

  return provider;
}

function resolveBaseTextLlmProvider(
  providerName: string,
): LlmCorrectionProvider & LlmReportProvider {
  if (providerName === "mock") {
    mockTextLlmProvider ??= createMockLlmProvider();
    return mockTextLlmProvider;
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
      message: `Unsupported text LLM provider "${providerName}". Supported values: "mock", "openai", "dashscope", or a custom OpenAI-compatible id with LLM_BASE_URL configured.`,
      retryable: false,
    });
  }

  return createConfiguredTextLlmProvider(providerName);
}

function resolveModel(providerName: string): string {
  const { secrets } = getRuntimeConfig();

  if (providerName === "mock") {
    return "mock-llm";
  }

  if (secrets.llmModel) {
    return secrets.llmModel;
  }

  if (providerName === "openai" || providerName === "dashscope") {
    return resolveTextLlmDefaults(providerName).model;
  }

  return secrets.llmModel ?? "gpt-4o-mini";
}

function maybeWrapWithTracing(
  provider: LlmCorrectionProvider & LlmReportProvider,
  providerName: string,
  options?: GetTextLlmProviderOptions,
): LlmCorrectionProvider & LlmReportProvider {
  if (!options?.traceWriter || providerName === "mock") {
    return provider;
  }

  const model = resolveModel(providerName);
  const tracedCorrection = createTracedLlmCorrectionProvider(
    provider,
    options.traceWriter,
    { model },
  );
  const tracedReport = createTracedLlmReportProvider(provider, options.traceWriter, {
    model,
  });

  return {
    name: provider.name,
    analyzeCorrections: tracedCorrection.analyzeCorrections.bind(tracedCorrection),
    generateReport: tracedReport.generateReport.bind(tracedReport),
  };
}

export function getTextLlmProvider(
  providerName: string,
  options?: GetTextLlmProviderOptions,
): LlmCorrectionProvider & LlmReportProvider {
  const provider = resolveBaseTextLlmProvider(providerName);
  return maybeWrapWithTracing(provider, providerName, options);
}

export function resetTextLlmProviderForTests(): void {
  mockTextLlmProvider = undefined;
  cachedTextLlmProviders.clear();
}
