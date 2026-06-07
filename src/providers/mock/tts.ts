import { createProviderError } from "../errors";
import { buildTtsCacheKey } from "../tts/cache-key";
import type { TtsProvider } from "../tts/contract";
import type { TtsSynthesizeInput, TtsAudioResult } from "../tts/types";
import { buildTtsStandardAudioObjectKey } from "@/server/storage/object-keys";

import { hashString } from "./utils";

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
      return cached;
    }

    const objectKey = buildTtsStandardAudioObjectKey(hashString(cacheKey));
    const sizeBytes = Math.max(input.text.length * 120, 4096);
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
        voice: input.voice ?? this.defaultVoice,
        speed: input.speed ?? 1,
        language: input.language ?? "en",
        mock: true,
        cached: false,
      },
    };

    this.cache.set(cacheKey, {
      ...result,
      metadata: {
        ...result.metadata,
        cached: true,
      },
    });

    return result;
  }

  private buildCacheKey(input: TtsSynthesizeInput): string {
    return buildTtsCacheKey({
      text: input.text,
      voice: input.voice ?? this.defaultVoice,
      speed: input.speed ?? 1,
      language: input.language ?? "en",
    });
  }
}

export function createMockTtsProvider(options?: MockTtsProviderOptions): MockTtsProvider {
  return new MockTtsProvider(options);
}
