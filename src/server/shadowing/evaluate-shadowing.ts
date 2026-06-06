import {
  assertShadowingStandardText,
  ShadowingValidationError,
} from "@/domain/shadowing";
import type {
  CreatePronunciationEvaluationInput,
  PronunciationEvaluation,
} from "@/domain/pronunciation-evaluation";
import { isProviderError } from "@/providers/errors";
import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import type { PronunciationEvaluationResult } from "@/providers/pronunciation/types";
import type { SavePronunciationEvaluationResult } from "@/server/db/repositories/pronunciation-evaluation-repository";

export type EvaluateShadowingInput = {
  audioObjectKey: string;
  standardText: string;
  language?: "en";
};

export type EvaluateShadowingDeps = {
  pronunciationProvider: PronunciationEvaluationProvider;
};

export type EvaluateAndSaveShadowingInput = EvaluateShadowingInput & {
  turnId: string;
};

export type EvaluateAndSaveShadowingDeps = EvaluateShadowingDeps & {
  saveShadowingEvaluationForTurnIfAbsent: (
    input: CreatePronunciationEvaluationInput,
  ) => Promise<SavePronunciationEvaluationResult>;
};

export class ShadowingEvaluationError extends Error {
  readonly code: "validation" | "processing" | "not_found" | "timeout";
  readonly retryable: boolean;
  readonly provider?: string;

  constructor(options: {
    code: "validation" | "processing" | "not_found" | "timeout";
    message: string;
    retryable?: boolean;
    cause?: unknown;
    provider?: string;
  }) {
    super(options.message);
    this.name = "ShadowingEvaluationError";
    this.code = options.code;
    this.retryable = options.retryable ?? options.code === "processing";
    this.cause = options.cause;
    this.provider = options.provider;
  }
}

export async function evaluateShadowingAttempt(
  input: EvaluateShadowingInput,
  deps: EvaluateShadowingDeps,
): Promise<PronunciationEvaluationResult> {
  try {
    assertShadowingStandardText(input.standardText);
  } catch (error) {
    if (error instanceof ShadowingValidationError) {
      throw new ShadowingEvaluationError({
        code: "validation",
        message: error.message,
        retryable: false,
        cause: error,
      });
    }
    throw error;
  }

  try {
    return await deps.pronunciationProvider.evaluate({
      audioObjectKey: input.audioObjectKey,
      mode: "shadowing",
      referenceText: input.standardText.trim(),
      language: input.language ?? "en",
    });
  } catch (error) {
    throw mapProviderError(error, deps.pronunciationProvider.name);
  }
}

export async function evaluateAndSaveShadowingAttempt(
  input: EvaluateAndSaveShadowingInput,
  deps: EvaluateAndSaveShadowingDeps,
): Promise<{
  result: PronunciationEvaluationResult;
  evaluation: PronunciationEvaluation;
  created: boolean;
}> {
  const result = await evaluateShadowingAttempt(input, deps);
  const saved = await deps.saveShadowingEvaluationForTurnIfAbsent({
    turnId: input.turnId,
    mode: "shadowing",
    overallScore: result.overallScore,
    fluencyScore: result.fluencyScore,
    accuracyScore: result.accuracyScore,
    completenessScore: result.completenessScore,
    prosodyScore: result.prosodyScore,
    details: result.details,
  });

  return {
    result,
    evaluation: saved.evaluation,
    created: saved.created,
  };
}

function mapProviderError(error: unknown, provider: string): ShadowingEvaluationError {
  if (isProviderError(error)) {
    const code =
      error.code === "not_found"
        ? "not_found"
        : error.code === "invalid_request"
          ? "validation"
          : error.code === "timeout"
            ? "timeout"
            : "processing";

    return new ShadowingEvaluationError({
      code,
      message: error.message,
      retryable: error.retryable,
      cause: error,
      provider,
    });
  }

  return new ShadowingEvaluationError({
    code: "processing",
    message:
      error instanceof Error ? error.message : "Shadowing evaluation failed.",
    retryable: true,
    cause: error,
    provider,
  });
}
