import {

  isProviderError,

  normalizeProviderError,

  type ProviderError,

} from "@/providers/errors";



export type RetryPolicy = {

  maxAttempts: number;

  provider?: string;

  initialDelayMs?: number;

  maxDelayMs?: number;

  backoffMultiplier?: number;

  jitter?: boolean;

  shouldRetry?: (error: unknown, attempt: number) => boolean;

  sleep?: (delayMs: number) => Promise<void>;

};



export type RetryResult<T> = {

  result: T;

  retryCount: number;

};



export class RetryFailure extends Error {

  readonly retryCount: number;

  readonly cause: unknown;



  constructor(retryCount: number, cause: unknown) {

    super(

      cause instanceof Error

        ? cause.message

        : "Provider call failed after retry attempts were exhausted.",

    );

    this.name = "RetryFailure";

    this.retryCount = retryCount;

    this.cause = cause;

  }

}



const DEFAULT_INITIAL_DELAY_MS = 250;

const DEFAULT_MAX_DELAY_MS = 5_000;

const DEFAULT_BACKOFF_MULTIPLIER = 2;



function defaultSleep(delayMs: number): Promise<void> {

  return new Promise((resolve) => {

    setTimeout(resolve, delayMs);

  });

}



export function createDefaultShouldRetry(provider: string) {

  return (error: unknown): boolean => {

    const normalized = isProviderError(error)

      ? error

      : normalizeProviderError(error, { provider });



    return normalized.retryable;

  };

}



export function computeRetryDelayMs(

  attempt: number,

  policy: Pick<

    RetryPolicy,

    "initialDelayMs" | "maxDelayMs" | "backoffMultiplier" | "jitter"

  >,

): number {

  const initialDelayMs = policy.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;

  const maxDelayMs = policy.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  const backoffMultiplier = policy.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;

  const jitter = policy.jitter ?? true;



  const exponentialDelay = initialDelayMs * backoffMultiplier ** Math.max(0, attempt - 1);

  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);



  if (!jitter) {

    return cappedDelay;

  }



  return Math.floor(Math.random() * cappedDelay);

}



export async function withRetry<T>(

  operation: () => Promise<T>,

  policy: RetryPolicy,

): Promise<RetryResult<T>> {

  const maxAttempts = Math.max(1, policy.maxAttempts);

  const sleep = policy.sleep ?? defaultSleep;

  const shouldRetry =

    policy.shouldRetry ?? createDefaultShouldRetry(policy.provider ?? "unknown");



  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {

    try {

      const result = await operation();

      return {

        result,

        retryCount: attempt - 1,

      };

    } catch (error) {

      const isLastAttempt = attempt >= maxAttempts;

      const retryable = shouldRetry(error, attempt);



      if (isLastAttempt || !retryable) {

        throw new RetryFailure(attempt - 1, error);

      }



      const delayMs = computeRetryDelayMs(attempt, policy);

      if (delayMs > 0) {

        await sleep(delayMs);

      }

    }

  }



  throw new RetryFailure(maxAttempts - 1, new Error("Retry loop exited unexpectedly."));

}



export function toRetryPolicyFromDefaults(defaults: {

  maxAttempts: number;

  initialRetryDelayMs: number;

  maxRetryDelayMs: number;

  backoffMultiplier: number;

}): RetryPolicy {

  return {

    maxAttempts: defaults.maxAttempts,

    initialDelayMs: defaults.initialRetryDelayMs,

    maxDelayMs: defaults.maxRetryDelayMs,

    backoffMultiplier: defaults.backoffMultiplier,

  };

}



export function getRetryableProviderError(

  error: unknown,

  provider: string,

): ProviderError {

  return isProviderError(error)

    ? error

    : normalizeProviderError(error, { provider });

}


