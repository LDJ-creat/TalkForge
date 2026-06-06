export const JOB_ERROR_CODES = [
  "validation",
  "not_found",
  "handler_missing",
  "processing",
  "timeout",
  "internal",
] as const;

export type JobErrorCode = (typeof JOB_ERROR_CODES)[number];

const RETRYABLE_CODES = new Set<JobErrorCode>(["processing", "timeout"]);

export type JobErrorMetadata = {
  code: JobErrorCode;
  message: string;
  retryable: boolean;
  attempts: number;
  cause?: string;
  metadata?: Record<string, unknown>;
};

export type JobErrorOptions = {
  code: JobErrorCode;
  message: string;
  attempts: number;
  retryable?: boolean;
  cause?: unknown;
  metadata?: Record<string, unknown>;
};

export class JobProcessingError extends Error {
  readonly code: JobErrorCode;
  readonly retryable: boolean;
  readonly attempts: number;
  readonly metadata?: Record<string, unknown>;

  constructor(options: JobErrorOptions) {
    super(options.message);
    this.name = "JobProcessingError";
    this.code = options.code;
    this.retryable = options.retryable ?? RETRYABLE_CODES.has(options.code);
    this.attempts = options.attempts;
    this.metadata = options.metadata;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isJobProcessingError(error: unknown): error is JobProcessingError {
  return error instanceof JobProcessingError;
}

export function shouldRetryJobFailure(
  error: unknown,
  attempts: number,
  maxAttempts: number,
): boolean {
  if (attempts >= maxAttempts) {
    return false;
  }

  if (isJobProcessingError(error) && error.retryable === false) {
    return false;
  }

  return true;
}

export function normalizeJobError(
  error: unknown,
  context: { attempts: number; defaultCode?: JobErrorCode },
): JobErrorMetadata {
  if (isJobProcessingError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      attempts: error.attempts,
      cause: error.cause instanceof Error ? error.cause.message : undefined,
      metadata: error.metadata,
    };
  }

  if (error instanceof Error) {
    const code = inferJobErrorCode(error, context.defaultCode);
    return {
      code,
      message: error.message || "Background job failed.",
      retryable: true,
      attempts: context.attempts,
      cause: error.message,
    };
  }

  return {
    code: context.defaultCode ?? "internal",
    message: "Background job failed.",
    retryable: false,
    attempts: context.attempts,
  };
}

function inferJobErrorCode(
  error: Error,
  fallback: JobErrorCode = "internal",
): JobErrorCode {
  const message = error.message.toLowerCase();

  if (message.includes("not found")) {
    return "not_found";
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  if (message.includes("invalid") || message.includes("validation")) {
    return "validation";
  }

  return fallback;
}
