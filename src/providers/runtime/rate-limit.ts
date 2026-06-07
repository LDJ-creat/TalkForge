import { resolveProviderResilienceDefaults } from "./defaults";

export type SlidingWindowRateLimiterOptions = {
  maxRequests: number;
  windowMs: number;
  sleep?: (delayMs: number) => Promise<void>;
};

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export class SlidingWindowRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly timestamps: number[] = [];

  constructor(options: SlidingWindowRateLimiterOptions) {
    if (options.maxRequests < 1) {
      throw new Error("SlidingWindowRateLimiter maxRequests must be at least 1.");
    }

    if (options.windowMs < 1) {
      throw new Error("SlidingWindowRateLimiter windowMs must be at least 1.");
    }

    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async acquire(nowMs: number = Date.now()): Promise<void> {
    this.prune(nowMs);

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(nowMs);
      return;
    }

    const oldest = this.timestamps[0] ?? nowMs;
    const waitMs = Math.max(1, this.windowMs - (nowMs - oldest) + 1);
    await this.sleep(waitMs);
    return this.acquire(Date.now());
  }

  private prune(nowMs: number): void {
    const cutoff = nowMs - this.windowMs;

    while (this.timestamps.length > 0 && this.timestamps[0]! < cutoff) {
      this.timestamps.shift();
    }
  }
}

export type ConcurrencyGuardOptions = {
  maxConcurrent: number;
};

type QueueEntry = {
  resolve: () => void;
};

export class ConcurrencyGuard {
  private readonly maxConcurrent: number;
  private activeCount = 0;
  private readonly queue: QueueEntry[] = [];

  constructor(options: ConcurrencyGuardOptions) {
    if (options.maxConcurrent < 1) {
      throw new Error("ConcurrencyGuard maxConcurrent must be at least 1.");
    }

    this.maxConcurrent = options.maxConcurrent;
  }

  get active(): number {
    return this.activeCount;
  }

  get pending(): number {
    return this.queue.length;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount += 1;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push({ resolve });
    });
  }

  private release(): void {
    const next = this.queue.shift();

    if (next) {
      next.resolve();
      return;
    }

    this.activeCount = Math.max(0, this.activeCount - 1);
  }
}

export function createDefaultConcurrencyGuard(
  env: Record<string, string | undefined> = process.env,
): ConcurrencyGuard {
  const defaults = resolveProviderResilienceDefaults(env);
  return new ConcurrencyGuard({ maxConcurrent: defaults.maxConcurrentCalls });
}
