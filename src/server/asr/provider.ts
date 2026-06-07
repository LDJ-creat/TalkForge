import type { AsrProvider } from "@/providers/asr/contract";
import { createProviderError } from "@/providers/errors";
import { createMockAsrProvider } from "@/providers/mock/asr";
import {
  createDashScopeParaformerAsrProvider,
  DEFAULT_DASHSCOPE_API_BASE_URL,
  DEFAULT_DASHSCOPE_PARAFORMER_MODEL,
} from "@/providers/dashscope-paraformer";
import { getRuntimeConfig } from "@/server/config";
import type { AiInvocationTraceWriter } from "@/server/ai-tracing";

import { loadAudioObjectForAsr } from "./audio-loader";
import { prepareParaformer8kPcmAudio } from "./audio-prepare";
import { createTracedAsrProvider } from "./tracing-wrapper";

export type GetAsrProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
};

let mockAsrProvider: ReturnType<typeof createMockAsrProvider> | undefined;
let dashScopeParaformerAsrProvider: ReturnType<
  typeof createDashScopeParaformerAsrProvider
> | undefined;
let dashScopeParaformerAsrCacheKey: string | undefined;

function buildDashScopeParaformerCacheKey(): string {
  const { secrets } = getRuntimeConfig();
  return [
    secrets.asrApiKey ?? "",
    secrets.asrBaseUrl ?? DEFAULT_DASHSCOPE_API_BASE_URL,
    secrets.asrModel ?? DEFAULT_DASHSCOPE_PARAFORMER_MODEL,
  ].join("|");
}

function createConfiguredDashScopeParaformerProvider(): AsrProvider {
  const { secrets } = getRuntimeConfig();
  const cacheKey = buildDashScopeParaformerCacheKey();

  if (!dashScopeParaformerAsrProvider || dashScopeParaformerAsrCacheKey !== cacheKey) {
    dashScopeParaformerAsrProvider = createDashScopeParaformerAsrProvider({
      apiKey: secrets.asrApiKey ?? "",
      apiBaseUrl: secrets.asrBaseUrl ?? DEFAULT_DASHSCOPE_API_BASE_URL,
      model: secrets.asrModel ?? DEFAULT_DASHSCOPE_PARAFORMER_MODEL,
      loadAudio: ({ objectKey }) => loadAudioObjectForAsr(objectKey),
      prepareAudio: (audio) =>
        prepareParaformer8kPcmAudio({
          body: audio.body,
          objectKey: audio.objectKey,
        }),
    });
    dashScopeParaformerAsrCacheKey = cacheKey;
  }

  return dashScopeParaformerAsrProvider;
}

function resolveBaseAsrProvider(): AsrProvider {
  const providerName = getRuntimeConfig().providers.asr.name;

  if (providerName === "mock") {
    mockAsrProvider ??= createMockAsrProvider();
    return mockAsrProvider;
  }

  if (providerName === "paraformer") {
    return createConfiguredDashScopeParaformerProvider();
  }

  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: `Unsupported ASR provider "${providerName}". Supported values: "mock", "paraformer".`,
    retryable: false,
  });
}

export function getAsrProvider(options?: GetAsrProviderOptions): AsrProvider {
  const provider = resolveBaseAsrProvider();

  if (!options?.traceWriter) {
    return provider;
  }

  const { secrets } = getRuntimeConfig();
  return createTracedAsrProvider(provider, options.traceWriter, {
    model: secrets.asrModel ?? DEFAULT_DASHSCOPE_PARAFORMER_MODEL,
  });
}

export function resetAsrProviderForTests(): void {
  mockAsrProvider = undefined;
  dashScopeParaformerAsrProvider = undefined;
  dashScopeParaformerAsrCacheKey = undefined;
}
