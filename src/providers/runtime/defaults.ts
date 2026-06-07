export type ProviderResilienceDefaults = {
  timeoutMs: number;
  maxAttempts: number;
  initialRetryDelayMs: number;
  maxRetryDelayMs: number;
  backoffMultiplier: number;
  maxConcurrentCalls: number;
  healthCheckTimeoutMs: number;
};

export const DEFAULT_PROVIDER_RESILIENCE: ProviderResilienceDefaults = {
  timeoutMs: 30_000,
  maxAttempts: 3,
  initialRetryDelayMs: 250,
  maxRetryDelayMs: 5_000,
  backoffMultiplier: 2,
  maxConcurrentCalls: 10,
  healthCheckTimeoutMs: 5_000,
};

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveProviderResilienceDefaults(
  env: Record<string, string | undefined> = process.env,
): ProviderResilienceDefaults {
  return {
    timeoutMs: readPositiveInt(env.PROVIDER_DEFAULT_TIMEOUT_MS, DEFAULT_PROVIDER_RESILIENCE.timeoutMs),
    maxAttempts: readPositiveInt(
      env.PROVIDER_DEFAULT_MAX_ATTEMPTS,
      DEFAULT_PROVIDER_RESILIENCE.maxAttempts,
    ),
    initialRetryDelayMs: readPositiveInt(
      env.PROVIDER_DEFAULT_INITIAL_RETRY_DELAY_MS,
      DEFAULT_PROVIDER_RESILIENCE.initialRetryDelayMs,
    ),
    maxRetryDelayMs: readPositiveInt(
      env.PROVIDER_DEFAULT_MAX_RETRY_DELAY_MS,
      DEFAULT_PROVIDER_RESILIENCE.maxRetryDelayMs,
    ),
    backoffMultiplier: readPositiveInt(
      env.PROVIDER_DEFAULT_BACKOFF_MULTIPLIER,
      DEFAULT_PROVIDER_RESILIENCE.backoffMultiplier,
    ),
    maxConcurrentCalls: readPositiveInt(
      env.PROVIDER_DEFAULT_MAX_CONCURRENT_CALLS,
      DEFAULT_PROVIDER_RESILIENCE.maxConcurrentCalls,
    ),
    healthCheckTimeoutMs: readPositiveInt(
      env.PROVIDER_HEALTH_CHECK_TIMEOUT_MS,
      DEFAULT_PROVIDER_RESILIENCE.healthCheckTimeoutMs,
    ),
  };
}
