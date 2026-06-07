import { isUuid } from "./ids";
import type { JobName } from "./job-names";

export type PayloadValidationError = {
  field: string;
  message: string;
};

export type PayloadValidationResult<TPayload> =
  | { valid: true; payload: TPayload }
  | { valid: false; errors: PayloadValidationError[] };

export type AsrTranscribePayload = {
  turnId: string;
  sessionId: string;
  audioSegmentId: string;
  audioObjectKey: string;
  language?: "en";
};

export type CorrectionAnalyzePayload = {
  turnId: string;
  sessionId: string;
  transcriptId?: string;
};

export type EvaluationFreeSpeechPayload = {
  turnId: string;
  sessionId: string;
  audioSegmentId: string;
};

export type EvaluationShadowingPayload = {
  turnId: string;
  sessionId: string;
  audioSegmentId: string;
  standardText: string;
};

export type ScenarioProgressEvaluatePayload = {
  sessionId: string;
  triggerTurnId?: string;
};

export type ReportGeneratePayload = {
  sessionId: string;
};

export type ShadowingGeneratePayload = {
  sessionId: string;
};

export type JobPayloadMap = {
  "asr.transcribe": AsrTranscribePayload;
  "correction.analyze": CorrectionAnalyzePayload;
  "evaluation.freeSpeech": EvaluationFreeSpeechPayload;
  "evaluation.shadowing": EvaluationShadowingPayload;
  "scenarioProgress.evaluate": ScenarioProgressEvaluatePayload;
  "report.generate": ReportGeneratePayload;
  "shadowing.generate": ShadowingGeneratePayload;
};

export type JobPayload<TName extends JobName = JobName> = JobPayloadMap[TName];

function requireNonEmptyString(
  errors: PayloadValidationError[],
  field: string,
  value: unknown,
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push({ field, message: `${field} is required.` });
  }
}

function requireUuid(
  errors: PayloadValidationError[],
  field: string,
  value: unknown,
) {
  requireNonEmptyString(errors, field, value);
  if (typeof value === "string" && value.trim().length > 0 && !isUuid(value)) {
    errors.push({ field, message: `${field} must be a UUID.` });
  }
}

function requireOptionalUuid(
  errors: PayloadValidationError[],
  field: string,
  value: unknown,
) {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push({
      field,
      message: `${field} must be a non-empty string when provided.`,
    });
    return;
  }

  if (!isUuid(value)) {
    errors.push({ field, message: `${field} must be a UUID.` });
  }
}

function validateLanguage(
  errors: PayloadValidationError[],
  value: unknown,
): value is "en" | undefined {
  if (value === undefined) {
    return true;
  }

  if (value !== "en") {
    errors.push({
      field: "language",
      message: 'language must be "en" when provided.',
    });
    return false;
  }

  return true;
}

export function validateAsrTranscribePayload(
  input: unknown,
): PayloadValidationResult<AsrTranscribePayload> {
  const errors: PayloadValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return {
      valid: false,
      errors: [{ field: "payload", message: "Payload must be an object." }],
    };
  }

  const payload = input as Record<string, unknown>;
  requireUuid(errors, "turnId", payload.turnId);
  requireUuid(errors, "sessionId", payload.sessionId);
  requireUuid(errors, "audioSegmentId", payload.audioSegmentId);
  requireNonEmptyString(errors, "audioObjectKey", payload.audioObjectKey);
  validateLanguage(errors, payload.language);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    payload: {
      turnId: payload.turnId as string,
      sessionId: payload.sessionId as string,
      audioSegmentId: payload.audioSegmentId as string,
      audioObjectKey: payload.audioObjectKey as string,
      language: payload.language as "en" | undefined,
    },
  };
}

export function validateCorrectionAnalyzePayload(
  input: unknown,
): PayloadValidationResult<CorrectionAnalyzePayload> {
  const errors: PayloadValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return {
      valid: false,
      errors: [{ field: "payload", message: "Payload must be an object." }],
    };
  }

  const payload = input as Record<string, unknown>;
  requireUuid(errors, "turnId", payload.turnId);
  requireUuid(errors, "sessionId", payload.sessionId);
  requireOptionalUuid(errors, "transcriptId", payload.transcriptId);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    payload: {
      turnId: payload.turnId as string,
      sessionId: payload.sessionId as string,
      transcriptId: payload.transcriptId as string | undefined,
    },
  };
}

export function validateEvaluationFreeSpeechPayload(
  input: unknown,
): PayloadValidationResult<EvaluationFreeSpeechPayload> {
  const errors: PayloadValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return {
      valid: false,
      errors: [{ field: "payload", message: "Payload must be an object." }],
    };
  }

  const payload = input as Record<string, unknown>;
  requireUuid(errors, "turnId", payload.turnId);
  requireUuid(errors, "sessionId", payload.sessionId);
  requireUuid(errors, "audioSegmentId", payload.audioSegmentId);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    payload: {
      turnId: payload.turnId as string,
      sessionId: payload.sessionId as string,
      audioSegmentId: payload.audioSegmentId as string,
    },
  };
}

export function validateEvaluationShadowingPayload(
  input: unknown,
): PayloadValidationResult<EvaluationShadowingPayload> {
  const errors: PayloadValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return {
      valid: false,
      errors: [{ field: "payload", message: "Payload must be an object." }],
    };
  }

  const payload = input as Record<string, unknown>;
  requireUuid(errors, "turnId", payload.turnId);
  requireUuid(errors, "sessionId", payload.sessionId);
  requireUuid(errors, "audioSegmentId", payload.audioSegmentId);
  requireNonEmptyString(errors, "standardText", payload.standardText);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    payload: {
      turnId: payload.turnId as string,
      sessionId: payload.sessionId as string,
      audioSegmentId: payload.audioSegmentId as string,
      standardText: (payload.standardText as string).trim(),
    },
  };
}

export function validateScenarioProgressEvaluatePayload(
  input: unknown,
): PayloadValidationResult<ScenarioProgressEvaluatePayload> {
  const errors: PayloadValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return {
      valid: false,
      errors: [{ field: "payload", message: "Payload must be an object." }],
    };
  }

  const payload = input as Record<string, unknown>;
  requireUuid(errors, "sessionId", payload.sessionId);
  requireOptionalUuid(errors, "triggerTurnId", payload.triggerTurnId);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    payload: {
      sessionId: payload.sessionId as string,
      triggerTurnId: payload.triggerTurnId as string | undefined,
    },
  };
}

export function validateReportGeneratePayload(
  input: unknown,
): PayloadValidationResult<ReportGeneratePayload> {
  const errors: PayloadValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return {
      valid: false,
      errors: [{ field: "payload", message: "Payload must be an object." }],
    };
  }

  const payload = input as Record<string, unknown>;
  requireUuid(errors, "sessionId", payload.sessionId);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    payload: {
      sessionId: payload.sessionId as string,
    },
  };
}

export function validateShadowingGeneratePayload(
  input: unknown,
): PayloadValidationResult<ShadowingGeneratePayload> {
  const errors: PayloadValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return {
      valid: false,
      errors: [{ field: "payload", message: "Payload must be an object." }],
    };
  }

  const payload = input as Record<string, unknown>;
  requireUuid(errors, "sessionId", payload.sessionId);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    payload: {
      sessionId: payload.sessionId as string,
    },
  };
}

const payloadValidators: {
  [TName in JobName]: (
    input: unknown,
  ) => PayloadValidationResult<JobPayloadMap[TName]>;
} = {
  "asr.transcribe": validateAsrTranscribePayload,
  "correction.analyze": validateCorrectionAnalyzePayload,
  "evaluation.freeSpeech": validateEvaluationFreeSpeechPayload,
  "evaluation.shadowing": validateEvaluationShadowingPayload,
  "scenarioProgress.evaluate": validateScenarioProgressEvaluatePayload,
  "report.generate": validateReportGeneratePayload,
  "shadowing.generate": validateShadowingGeneratePayload,
};

export function validateJobPayload<TName extends JobName>(
  name: TName,
  input: unknown,
): PayloadValidationResult<JobPayloadMap[TName]> {
  return payloadValidators[name](input);
}
