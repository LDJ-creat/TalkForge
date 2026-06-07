import type { AiInvocationOperation } from "@/domain/ai-invocation-log";
import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import type {
  PronunciationEvaluateInput,
  PronunciationEvaluationResult,
} from "@/providers/pronunciation/types";

import type { AiInvocationTraceWriter } from "@/server/ai-tracing";
import { executeTracedProviderCall } from "@/server/ai-tracing";

const PRONUNCIATION_EVALUATE_OPERATION: AiInvocationOperation = "pronunciation.evaluate";

export type TracedPronunciationProviderOptions = {
  model: string;
};

export function createTracedPronunciationProvider(
  provider: PronunciationEvaluationProvider,
  traceWriter: AiInvocationTraceWriter,
  options: TracedPronunciationProviderOptions,
): PronunciationEvaluationProvider {
  return {
    name: provider.name,
    async evaluate(
      input: PronunciationEvaluateInput,
    ): Promise<PronunciationEvaluationResult> {
      const { result } = await executeTracedProviderCall({
        traceWriter,
        provider: provider.name,
        model: options.model,
        operation: PRONUNCIATION_EVALUATE_OPERATION,
        sessionId: input.sessionId,
        turnId: input.turnId,
        jobId: input.jobId,
        inputObjectKey: input.audioObjectKey,
        requestSummary: {
          audioObjectKey: input.audioObjectKey,
          mode: input.mode,
          language: input.language ?? "en",
          referenceTextLength: input.referenceText?.length ?? 0,
        },
        rawRequest: {
          audioObjectKey: input.audioObjectKey,
          mode: input.mode,
          language: input.language ?? "en",
          referenceText: input.referenceText,
        },
        fn: () => provider.evaluate(input),
        extractUsage: (evaluation) => {
          const durationMs = evaluation.metadata?.audioDurationMs;
          if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
            return undefined;
          }

          return { audioDurationMs: durationMs };
        },
        extractResponseSummary: (evaluation) => ({
          provider: evaluation.provider,
          mode: evaluation.mode,
          overallScore: evaluation.overallScore,
          accuracyScore: evaluation.accuracyScore,
          completenessScore: evaluation.completenessScore,
          fluencyScore: evaluation.fluencyScore,
          prosodyScore: evaluation.prosodyScore,
        }),
        extractRawResponse: (evaluation) => ({
          provider: evaluation.provider,
          mode: evaluation.mode,
          overallScore: evaluation.overallScore,
          accuracyScore: evaluation.accuracyScore,
          completenessScore: evaluation.completenessScore,
          fluencyScore: evaluation.fluencyScore,
          prosodyScore: evaluation.prosodyScore,
          details: evaluation.details,
          metadata: evaluation.metadata,
        }),
      });

      return result;
    },
  };
}
