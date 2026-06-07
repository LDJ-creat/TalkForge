import { createProviderError } from "../errors";
import {
  buildTtsCacheKey,
  buildTtsObjectKeyFromCacheKey,
  DEFAULT_TTS_LANGUAGE,
  DEFAULT_TTS_SPEED,
} from "../tts/cache-key";
import type { TtsProvider } from "../tts/contract";
import type { TtsSynthesizeInput, TtsAudioResult } from "../tts/types";

export type MockTtsProviderOptions = {
  name?: string;
  voice?: string;
  sampleRate?: number;
  failOnSynthesize?: boolean;
};

export class MockTtsProvider implements TtsProvider {
  readonly name: string;
  private readonly defaultVoice: string;
  private readonly sampleRate: number;
  private readonly failOnSynthesize: boolean;
  private readonly cache = new Map<string, TtsAudioResult>();

  constructor(options: MockTtsProviderOptions = {}) {
    this.name = options.name ?? "mock-tts";
    this.defaultVoice = options.voice ?? "en-us-neutral";
    this.sampleRate = options.sampleRate ?? 24000;
    this.failOnSynthesize = options.failOnSynthesize ?? false;
  }

  async synthesize(input: TtsSynthesizeInput): Promise<TtsAudioResult> {
    if (this.failOnSynthesize) {
      throw createProviderError({
        provider: this.name,
        code: "provider_unavailable",
        message: "Mock TTS provider is configured to fail.",
      });
    }

    const cacheKey = this.buildCacheKey(input);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cached: true,
        },
      };
    }

    const objectKey = buildTtsObjectKeyFromCacheKey(cacheKey);
    const sizeBytes = Math.max(input.text.length * 120, 4096);
    const voice = input.voice ?? this.defaultVoice;
    const speed = input.speed ?? DEFAULT_TTS_SPEED;
    const language = input.language ?? DEFAULT_TTS_LANGUAGE;
    const result: TtsAudioResult = {
      provider: this.name,
      objectKey,
      format: "wav",
      codec: "pcm_s16le",
      sampleRate: this.sampleRate,
      durationMs: Math.max(Math.round(input.text.length * 70), 1000),
      sizeBytes,
      metadata: {
        text: input.text,
        voice,
        speed,
        language,
        mock: true,
        cached: false,
      },
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  private buildCacheKey(input: TtsSynthesizeInput): string {
    return buildTtsCacheKey({
      text: input.text,
      voice: input.voice ?? this.defaultVoice,
      speed: input.speed ?? DEFAULT_TTS_SPEED,
      language: input.language ?? DEFAULT_TTS_LANGUAGE,
      provider: this.name,
    });
  }
}

export function createMockTtsProvider(options?: MockTtsProviderOptions): MockTtsProvider {
  return new MockTtsProvider(options);
}
