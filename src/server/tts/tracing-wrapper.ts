import type { AiInvocationOperation } from "@/domain/ai-invocation-log";
import type { TtsProvider } from "@/providers/tts/contract";
import {
  buildTtsCacheKey,
  buildTtsObjectKeyFromCacheKey,
} from "@/providers/tts/cache-key";
import type { TtsSynthesizeInput, TtsAudioResult } from "@/providers/tts/types";

import type { AiInvocationTraceWriter } from "@/server/ai-tracing";
import { executeTracedProviderCall } from "@/server/ai-tracing";

const TTS_GENERATE_OPERATION: AiInvocationOperation = "tts.generate";

export type TracedTtsProviderOptions = {
  model: string;
};

export function createTracedTtsProvider(
  provider: TtsProvider,
  traceWriter: AiInvocationTraceWriter,
  options: TracedTtsProviderOptions,
): TtsProvider {
  return {
    name: provider.name,
    async synthesize(input: TtsSynthesizeInput): Promise<TtsAudioResult> {
      const voice = input.voice ?? "default";
      const speed = input.speed ?? 1;
      const language = input.language ?? "en";
      const cacheKey = buildTtsCacheKey({
        text: input.text,
        voice,
        speed,
        language,
        provider: provider.name,
      });
      const outputObjectKey = buildTtsObjectKeyFromCacheKey(cacheKey);

      const { result } = await executeTracedProviderCall({
        traceWriter,
        provider: provider.name,
        model: options.model,
        operation: TTS_GENERATE_OPERATION,
        outputObjectKey,
        requestSummary: {
          textLength: input.text.length,
          voice,
          speed,
          language,
        },
        rawRequest: {
          text: input.text,
          voice,
          speed,
          language,
        },
        fn: () => provider.synthesize(input),
        extractUsage: (audio) =>
          typeof audio.durationMs === "number"
            ? { audioDurationMs: audio.durationMs }
            : undefined,
        extractResponseSummary: (audio) => ({
          provider: audio.provider,
          objectKey: audio.objectKey,
          format: audio.format,
          sizeBytes: audio.sizeBytes,
          cached: audio.metadata?.cached === true,
        }),
        extractRawResponse: (audio) => ({
          provider: audio.provider,
          objectKey: audio.objectKey,
          format: audio.format,
          codec: audio.codec,
          sampleRate: audio.sampleRate,
          durationMs: audio.durationMs,
          sizeBytes: audio.sizeBytes,
          metadata: audio.metadata,
        }),
      });

      return result;
    },
  };
}
