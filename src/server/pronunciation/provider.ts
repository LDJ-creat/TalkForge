import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import { createProviderError } from "@/providers/errors";
import {
  createIflytekIsePronunciationProvider,
  DEFAULT_IFLYTEK_ISE_WS_URL,
  IFLYTEK_ISE_PROVIDER_ID,
  isSupportedIflytekIseProviderName,
} from "@/providers/iflytek-ise";
import { createMockPronunciationEvaluationProvider } from "@/providers/mock/pronunciation";
import type { AiInvocationTraceWriter } from "@/server/ai-tracing";
import { getRuntimeConfig } from "@/server/config";

import { loadAudioObjectForPronunciation } from "./audio-loader";
import { prepareIflytekIse16kPcmAudio } from "./audio-prepare";
import { createTracedPronunciationProvider } from "./tracing-wrapper";

export type GetPronunciationProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
};

let mockPronunciationProvider:
  | ReturnType<typeof createMockPronunciationEvaluationProvider>
  | undefined;
let iflytekIsePronunciationProvider: ReturnType<
  typeof createIflytekIsePronunciationProvider
> | undefined;
let iflytekIsePronunciationCacheKey: string | undefined;

function buildIflytekIseCacheKey(): string {
  const { secrets } = getRuntimeConfig();
  return [
    secrets.pronunciationAppId ?? "",
    secrets.pronunciationApiKey ?? "",
    secrets.pronunciationApiSecret ?? "",
    secrets.pronunciationWsBaseUrl ?? DEFAULT_IFLYTEK_ISE_WS_URL,
  ].join("|");
}

function createConfiguredIflytekIseProvider(): PronunciationEvaluationProvider {
  const { secrets } = getRuntimeConfig();
  const cacheKey = buildIflytekIseCacheKey();

  if (
    !iflytekIsePronunciationProvider ||
    iflytekIsePronunciationCacheKey !== cacheKey
  ) {
    iflytekIsePronunciationProvider = createIflytekIsePronunciationProvider({
      appId: secrets.pronunciationAppId ?? "",
      apiKey: secrets.pronunciationApiKey ?? "",
      apiSecret: secrets.pronunciationApiSecret ?? "",
      wsBaseUrl: secrets.pronunciationWsBaseUrl ?? DEFAULT_IFLYTEK_ISE_WS_URL,
      loadAudio: ({ objectKey }) => loadAudioObjectForPronunciation(objectKey),
      prepareAudio: (audio) =>
        prepareIflytekIse16kPcmAudio({
          body: audio.body,
          objectKey: audio.objectKey,
        }),
    });
    iflytekIsePronunciationCacheKey = cacheKey;
  }

  return iflytekIsePronunciationProvider;
}

function resolveShadowingPronunciationProvider(): PronunciationEvaluationProvider {
  const providerName = getRuntimeConfig().providers.pronunciation.name;

  if (providerName === "mock") {
    mockPronunciationProvider ??= createMockPronunciationEvaluationProvider();
    return mockPronunciationProvider;
  }

  if (isSupportedIflytekIseProviderName(providerName)) {
    return createConfiguredIflytekIseProvider();
  }

  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: `Unsupported pronunciation provider "${providerName}". Supported values: "mock", "${IFLYTEK_ISE_PROVIDER_ID}".`,
    retryable: false,
  });
}

function resolveFreeSpeechPronunciationProvider(): PronunciationEvaluationProvider {
  mockPronunciationProvider ??= createMockPronunciationEvaluationProvider();
  return mockPronunciationProvider;
}

export function getShadowingPronunciationProvider(
  options?: GetPronunciationProviderOptions,
): PronunciationEvaluationProvider {
  const provider = resolveShadowingPronunciationProvider();
  return wrapWithTracing(provider, options);
}

export function getFreeSpeechPronunciationProvider(
  options?: GetPronunciationProviderOptions,
): PronunciationEvaluationProvider {
  const provider = resolveFreeSpeechPronunciationProvider();
  return wrapWithTracing(provider, options);
}

/** @deprecated Prefer getShadowingPronunciationProvider or getFreeSpeechPronunciationProvider. */
export function getPronunciationProvider(
  options?: GetPronunciationProviderOptions,
): PronunciationEvaluationProvider {
  return getShadowingPronunciationProvider(options);
}

function wrapWithTracing(
  provider: PronunciationEvaluationProvider,
  options?: GetPronunciationProviderOptions,
): PronunciationEvaluationProvider {
  if (!options?.traceWriter) {
    return provider;
  }

  return createTracedPronunciationProvider(provider, options.traceWriter, {
    model: provider.name,
  });
}

export function resetPronunciationProviderForTests(): void {
  mockPronunciationProvider = undefined;
  iflytekIsePronunciationProvider = undefined;
  iflytekIsePronunciationCacheKey = undefined;
}
