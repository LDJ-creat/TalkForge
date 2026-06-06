export const PROVIDER_ERROR_CODES = [
  "configuration",
  "authentication",
  "authorization",
  "not_found",
  "invalid_request",
  "rate_limited",
  "timeout",
  "provider_unavailable",
  "internal",
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

const RETRYABLE_CODES = new Set<ProviderErrorCode>([
  "rate_limited",
  "timeout",
  "provider_unavailable",
]);

export type ProviderErrorOptions = {
  code: ProviderErrorCode;
  provider: string;
  message: string;
  retryable?: boolean;
  cause?: unknown;
  metadata?: Record<string, unknown>;
};

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: string;
  readonly retryable: boolean;
  readonly metadata?: Record<string, unknown>;

  constructor(options: ProviderErrorOptions) {
    super(options.message);
    this.name = "ProviderError";
    this.code = options.code;
    this.provider = options.provider;
    this.retryable = options.retryable ?? RETRYABLE_CODES.has(options.code);
    this.metadata = options.metadata;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

export function createProviderError(options: ProviderErrorOptions): ProviderError {
  return new ProviderError(options);
}

export function normalizeProviderError(
  error: unknown,
  context: { provider: string; defaultCode?: ProviderErrorCode },
): ProviderError {
  if (isProviderError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const code = inferErrorCode(error, context.defaultCode);
    return new ProviderError({
      code,
      provider: context.provider,
      message: error.message || "Provider request failed.",
      cause: error,
    });
  }

  return new ProviderError({
    code: context.defaultCode ?? "internal",
    provider: context.provider,
    message: "Provider request failed.",
    cause: error,
  });
}

function inferErrorCode(
  error: Error,
  fallback: ProviderErrorCode = "internal",
): ProviderErrorCode {
  const message = error.message.toLowerCase();

  if (message.includes("not found")) {
    return "not_found";
  }
  if (message.includes("unauthorized") || message.includes("authentication")) {
    return "authentication";
  }
  if (message.includes("forbidden") || message.includes("permission")) {
    return "authorization";
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  if (message.includes("rate limit")) {
    return "rate_limited";
  }
  if (message.includes("invalid") || message.includes("bad request")) {
    return "invalid_request";
  }
  if (message.includes("unavailable") || message.includes("network")) {
    return "provider_unavailable";
  }

  return fallback;
}
