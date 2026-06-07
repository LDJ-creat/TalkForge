import {
  isProviderError,
  normalizeProviderError,
  type ProviderError,
} from "@/providers/errors";

import type { ProviderCallContext } from "./context";
import { resolveProviderResilienceDefaults } from "./defaults";
import { createProviderCallMetadata, type ProviderCallMetadataListener } from "./metadata";
import { logProviderCall } from "./provider-call-log";
import type { ConcurrencyGuard, SlidingWindowRateLimiter } from "./rate-limit";
import {
  createDefaultShouldRetry,
  RetryFailure,
  toRetryPolicyFromDefaults,
  withRetry,
  type RetryPolicy,
} from "./retry";
import { withProviderTimeout } from "./timeout";

/**
 * Executes a provider call with timeout, optional retry, guards, and metadata.
 * Retries are enabled by default; pass `retry: false` for non-idempotent writes.
 * Pass `context.signal` into fetch/SDK calls so timeouts can cancel in-flight I/O.
 */
export type ProviderCallObservabilityContext = {
  sessionId?: string;
  turnId?: string;
  jobId?: string;
  costEstimate?: number;
  /** Skip provider call logging when a wrapper logs richer context itself. */
  skipProviderCallLog?: boolean;
};

export type ExecuteProviderCallOptions<T> = {
  provider: string;
  operation: string;
  fn: (context: ProviderCallContext) => Promise<T>;
  timeoutMs?: number;
  retry?: RetryPolicy | false;
  concurrencyGuard?: ConcurrencyGuard;
  rateLimiter?: SlidingWindowRateLimiter;
  /** Optional upstream signal; also aborted when the runtime timeout fires. */
  signal?: AbortSignal;
  onComplete?: ProviderCallMetadataListener;
  observability?: ProviderCallObservabilityContext;
};

export type ExecuteProviderCallResult<T> = {
  result: T;
  metadata: ReturnType<typeof createProviderCallMetadata>;
};

function finalizeProviderError(error: unknown, provider: string): ProviderError {
  return isProviderError(error)
    ? error
    : normalizeProviderError(error, { provider });
}

function emitProviderCallLog(
  options: ExecuteProviderCallOptions<unknown>,
  metadata: ReturnType<typeof createProviderCallMetadata>,
): void {
  if (options.observability?.skipProviderCallLog) {
    return;
  }

  logProviderCall({
    provider: options.provider,
    operation: options.operation,
    latencyMs: metadata.latencyMs,
    status: metadata.status,
    retryCount: metadata.retryCount,
    errorCode: metadata.errorCode,
    costEstimate: options.observability?.costEstimate,
    sessionId: options.observability?.sessionId,
    turnId: options.observability?.turnId,
    jobId: options.observability?.jobId,
  });
}

async function runGuardedCall<T>(
  options: ExecuteProviderCallOptions<T>,
  invoke: () => Promise<T>,
): Promise<T> {
  if (options.rateLimiter) {
    await options.rateLimiter.acquire();
  }

  if (options.concurrencyGuard) {
    return options.concurrencyGuard.run(invoke);
  }

  return invoke();
}

export async function executeProviderCall<T>(
  options: ExecuteProviderCallOptions<T>,
): Promise<ExecuteProviderCallResult<T>> {
  const defaults = resolveProviderResilienceDefaults();
  const startedAtMs = Date.now();
  const timeoutMs = options.timeoutMs ?? defaults.timeoutMs;
  const retryPolicy =
    options.retry === false
      ? undefined
      : {
          ...toRetryPolicyFromDefaults(defaults),
          provider: options.provider,
          shouldRetry: createDefaultShouldRetry(options.provider),
          ...options.retry,
        };

  const invokeOnce = () =>
    withProviderTimeout(
      (context) => runGuardedCall(options, () => options.fn(context)),
      {
        timeoutMs,
        provider: options.provider,
        operation: options.operation,
        signal: options.signal,
      },
    );

  try {
    if (retryPolicy) {
      const { result, retryCount } = await withRetry(invokeOnce, retryPolicy);
      const metadata = createProviderCallMetadata({
        provider: options.provider,
        operation: options.operation,
        startedAtMs,
        status: "success",
        retryCount,
      });
      options.onComplete?.(metadata);
      emitProviderCallLog(options, metadata);

      return { result, metadata };
    }

    const result = await invokeOnce();
    const metadata = createProviderCallMetadata({
      provider: options.provider,
      operation: options.operation,
      startedAtMs,
      status: "success",
      retryCount: 0,
    });
    options.onComplete?.(metadata);
    emitProviderCallLog(options, metadata);

    return { result, metadata };
  } catch (error) {
    const failure = error instanceof RetryFailure ? error.cause : error;
    const normalized = finalizeProviderError(failure, options.provider);
    const retryCount = error instanceof RetryFailure ? error.retryCount : 0;

    const metadata = createProviderCallMetadata({
      provider: options.provider,
      operation: options.operation,
      startedAtMs,
      status: "error",
      retryCount,
      errorCode: normalized.code,
    });
    options.onComplete?.(metadata);
    emitProviderCallLog(options, metadata);

    throw normalized;
  }
}

