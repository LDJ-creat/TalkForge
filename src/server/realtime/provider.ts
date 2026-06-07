import type { RealtimeProvider } from "@/providers/realtime/contract";
import { createProviderError } from "@/providers/errors";
import { createMockRealtimeProvider } from "@/providers/mock/realtime";
import {
  createQwenOmniRealtimeProvider,
  DEFAULT_QWEN_OMNI_API_BASE_URL,
  DEFAULT_QWEN_OMNI_MODEL,
  DEFAULT_QWEN_OMNI_TOKEN_TTL_SEC,
  DEFAULT_QWEN_OMNI_VOICE,
  resolveQwenOmniVoice,
} from "@/providers/qwen-omni";
import { getRuntimeConfig } from "@/server/config";
import type { AiInvocationTraceWriter } from "@/server/ai-tracing";

import { createTracedRealtimeProvider } from "./tracing-wrapper";

export type GetRealtimeProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
};

let mockRealtimeProvider: ReturnType<typeof createMockRealtimeProvider> | undefined;
let qwenOmniRealtimeProvider: ReturnType<typeof createQwenOmniRealtimeProvider> | undefined;
let qwenOmniRealtimeCacheKey: string | undefined;

function buildQwenOmniCacheKey(): string {
  const { secrets } = getRuntimeConfig();
  const model = secrets.realtimeModel ?? DEFAULT_QWEN_OMNI_MODEL;
  const voice = resolveQwenOmniVoice(model, secrets.realtimeVoice ?? DEFAULT_QWEN_OMNI_VOICE);
  return [
    secrets.realtimeApiKey ?? "",
    secrets.realtimeBaseUrl ?? DEFAULT_QWEN_OMNI_API_BASE_URL,
    model,
    voice,
    secrets.realtimeTokenTtlSec ?? DEFAULT_QWEN_OMNI_TOKEN_TTL_SEC,
  ].join("|");
}

function createConfiguredQwenOmniProvider(): RealtimeProvider {
  const { secrets } = getRuntimeConfig();
  const cacheKey = buildQwenOmniCacheKey();

  if (!qwenOmniRealtimeProvider || qwenOmniRealtimeCacheKey !== cacheKey) {
    const model = secrets.realtimeModel ?? DEFAULT_QWEN_OMNI_MODEL;
    qwenOmniRealtimeProvider = createQwenOmniRealtimeProvider({
      apiKey: secrets.realtimeApiKey ?? "",
      apiBaseUrl: secrets.realtimeBaseUrl ?? DEFAULT_QWEN_OMNI_API_BASE_URL,
      model,
      voice: resolveQwenOmniVoice(model, secrets.realtimeVoice ?? DEFAULT_QWEN_OMNI_VOICE),
      tokenTtlSec: secrets.realtimeTokenTtlSec ?? DEFAULT_QWEN_OMNI_TOKEN_TTL_SEC,
    });
    qwenOmniRealtimeCacheKey = cacheKey;
  }

  return qwenOmniRealtimeProvider;
}

function resolveBaseRealtimeProvider(): RealtimeProvider {
  const providerName = getRuntimeConfig().providers.realtime.name;

  if (providerName === "mock") {
    mockRealtimeProvider ??= createMockRealtimeProvider();
    return mockRealtimeProvider;
  }

  if (providerName === "qwen-omni") {
    return createConfiguredQwenOmniProvider();
  }

  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: `Unsupported realtime provider "${providerName}". Supported values: "mock", "qwen-omni". ("doubao" is planned but not implemented yet.)`,
    retryable: false,
  });
}

export function getRealtimeProvider(
  options?: GetRealtimeProviderOptions,
): RealtimeProvider {
  const provider = resolveBaseRealtimeProvider();

  if (!options?.traceWriter) {
    return provider;
  }

  const { secrets } = getRuntimeConfig();
  return createTracedRealtimeProvider(provider, options.traceWriter, {
    model: secrets.realtimeModel ?? DEFAULT_QWEN_OMNI_MODEL,
    promptVersion: "scenario-system-instructions-v1",
  });
}

export function resetRealtimeProviderForTests(): void {
  mockRealtimeProvider = undefined;
  qwenOmniRealtimeProvider = undefined;
  qwenOmniRealtimeCacheKey = undefined;
}
