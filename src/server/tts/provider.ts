import type { TtsProvider } from "@/providers/tts/contract";
import { createProviderError } from "@/providers/errors";
import { createMockTtsProvider } from "@/providers/mock/tts";
import {
  createDashScopeCosyVoiceTtsProvider,
  DEFAULT_DASHSCOPE_COSYVOICE_MODEL,
  DEFAULT_DASHSCOPE_COSYVOICE_VOICE,
  DEFAULT_DASHSCOPE_TTS_API_BASE_URL,
  isSupportedCosyVoiceProviderName,
} from "@/providers/dashscope-cosyvoice";
import { getRuntimeConfig } from "@/server/config";
import type { AiInvocationTraceWriter } from "@/server/ai-tracing";
import { createDbStandardAudioMetadataRepository } from "@/server/db/repositories/standard-audio-asset-repository";
import { getDb } from "@/server/db/client";

import {
  InMemoryStandardAudioMetadataRepository,
} from "./metadata-repository";
import {
  objectExistsInStorage,
  persistStandardAudioObject,
} from "./storage";
import { createTracedTtsProvider } from "./tracing-wrapper";

export type GetTtsProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
  metadataRepository?: InMemoryStandardAudioMetadataRepository;
};

let mockTtsProvider: ReturnType<typeof createMockTtsProvider> | undefined;
let cosyVoiceTtsProvider: ReturnType<typeof createDashScopeCosyVoiceTtsProvider> | undefined;
let cosyVoiceTtsCacheKey: string | undefined;
let testMetadataRepository: InMemoryStandardAudioMetadataRepository | undefined;

function buildCosyVoiceCacheKey(): string {
  const { secrets } = getRuntimeConfig();
  return [
    secrets.ttsApiKey ?? "",
    secrets.ttsBaseUrl ?? DEFAULT_DASHSCOPE_TTS_API_BASE_URL,
    secrets.ttsModel ?? DEFAULT_DASHSCOPE_COSYVOICE_MODEL,
    secrets.ttsVoice ?? DEFAULT_DASHSCOPE_COSYVOICE_VOICE,
  ].join("|");
}

function resolveMetadataRepository(
  options?: GetTtsProviderOptions,
): InMemoryStandardAudioMetadataRepository | ReturnType<typeof createDbStandardAudioMetadataRepository> {
  if (options?.metadataRepository) {
    return options.metadataRepository;
  }

  if (process.env.NODE_ENV === "test") {
    testMetadataRepository ??= new InMemoryStandardAudioMetadataRepository();
    return testMetadataRepository;
  }

  return createDbStandardAudioMetadataRepository(getDb());
}

function createConfiguredCosyVoiceProvider(
  options?: GetTtsProviderOptions,
): TtsProvider {
  const { secrets } = getRuntimeConfig();
  const cacheKey = buildCosyVoiceCacheKey();

  if (!cosyVoiceTtsProvider || cosyVoiceTtsCacheKey !== cacheKey) {
    cosyVoiceTtsProvider = createDashScopeCosyVoiceTtsProvider({
      apiKey: secrets.ttsApiKey ?? "",
      apiBaseUrl: secrets.ttsBaseUrl ?? DEFAULT_DASHSCOPE_TTS_API_BASE_URL,
      model: secrets.ttsModel ?? DEFAULT_DASHSCOPE_COSYVOICE_MODEL,
      defaultVoice: secrets.ttsVoice ?? DEFAULT_DASHSCOPE_COSYVOICE_VOICE,
      metadataRepository: resolveMetadataRepository(options),
      objectExists: objectExistsInStorage,
      persistAudio: persistStandardAudioObject,
    });
    cosyVoiceTtsCacheKey = cacheKey;
  }

  return cosyVoiceTtsProvider;
}

function resolveBaseTtsProvider(options?: GetTtsProviderOptions): TtsProvider {
  const providerName = getRuntimeConfig().providers.tts.name;

  if (providerName === "mock") {
    mockTtsProvider ??= createMockTtsProvider();
    return mockTtsProvider;
  }

  if (isSupportedCosyVoiceProviderName(providerName)) {
    return createConfiguredCosyVoiceProvider(options);
  }

  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: `Unsupported TTS provider "${providerName}". Supported values: "mock", "cosyvoice".`,
    retryable: false,
  });
}

function resolveModel(providerName: string): string {
  const { secrets } = getRuntimeConfig();

  if (providerName === "mock") {
    return "mock-tts";
  }

  return secrets.ttsModel ?? DEFAULT_DASHSCOPE_COSYVOICE_MODEL;
}

export function getTtsProvider(options?: GetTtsProviderOptions): TtsProvider {
  const providerName = getRuntimeConfig().providers.tts.name;
  const provider = resolveBaseTtsProvider(options);

  if (!options?.traceWriter || providerName === "mock") {
    return provider;
  }

  return createTracedTtsProvider(provider, options.traceWriter, {
    model: resolveModel(providerName),
  });
}

export function resetTtsProviderForTests(): void {
  mockTtsProvider = undefined;
  cosyVoiceTtsProvider = undefined;
  cosyVoiceTtsCacheKey = undefined;
  testMetadataRepository?.clearForTests();
  testMetadataRepository = undefined;
}

export function getTestStandardAudioMetadataRepositoryForTests():
  | InMemoryStandardAudioMetadataRepository
  | undefined {
  return testMetadataRepository;
}
