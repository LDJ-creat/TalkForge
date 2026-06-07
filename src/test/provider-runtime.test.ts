import { describe, expect, it, vi } from "vitest";



import { createProviderError, ProviderError } from "@/providers/errors";

import {

  computeRetryDelayMs,

  ConcurrencyGuard,

  createDefaultConcurrencyGuard,

  createStaticProviderHealthCheck,

  executeProviderCall,

  resolveProviderResilienceDefaults,

  runProviderHealthCheck,

  SlidingWindowRateLimiter,

  withProviderTimeout,

  withRetry,

} from "@/providers/runtime";



describe("withProviderTimeout", () => {

  it("resolves when the operation completes before the timeout", async () => {

    const result = await withProviderTimeout(async () => "ok", {

      timeoutMs: 500,

      provider: "mock-asr",

      operation: "transcribe",

    });



    expect(result).toBe("ok");

  });



  it("rejects with a normalized timeout ProviderError", async () => {

    await expect(

      withProviderTimeout(

        () => new Promise<string>(() => undefined),

        {

          timeoutMs: 25,

          provider: "mock-tts",

          operation: "synthesize",

        },

      ),

    ).rejects.toMatchObject({

      name: "ProviderError",

      code: "timeout",

      provider: "mock-tts",

      retryable: true,

    });

  });



  it("aborts the call signal when the timeout fires", async () => {

    let observedSignal: AbortSignal | undefined;



    await expect(

      withProviderTimeout(

        ({ signal }) => {

          observedSignal = signal;

          return new Promise<string>(() => undefined);

        },

        {

          timeoutMs: 25,

          provider: "mock-tts",

          operation: "synthesize",

        },

      ),

    ).rejects.toMatchObject({ code: "timeout" });



    expect(observedSignal?.aborted).toBe(true);

  });

});



describe("withRetry", () => {

  it("retries retryable provider errors up to the bounded attempt count", async () => {

    let attempts = 0;



    const result = await withRetry(

      async () => {

        attempts += 1;

        if (attempts < 3) {

          throw createProviderError({

            provider: "mock-llm",

            code: "provider_unavailable",

            message: "Temporary outage.",

          });

        }



        return "success";

      },

      {

        maxAttempts: 3,

        provider: "mock-llm",

        initialDelayMs: 1,

        maxDelayMs: 1,

        jitter: false,

        sleep: async () => undefined,

      },

    );



    expect(result.result).toBe("success");

    expect(result.retryCount).toBe(2);

    expect(attempts).toBe(3);

  });



  it("does not retry non-retryable authentication failures with the default policy", async () => {

    let attempts = 0;



    await expect(

      withRetry(

        async () => {

          attempts += 1;

          throw createProviderError({

            provider: "mock-realtime",

            code: "authentication",

            message: "Invalid API key.",

            retryable: false,

          });

        },

        {

          maxAttempts: 3,

          provider: "mock-realtime",

          sleep: async () => undefined,

        },

      ),

    ).rejects.toMatchObject({

      retryCount: 0,

      cause: expect.objectContaining({ code: "authentication" }),

    });



    expect(attempts).toBe(1);

  });



  it("allows custom shouldRetry overrides", async () => {

    let attempts = 0;



    await expect(

      withRetry(

        async () => {

          attempts += 1;

          throw createProviderError({

            provider: "mock-realtime",

            code: "authentication",

            message: "Invalid API key.",

            retryable: false,

          });

        },

        {

          maxAttempts: 3,

          provider: "mock-realtime",

          shouldRetry: (error) =>

            error instanceof ProviderError ? error.retryable : false,

          sleep: async () => undefined,

        },

      ),

    ).rejects.toMatchObject({ retryCount: 0 });



    expect(attempts).toBe(1);

  });



  it("applies capped exponential backoff delays", () => {

    expect(

      computeRetryDelayMs(1, {

        initialDelayMs: 100,

        maxDelayMs: 500,

        backoffMultiplier: 2,

        jitter: false,

      }),

    ).toBe(100);



    expect(

      computeRetryDelayMs(3, {

        initialDelayMs: 100,

        maxDelayMs: 500,

        backoffMultiplier: 2,

        jitter: false,

      }),

    ).toBe(400);



    expect(

      computeRetryDelayMs(5, {

        initialDelayMs: 100,

        maxDelayMs: 500,

        backoffMultiplier: 2,

        jitter: false,

      }),

    ).toBe(500);

  });

});



describe("executeProviderCall", () => {

  it("records structured metadata for successful calls", async () => {

    const onComplete = vi.fn();



    const { result, metadata } = await executeProviderCall({

      provider: "mock-storage",

      operation: "create_upload_target",

      fn: async () => ({ key: "audio/turn-1.webm" }),

      timeoutMs: 500,

      retry: false,

      onComplete,

    });



    expect(result).toEqual({ key: "audio/turn-1.webm" });

    expect(metadata).toMatchObject({

      provider: "mock-storage",

      operation: "create_upload_target",

      status: "success",

      retryCount: 0,

    });

    expect(metadata.latencyMs).toBeGreaterThanOrEqual(0);

    expect(onComplete).toHaveBeenCalledWith(metadata);

  });



  it("records normalized error metadata and rethrows ProviderError", async () => {

    const onComplete = vi.fn();



    await expect(

      executeProviderCall({

        provider: "mock-asr",

        operation: "transcribe",

        timeoutMs: 500,

        retry: false,

        onComplete,

        fn: async () => {

          throw new Error("Authentication failed");

        },

      }),

    ).rejects.toMatchObject({

      code: "authentication",

      provider: "mock-asr",

      retryable: false,

    });



    expect(onComplete).toHaveBeenCalledWith(

      expect.objectContaining({

        provider: "mock-asr",

        operation: "transcribe",

        status: "error",

        errorCode: "authentication",

        retryCount: 0,

      }),

    );

  });



  it("retries retryable failures and records retryCount in metadata", async () => {

    let attempts = 0;



    const { result, metadata } = await executeProviderCall({

      provider: "mock-llm",

      operation: "analyze",

      timeoutMs: 500,

      retry: {

        maxAttempts: 3,

        initialDelayMs: 1,

        maxDelayMs: 1,

        jitter: false,

        sleep: async () => undefined,

      },

      fn: async () => {

        attempts += 1;

        if (attempts < 3) {

          throw createProviderError({

            provider: "mock-llm",

            code: "provider_unavailable",

            message: "Temporary outage.",

          });

        }



        return "ok";

      },

    });



    expect(result).toBe("ok");

    expect(metadata.retryCount).toBe(2);

    expect(attempts).toBe(3);

  });



  it("respects configured env defaults for timeout and retry attempts", () => {

    const defaults = resolveProviderResilienceDefaults({

      PROVIDER_DEFAULT_TIMEOUT_MS: "12000",

      PROVIDER_DEFAULT_MAX_ATTEMPTS: "5",

      PROVIDER_DEFAULT_MAX_CONCURRENT_CALLS: "6",

      PROVIDER_HEALTH_CHECK_TIMEOUT_MS: "2500",

    });



    expect(defaults.timeoutMs).toBe(12_000);

    expect(defaults.maxAttempts).toBe(5);

    expect(defaults.maxConcurrentCalls).toBe(6);

    expect(defaults.healthCheckTimeoutMs).toBe(2_500);

    expect(createDefaultConcurrencyGuard({

      PROVIDER_DEFAULT_MAX_CONCURRENT_CALLS: "6",

    }).active).toBe(0);

  });

});



describe("provider health checks", () => {

  it("runs a provider health check contract and reports latency", async () => {

    const healthCheck = createStaticProviderHealthCheck({

      provider: "mock-realtime",

      check: async () => {

        await new Promise((resolve) => setTimeout(resolve, 5));

      },

    });



    const result = await runProviderHealthCheck(healthCheck, { timeoutMs: 500 });



    expect(result).toMatchObject({

      ok: true,

      provider: "mock-realtime",

    });

    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

  });



  it("maps health check timeouts to a failed result", async () => {

    const healthCheck = createStaticProviderHealthCheck({

      provider: "mock-tts",

      check: () => new Promise<void>(() => undefined),

    });



    const result = await runProviderHealthCheck(healthCheck, { timeoutMs: 25 });



    expect(result.ok).toBe(false);

    expect(result.provider).toBe("mock-tts");

    expect(result.errorCode).toBe("timeout");

  });



  it("uses the configured default health check timeout", async () => {
    vi.stubEnv("PROVIDER_HEALTH_CHECK_TIMEOUT_MS", "25");

    try {
      const healthCheck = createStaticProviderHealthCheck({
        provider: "mock-asr",
        check: () => new Promise<void>(() => undefined),
      });

      const result = await runProviderHealthCheck(healthCheck);

      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("timeout");
    } finally {
      vi.unstubAllEnvs();
    }
  });

});



describe("rate and concurrency guards", () => {

  it("limits concurrent provider calls", async () => {

    const guard = new ConcurrencyGuard({ maxConcurrent: 1 });

    let active = 0;

    let maxActive = 0;



    await Promise.all(

      Array.from({ length: 3 }, () =>

        guard.run(async () => {

          active += 1;

          maxActive = Math.max(maxActive, active);

          await new Promise((resolve) => setTimeout(resolve, 10));

          active -= 1;

        }),

      ),

    );



    expect(maxActive).toBe(1);

  });



  it("enforces a sliding-window request cap", async () => {

    vi.useFakeTimers();



    try {

      const sleepCalls: number[] = [];

      const limiter = new SlidingWindowRateLimiter({

        maxRequests: 2,

        windowMs: 1_000,

        sleep: async (delayMs) => {

          sleepCalls.push(delayMs);

          await vi.advanceTimersByTimeAsync(delayMs);

        },

      });



      await limiter.acquire(0);

      await limiter.acquire(0);



      const pending = limiter.acquire(0);

      await vi.advanceTimersByTimeAsync(1_001);

      await pending;



      expect(sleepCalls.length).toBeGreaterThan(0);

      expect(sleepCalls[0]).toBeGreaterThan(0);

    } finally {

      vi.useRealTimers();

    }

  });

});


