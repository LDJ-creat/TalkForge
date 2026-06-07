import { afterEach, describe, expect, it, vi } from "vitest";

import { resetRuntimeConfigForTests } from "@/server/config";
import {
  checkFfmpegHealth,
  checkInfrastructureHealth,
  checkPostgresHealth,
  checkRedisHealth,
} from "@/server/infrastructure";

describe("infrastructure health checks", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
  });

  it("reports postgres failure when database url is missing", async () => {
    const result = await checkPostgresHealth();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/DATABASE_URL/i);
  });

  it("reports postgres success from an injected probe", async () => {
    const ping = vi.fn().mockResolvedValue(undefined);

    const result = await checkPostgresHealth({
      probe: { ping },
    });

    expect(result.ok).toBe(true);
    expect(ping).toHaveBeenCalledOnce();
    expect(result.latencyMs).toBeTypeOf("number");
  });

  it("reports postgres failure when the probe throws", async () => {
    const result = await checkPostgresHealth({
      probe: {
        ping: async () => {
          throw new Error("connection refused");
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("connection refused");
  });

  it("skips redis when queue mode is memory and redis is not configured", async () => {
    const result = await checkRedisHealth({ required: false });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it("requires redis when queue mode is redis", async () => {
    const result = await checkRedisHealth({ required: true });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/REDIS_URL/i);
  });

  it("reports redis success from an injected probe", async () => {
    const result = await checkRedisHealth({
      required: true,
      probe: {
        ping: async () => "PONG",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBeUndefined();
  });

  it("aggregates infrastructure health from explicit overrides", async () => {
    const report = await checkInfrastructureHealth({
      databaseUrl: "postgresql://example",
      queueProvider: "memory",
      postgresProbe: {
        ping: async () => undefined,
      },
      redisProbe: {
        ping: async () => "PONG",
      },
    });

    expect(report.ok).toBe(true);
    expect(report.checks.postgres.ok).toBe(true);
    expect(report.checks.redis.skipped).toBe(true);
    expect(report.checks.ffmpeg.skipped).toBe(true);
  });

  it("skips ffmpeg when ASR is mock", async () => {
    const result = await checkFfmpegHealth({ required: false });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it("requires ffmpeg when ASR uses real paraformer", async () => {
    const result = await checkFfmpegHealth({
      required: true,
      probe: {
        version: async () => undefined,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBeUndefined();
  });

  it("reports ffmpeg failure from an injected probe", async () => {
    const result = await checkFfmpegHealth({
      required: true,
      probe: {
        version: async () => {
          throw new Error("ffmpeg not found");
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("ffmpeg not found");
  });

  it("marks infrastructure unhealthy when real paraformer ASR requires ffmpeg but it fails", async () => {
    const report = await checkInfrastructureHealth({
      databaseUrl: "postgresql://example",
      queueProvider: "memory",
      asrProvider: "paraformer",
      asrMode: "real",
      postgresProbe: {
        ping: async () => undefined,
      },
      ffmpegProbe: {
        version: async () => {
          throw new Error("ffmpeg not found");
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.checks.ffmpeg.ok).toBe(false);
    expect(report.checks.ffmpeg.message).toBe("ffmpeg not found");
  });

  it("marks infrastructure unhealthy when redis is required but fails", async () => {
    const report = await checkInfrastructureHealth({
      databaseUrl: "postgresql://example",
      queueProvider: "redis",
      redisUrl: "redis://127.0.0.1:6379",
      postgresProbe: {
        ping: async () => undefined,
      },
      redisProbe: {
        ping: async () => {
          throw new Error("redis unavailable");
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.checks.redis.ok).toBe(false);
    expect(report.checks.redis.message).toBe("redis unavailable");
  });
});
