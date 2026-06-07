import type { AiInvocationOperation } from "@/domain/ai-invocation-log";
import type { AsrProvider } from "@/providers/asr/contract";
import type { AsrTranscribeInput, AsrTranscriptionResult } from "@/providers/asr/types";

import type { AiInvocationTraceWriter } from "@/server/ai-tracing";
import { executeTracedProviderCall } from "@/server/ai-tracing";

const ASR_TRANSCRIBE_OPERATION: AiInvocationOperation = "asr.transcribe";

export type TracedAsrProviderOptions = {
  model: string;
};

export function createTracedAsrProvider(
  provider: AsrProvider,
  traceWriter: AiInvocationTraceWriter,
  options: TracedAsrProviderOptions,
): AsrProvider {
  return {
    name: provider.name,
    async transcribe(input: AsrTranscribeInput): Promise<AsrTranscriptionResult> {
      const { result } = await executeTracedProviderCall({
        traceWriter,
        provider: provider.name,
        model: options.model,
        operation: ASR_TRANSCRIBE_OPERATION,
        sessionId: input.sessionId,
        turnId: input.turnId,
        jobId: input.jobId,
        inputObjectKey: input.audioObjectKey,
        requestSummary: {
          audioObjectKey: input.audioObjectKey,
          language: input.language ?? "en",
          wordTimestamps: input.wordTimestamps ?? false,
        },
        rawRequest: {
          audioObjectKey: input.audioObjectKey,
          language: input.language ?? "en",
          wordTimestamps: input.wordTimestamps ?? false,
        },
        fn: () => provider.transcribe(input),
        extractUsage: (transcription) => {
          const durationSec = transcription.metadata?.durationSec;
          if (typeof durationSec !== "number" || !Number.isFinite(durationSec)) {
            return undefined;
          }

          return {
            audioDurationMs: Math.round(durationSec * 1000),
          };
        },
        extractResponseSummary: (transcription) => ({
          textLength: transcription.text.length,
          confidence: transcription.confidence,
          segmentCount: transcription.segments.length,
          provider: transcription.provider,
        }),
        extractRawResponse: (transcription) => ({
          text: transcription.text,
          confidence: transcription.confidence,
          segments: transcription.segments,
          metadata: transcription.metadata,
        }),
      });

      return result;
    },
  };
}
