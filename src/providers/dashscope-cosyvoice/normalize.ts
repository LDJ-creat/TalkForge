import type { TtsAudioResult } from "@/providers/tts/types";
import { parseWavMetadata } from "@/shared/wav-metadata";

import { DASHSCOPE_COSYVOICE_PROVIDER_NAME } from "./config";
import type { DashScopeCosyVoiceSynthesisResult } from "./http-client";

export function normalizeDashScopeCosyVoiceSynthesis(
  synthesis: DashScopeCosyVoiceSynthesisResult,
  options: {
    objectKey: string;
    voice: string;
    speed: number;
    language: "en";
    cached?: boolean;
  },
): TtsAudioResult {
  const wavMetadata = parseWavMetadata(synthesis.audioBody);

  return {
    provider: DASHSCOPE_COSYVOICE_PROVIDER_NAME,
    objectKey: options.objectKey,
    format: synthesis.format,
    codec: wavMetadata?.codec ?? "pcm_s16le",
    sampleRate: wavMetadata?.sampleRate ?? synthesis.sampleRate,
    durationMs: wavMetadata?.durationMs,
    sizeBytes: synthesis.audioBody.byteLength,
    metadata: {
      voice: options.voice,
      speed: options.speed,
      language: options.language,
      cached: options.cached ?? false,
    },
  };
}

export function attachWavDuration(
  synthesis: DashScopeCosyVoiceSynthesisResult,
): DashScopeCosyVoiceSynthesisResult {
  const wavMetadata = parseWavMetadata(synthesis.audioBody);
  if (!wavMetadata) {
    return synthesis;
  }

  return {
    ...synthesis,
    durationMs: wavMetadata.durationMs,
  };
}
