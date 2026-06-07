import {
  assertShadowingStandardText,
  type ShadowingStandardAudio,
} from "@/domain/shadowing";
import type { TtsProvider } from "@/providers/tts/contract";
import {
  buildTtsCacheKey,
  DEFAULT_TTS_LANGUAGE,
  DEFAULT_TTS_SPEED,
  DEFAULT_TTS_VOICE,
} from "@/providers/tts/cache-key";

export type ResolveStandardAudioInput = {
  text: string;
  voice?: string;
  speed?: number;
  language?: "en";
};

export type ResolveStandardAudioDeps = {
  ttsProvider: TtsProvider;
  defaultVoice?: string;
};

export async function resolveStandardAudio(
  input: ResolveStandardAudioInput,
  deps: ResolveStandardAudioDeps,
): Promise<ShadowingStandardAudio> {
  assertShadowingStandardText(input.text);

  const voice = input.voice ?? deps.defaultVoice ?? DEFAULT_TTS_VOICE;
  const speed = input.speed ?? DEFAULT_TTS_SPEED;
  const language = input.language ?? DEFAULT_TTS_LANGUAGE;

  const result = await deps.ttsProvider.synthesize({
    text: input.text,
    voice,
    speed,
    language,
  });

  const cacheKey = buildTtsCacheKey({
    text: input.text,
    voice,
    speed,
    language,
    provider: result.provider,
  });

  return {
    provider: result.provider,
    objectKey: result.objectKey,
    format: result.format,
    codec: result.codec,
    sampleRate: result.sampleRate,
    durationMs: result.durationMs,
    sizeBytes: result.sizeBytes,
    voice,
    speed,
    language,
    cacheKey,
  };
}
