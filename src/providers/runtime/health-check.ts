import type { ProviderErrorCode } from "@/providers/errors";
import { normalizeProviderError } from "@/providers/errors";

import { resolveProviderResilienceDefaults } from "./defaults";
import { withProviderTimeout } from "./timeout";

export type ProviderHealthCheckOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type ProviderHealthCheckKind = "configuration" | "live";

export type ProviderHealthCheckResult = {
  ok: boolean;
  provider: string;
  checkKind?: ProviderHealthCheckKind;
  latencyMs?: number;
  message?: string;
  errorCode?: ProviderErrorCode;
};

export interface ProviderHealthCheck {
  readonly provider: string;
  readonly checkKind?: ProviderHealthCheckKind;
  check(options?: ProviderHealthCheckOptions): Promise<ProviderHealthCheckResult>;
}

export async function runProviderHealthCheck(
  healthCheck: ProviderHealthCheck,
  options?: ProviderHealthCheckOptions,
): Promise<ProviderHealthCheckResult> {
  const startedAt = Date.now();
  const defaults = resolveProviderResilienceDefaults();
  const timeoutMs = options?.timeoutMs ?? defaults.healthCheckTimeoutMs;

  try {
    const result =
      timeoutMs > 0
        ? await withProviderTimeout(
            ({ signal }) => healthCheck.check({ ...options, timeoutMs, signal }),
            {
              timeoutMs,
              provider: healthCheck.provider,
              operation: "health_check",
              signal: options?.signal,
            },
          )
        : await healthCheck.check(options);

    return {
      ...result,
      provider: healthCheck.provider,
      latencyMs: result.latencyMs ?? Math.max(0, Date.now() - startedAt),
    };
  } catch (error) {
    const normalized = normalizeProviderError(error, {
      provider: healthCheck.provider,
    });

    return {
      ok: false,
      provider: healthCheck.provider,
      checkKind: healthCheck.checkKind,
      latencyMs: Math.max(0, Date.now() - startedAt),
      message: normalized.message,
      errorCode: normalized.code,
    };
  }
}

export function createStaticProviderHealthCheck(input: {
  provider: string;
  checkKind?: ProviderHealthCheckKind;
  check: (options?: ProviderHealthCheckOptions) => Promise<void> | void;
}): ProviderHealthCheck {
  return {
    provider: input.provider,
    checkKind: input.checkKind,
    async check(options) {
      const startedAt = Date.now();
      await input.check(options);

      return {
        ok: true,
        provider: input.provider,
        checkKind: input.checkKind,
        latencyMs: Math.max(0, Date.now() - startedAt),
      };
    },
  };
}
