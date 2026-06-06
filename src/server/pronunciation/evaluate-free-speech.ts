import type { AudioSegment } from "@/domain/audio-segment";
import type {
  CreatePronunciationEvaluationInput,
  PronunciationEvaluation,
} from "@/domain/pronunciation-evaluation";
import type { Turn } from "@/domain/turn";
import { isProviderError } from "@/providers/errors";
import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import type {
  PrepareFreeSpeechEvaluationResult,
  SavePronunciationEvaluationResult,
} from "@/server/db/repositories/pronunciation-evaluation-repository";
import { JobProcessingError } from "@/queue/errors";
import type { EvaluationFreeSpeechPayload } from "@/queue/payloads";

export type EvaluateFreeSpeechResult = {
  evaluation: PronunciationEvaluation;
  created: boolean;
};

export type EvaluateFreeSpeechDeps = {
  pronunciationProvider: PronunciationEvaluationProvider;
  getTurnById: (turnId: string) => Promise<Turn | null>;
  getAudioSegmentById: (audioSegmentId: string) => Promise<AudioSegment | null>;
  prepareFreeSpeechEvaluation: (
    turnId: string,
  ) => Promise<PrepareFreeSpeechEvaluationResult>;
  saveFreeSpeechEvaluationForTurnIfAbsent: (
    input: CreatePronunciationEvaluationInput,
  ) => Promise<SavePronunciationEvaluationResult>;
  markTurnEvaluationFailed: (turnId: string) => Promise<void>;
};

export async function evaluateFreeSpeechTurn(
  payload: EvaluationFreeSpeechPayload,
  deps: EvaluateFreeSpeechDeps,
  context: { attempts: number },
): Promise<EvaluateFreeSpeechResult> {
  const turn = await deps.getTurnById(payload.turnId);
  if (!turn || turn.sessionId !== payload.sessionId) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Turn ${payload.turnId} was not found for session ${payload.sessionId}.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  const audioSegment = await deps.getAudioSegmentById(payload.audioSegmentId);
  if (!audioSegment || audioSegment.turnId !== payload.turnId) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Audio segment ${payload.audioSegmentId} was not found for turn ${payload.turnId}.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  const prepared = await deps.prepareFreeSpeechEvaluation(payload.turnId);
  if (prepared.status === "exists") {
    return {
      evaluation: prepared.evaluation,
      created: false,
    };
  }

  try {
    const providerResult = await deps.pronunciationProvider.evaluate({
      audioObjectKey: audioSegment.objectKey,
      mode: "free_speech",
      language: "en",
    });

    if (providerResult.mode !== "free_speech") {
      throw new JobProcessingError({
        code: "processing",
        message: "Pronunciation provider returned an unexpected evaluation mode.",
        attempts: context.attempts,
        retryable: false,
        metadata: {
          expectedMode: "free_speech",
          actualMode: providerResult.mode,
        },
      });
    }

    const saved = await deps.saveFreeSpeechEvaluationForTurnIfAbsent({
      turnId: payload.turnId,
      mode: "free_speech",
      overallScore: providerResult.overallScore,
      fluencyScore: providerResult.fluencyScore,
      details: providerResult.details,
    });

    return {
      evaluation: saved.evaluation,
      created: saved.created,
    };
  } catch (error) {
    await deps.markTurnEvaluationFailed(payload.turnId);
    throw mapProviderErrorToJobError(error, {
      provider: deps.pronunciationProvider.name,
      attempts: context.attempts,
    });
  }
}

function mapProviderErrorToJobError(
  error: unknown,
  context: { provider: string; attempts: number },
): JobProcessingError {
  if (error instanceof JobProcessingError) {
    return error;
  }

  if (isProviderError(error)) {
    const code =
      error.code === "not_found"
        ? "not_found"
        : error.code === "invalid_request"
          ? "validation"
          : error.code === "timeout"
            ? "timeout"
            : "processing";

    return new JobProcessingError({
      code,
      message: error.message,
      attempts: context.attempts,
      retryable: error.retryable,
      cause: error,
      metadata: {
        provider: context.provider,
        providerCode: error.code,
      },
    });
  }

  return new JobProcessingError({
    code: "processing",
    message:
      error instanceof Error ? error.message : "Free-speech evaluation failed.",
    attempts: context.attempts,
    retryable: true,
    cause: error,
  });
}
