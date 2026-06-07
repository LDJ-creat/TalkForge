import type { AudioSegment } from "@/domain/audio-segment";
import type {
  CreatePronunciationEvaluationInput,
  PronunciationEvaluation,
} from "@/domain/pronunciation-evaluation";
import type { Turn } from "@/domain/turn";
import { isProviderError } from "@/providers/errors";
import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import type {
  PrepareShadowingEvaluationResult,
  SavePronunciationEvaluationResult,
} from "@/server/db/repositories/pronunciation-evaluation-repository";
import { JobProcessingError } from "@/queue/errors";
import type { EvaluationShadowingPayload } from "@/queue/payloads";
import {
  evaluateAndSaveShadowingAttempt,
  ShadowingEvaluationError,
} from "@/server/shadowing/evaluate-shadowing";

export type EvaluateShadowingTurnResult = {
  evaluation: PronunciationEvaluation;
  created: boolean;
};

export type EvaluateShadowingTurnDeps = {
  pronunciationProvider: PronunciationEvaluationProvider;
  getTurnById: (turnId: string) => Promise<Turn | null>;
  getAudioSegmentById: (audioSegmentId: string) => Promise<AudioSegment | null>;
  prepareShadowingEvaluation: (
    turnId: string,
  ) => Promise<PrepareShadowingEvaluationResult>;
  saveShadowingEvaluationForTurnIfAbsent: (
    input: CreatePronunciationEvaluationInput,
  ) => Promise<SavePronunciationEvaluationResult>;
};

export async function evaluateShadowingTurn(
  payload: EvaluationShadowingPayload,
  deps: EvaluateShadowingTurnDeps,
  context: { attempts: number; jobId?: string },
): Promise<EvaluateShadowingTurnResult> {
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

  const prepared = await deps.prepareShadowingEvaluation(payload.turnId);
  if (prepared.status === "exists") {
    return {
      evaluation: prepared.evaluation,
      created: false,
    };
  }

  try {
    const saved = await evaluateAndSaveShadowingAttempt(
      {
        turnId: payload.turnId,
        audioObjectKey: audioSegment.objectKey,
        standardText: payload.standardText,
      },
      {
        pronunciationProvider: {
          name: deps.pronunciationProvider.name,
          evaluate: (input) =>
            deps.pronunciationProvider.evaluate({
              ...input,
              sessionId: payload.sessionId,
              turnId: payload.turnId,
              jobId: context.jobId,
            }),
        },
        saveShadowingEvaluationForTurnIfAbsent:
          deps.saveShadowingEvaluationForTurnIfAbsent,
      },
    );

    return {
      evaluation: saved.evaluation,
      created: saved.created,
    };
  } catch (error) {
    throw mapShadowingErrorToJobError(error, {
      provider: deps.pronunciationProvider.name,
      attempts: context.attempts,
    });
  }
}

function mapShadowingErrorToJobError(
  error: unknown,
  context: { provider: string; attempts: number },
): JobProcessingError {
  if (error instanceof JobProcessingError) {
    return error;
  }

  if (error instanceof ShadowingEvaluationError) {
    return new JobProcessingError({
      code: error.code,
      message: error.message,
      attempts: context.attempts,
      retryable: error.retryable,
      cause: error,
      metadata: {
        provider: context.provider,
      },
    });
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
      error instanceof Error ? error.message : "Shadowing evaluation failed.",
    attempts: context.attempts,
    retryable: true,
    cause: error,
  });
}
