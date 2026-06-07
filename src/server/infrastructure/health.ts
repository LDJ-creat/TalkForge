import Redis from "ioredis";
import postgres from "postgres";

import { getRuntimeConfig } from "@/server/config";

export type InfrastructureCheckResult = {
  ok: boolean;
  message?: string;
  latencyMs?: number;
};

export type RedisHealthResult = InfrastructureCheckResult & {
  skipped?: boolean;
};

export type InfrastructureHealthReport = {
  ok: boolean;
  checks: {
    postgres: InfrastructureCheckResult;
    redis: RedisHealthResult;
  };
};

export type PostgresHealthProbe = {
  ping(): Promise<void>;
};

export type RedisHealthProbe = {
  ping(): Promise<string>;
};

const DEFAULT_POSTGRES_TIMEOUT_MS = 5_000;
const DEFAULT_REDIS_TIMEOUT_MS = 3_000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} health check timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function createPostgresHealthProbe(url: string): PostgresHealthProbe {
  const client = postgres(url, { max: 1, connect_timeout: 5 });

  return {
    async ping() {
      try {
        await client`SELECT 1`;
      } finally {
        await client.end({ timeout: 1 });
      }
    },
  };
}

export function createRedisHealthProbe(url: string): RedisHealthProbe {
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: DEFAULT_REDIS_TIMEOUT_MS,
    lazyConnect: true,
  });

  return {
    async ping() {
      try {
        await client.connect();
        return await client.ping();
      } finally {
        client.disconnect();
      }
    },
  };
}

export async function checkPostgresHealth(options?: {
  url?: string;
  probe?: PostgresHealthProbe;
  timeoutMs?: number;
}): Promise<InfrastructureCheckResult> {
  const url = options?.url;
  if (!url && !options?.probe) {
    return {
      ok: false,
      message: "DATABASE_URL is not configured.",
    };
  }

  const startedAt = Date.now();
  const probe = options?.probe ?? createPostgresHealthProbe(url!);

  try {
    await withTimeout(
      probe.ping(),
      options?.timeoutMs ?? DEFAULT_POSTGRES_TIMEOUT_MS,
      "PostgreSQL",
    );
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "PostgreSQL health check failed.",
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function checkRedisHealth(options?: {
  url?: string;
  probe?: RedisHealthProbe;
  timeoutMs?: number;
  required?: boolean;
}): Promise<RedisHealthResult> {
  const required = options?.required ?? Boolean(options?.url);
  const url = options?.url;

  if (!url && !options?.probe) {
    if (required) {
      return {
        ok: false,
        message: "REDIS_URL is not configured.",
      };
    }

    return {
      ok: true,
      skipped: true,
      message: "Redis queue is disabled (memory queue mode).",
    };
  }

  const startedAt = Date.now();
  const probe = options?.probe ?? createRedisHealthProbe(url!);

  try {
    const response = await withTimeout(
      probe.ping(),
      options?.timeoutMs ?? DEFAULT_REDIS_TIMEOUT_MS,
      "Redis",
    );

    if (response !== "PONG") {
      return {
        ok: false,
        message: `Unexpected Redis ping response: ${response}`,
        latencyMs: Date.now() - startedAt,
      };
    }

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Redis health check failed.",
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function checkInfrastructureHealth(options?: {
  databaseUrl?: string;
  redisUrl?: string;
  queueProvider?: "memory" | "redis";
  postgresProbe?: PostgresHealthProbe;
  redisProbe?: RedisHealthProbe;
}): Promise<InfrastructureHealthReport> {
  const config = getRuntimeConfig();
  const databaseUrl = options?.databaseUrl ?? config.secrets.databaseUrl;
  const redisUrl = options?.redisUrl ?? config.secrets.redisUrl;
  const queueProvider = options?.queueProvider ?? config.providers.queue.name;

  const postgres = await checkPostgresHealth({
    url: databaseUrl,
    probe: options?.postgresProbe,
  });

  const redis =
    queueProvider === "memory"
      ? {
          ok: true,
          skipped: true,
          message: "Redis queue is disabled (memory queue mode).",
        }
      : await checkRedisHealth({
          url: redisUrl,
          probe: options?.redisProbe,
          required: true,
        });

  return {
    ok: postgres.ok && redis.ok,
    checks: {
      postgres,
      redis,
    },
  };
}
