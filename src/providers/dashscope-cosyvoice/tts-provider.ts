import { createProviderError } from "@/providers/errors";
import { executeProviderCall } from "@/providers/runtime";
import type { TtsProvider } from "@/providers/tts/contract";
import {
  buildTtsCacheKey,
  buildTtsObjectKeyFromCacheKey,
  DEFAULT_TTS_LANGUAGE,
  DEFAULT_TTS_SPEED,
} from "@/providers/tts/cache-key";
import type { TtsAudioResult, TtsSynthesizeInput } from "@/providers/tts/types";
import type { StandardAudioAsset, UpsertStandardAudioAssetInput } from "@/domain/standard-audio-asset";
import { parseWavMetadata } from "@/shared/wav-metadata";

import {
  DEFAULT_DASHSCOPE_COSYVOICE_SAMPLE_RATE,
  DEFAULT_DASHSCOPE_COSYVOICE_VOICE,
  DASHSCOPE_COSYVOICE_PROVIDER_NAME,
  type DashScopeCosyVoiceProviderConfig,
} from "./config";
import {
  synthesizeDashScopeCosyVoiceAudio,
  type DashScopeCosyVoiceSynthesisResult,
} from "./http-client";
import { attachWavDuration, normalizeDashScopeCosyVoiceSynthesis } from "./normalize";

export type StandardAudioMetadataRepository = {
  findByCacheKey(cacheKey: string): Promise<StandardAudioAsset | null>;
  upsert(input: UpsertStandardAudioAssetInput): Promise<StandardAudioAsset>;
};

export type PersistStandardAudioObjectInput = {
  objectKey: string;
  body: Buffer;
  contentType: string;
};

export type CreateDashScopeCosyVoiceTtsProviderOptions = Partial<DashScopeCosyVoiceProviderConfig> & {
  apiKey: string;
  metadataRepository: StandardAudioMetadataRepository;
  objectExists: (objectKey: string) => Promise<boolean>;
  persistAudio: (input: PersistStandardAudioObjectInput) => Promise<void>;
  synthesizeAudio?: (
    config: DashScopeCosyVoiceProviderConfig,
    input: {
      text: string;
      voice: string;
      speed: number;
      language: "en";
      context: Parameters<typeof synthesizeDashScopeCosyVoiceAudio>[1]["context"];
    },
  ) => Promise<DashScopeCosyVoiceSynthesisResult>;
};

export class DashScopeCosyVoiceTtsProvider implements TtsProvider {
  readonly name = DASHSCOPE_COSYVOICE_PROVIDER_NAME;
  private readonly config: DashScopeCosyVoiceProviderConfig;
  private readonly metadataRepository: StandardAudioMetadataRepository;
  private readonly objectExists: CreateDashScopeCosyVoiceTtsProviderOptions["objectExists"];
  private readonly persistAudio: CreateDashScopeCosyVoiceTtsProviderOptions["persistAudio"];
  private readonly synthesizeAudio: NonNullable<
    CreateDashScopeCosyVoiceTtsProviderOptions["synthesizeAudio"]
  >;

  constructor(options: CreateDashScopeCosyVoiceTtsProviderOptions) {
    if (!options.apiKey.trim()) {
      throw createProviderError({
        provider: DASHSCOPE_COSYVOICE_PROVIDER_NAME,
        code: "configuration",
        message: "TTS_API_KEY is required for the DashScope CosyVoice TTS provider.",
        retryable: false,
      });
    }

    this.config = {
      apiKey: options.apiKey,
      apiBaseUrl: options.apiBaseUrl ?? "https://dashscope.aliyuncs.com",
      model: options.model ?? "cosyvoice-v3-flash",
      defaultVoice: options.defaultVoice ?? DEFAULT_DASHSCOPE_COSYVOICE_VOICE,
      sampleRate: options.sampleRate ?? DEFAULT_DASHSCOPE_COSYVOICE_SAMPLE_RATE,
    };
    this.metadataRepository = options.metadataRepository;
    this.objectExists = options.objectExists;
    this.persistAudio = options.persistAudio;
    this.synthesizeAudio = options.synthesizeAudio ?? synthesizeDashScopeCosyVoiceAudio;
  }

  async synthesize(input: TtsSynthesizeInput): Promise<TtsAudioResult> {
    const voice = input.voice ?? this.config.defaultVoice;
    const speed = input.speed ?? DEFAULT_TTS_SPEED;
    const language = input.language ?? DEFAULT_TTS_LANGUAGE;
    const cacheKey = buildTtsCacheKey({
      text: input.text,
      voice,
      speed,
      language,
      provider: this.name,
    });
    const objectKey = buildTtsObjectKeyFromCacheKey(cacheKey);

    const cachedAsset = await this.metadataRepository.findByCacheKey(cacheKey);
    if (cachedAsset && (await this.objectExists(objectKey))) {
      return this.toCachedResult(cachedAsset);
    }

    const { result: synthesis } = await executeProviderCall({
      provider: this.name,
      operation: "tts.generate",
      fn: async (context) => {
        const raw = await this.synthesizeAudio(this.config, {
          text: input.text,
          voice,
          speed,
          language,
          context,
        });
        return attachWavDuration(raw);
      },
    });

    await this.persistAudio({
      objectKey,
      body: synthesis.audioBody,
      contentType: "audio/wav",
    });

    const wavMetadata = parseWavMetadata(synthesis.audioBody);
    const asset = await this.metadataRepository.upsert({
      cacheKey,
      provider: this.name,
      objectKey,
      format: synthesis.format,
      codec: wavMetadata?.codec ?? "pcm_s16le",
      sampleRate: wavMetadata?.sampleRate ?? synthesis.sampleRate,
      durationMs: synthesis.durationMs ?? wavMetadata?.durationMs ?? undefined,
      sizeBytes: synthesis.audioBody.byteLength,
      voice,
      speed,
      language,
    });

    return normalizeDashScopeCosyVoiceSynthesis(synthesis, {
      objectKey: asset.objectKey,
      voice: asset.voice,
      speed: asset.speed,
      language: asset.language,
      cached: false,
    });
  }

  private toCachedResult(asset: StandardAudioAsset): TtsAudioResult {
    return {
      provider: asset.provider,
      objectKey: asset.objectKey,
      format: asset.format,
      codec: asset.codec,
      sampleRate: asset.sampleRate,
      durationMs: asset.durationMs,
      sizeBytes: asset.sizeBytes,
      metadata: {
        voice: asset.voice,
        speed: asset.speed,
        language: asset.language,
        cached: true,
      },
    };
  }
}

export function createDashScopeCosyVoiceTtsProvider(
  options: CreateDashScopeCosyVoiceTtsProviderOptions,
): DashScopeCosyVoiceTtsProvider {
  return new DashScopeCosyVoiceTtsProvider(options);
}
