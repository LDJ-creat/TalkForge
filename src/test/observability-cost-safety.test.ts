import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { loadRuntimeConfig, resetRuntimeConfigForTests } from "@/server/config";
import { parseRuntimeConfigFromEnv } from "@/server/config/parse-env";
import {
  buildSessionUsageLimitsView,
  detectSessionLimitViolation,
  resolveEffectiveSessionLimits,
  sessionLimitViolationErrorCode,
} from "@/server/observability/session-limits";
import {
  classifyProviderErrorCode,
  classifySessionServiceErrorCode,
} from "@/server/observability/error-categories";
import {
  logProviderCall,
  resolveOperationalErrorCategory,
} from "@/server/observability/log";
import { mapProviderErrorToUserMessage } from "@/server/observability/user-messages";
import { isHealthDetailAuthorized } from "@/server/observability/health-detail-auth";
import { checkConfiguredProviderHealth } from "@/server/observability/provider-health";
import { resolveAsrJobsUsed } from "@/server/observability/resolve-asr-jobs-used";
import { resolveRealtimeTokenTtlSec } from "@/server/observability/realtime-token-ttl";
import { assertSessionWithinLimitsOrThrow } from "@/server/observability/enforce-session-limits";
import { SessionServiceError } from "@/server/session/errors";
describe("session usage limits", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
  });

  it("uses the tighter of scenario and configured caps", () => {
    const limits = resolveEffectiveSessionLimits(coffeeOrderingScenario.exitPolicy, {
      maxRealtimeDurationSec: 120,
      maxTurns: 4,
      maxAsrJobs: 10,
      maxReportGenerationAttempts: 3,
    });

    expect(limits.maxTurns).toBe(4);
    expect(limits.maxDurationSec).toBe(120);
    expect(limits.maxAsrJobs).toBe(10);
  });

  it("detects turn limit violations before creating another user turn", () => {
    const view = buildSessionUsageLimitsView({
      exitPolicy: coffeeOrderingScenario.exitPolicy,
      config: {
        maxRealtimeDurationSec: 0,
        maxTurns: 2,
        maxAsrJobs: 50,
        maxReportGenerationAttempts: 5,
      },
      usage: {
        userTurnCount: 2,
        durationSec: 10,
        asrJobsUsed: 0,
        reportAttemptsUsed: 0,
      },
    });

    expect(view.turnLimitReached).toBe(true);
    expect(
      detectSessionLimitViolation(
        {
          userTurnCount: view.userTurnCount,
          durationSec: view.durationSec,
          asrJobsUsed: view.asrJobsUsed,
          reportAttemptsUsed: view.reportAttemptsUsed,
        },
        {
          maxTurns: view.maxTurns,
          maxDurationSec: view.maxDurationSec,
          maxAsrJobs: view.maxAsrJobs,
          maxReportAttempts: view.maxReportAttempts,
        },
        { additionalUserTurns: 1 },
      ),
    ).toBe("turn_limit");
  });

  it("throws a session service error when limits are exceeded", () => {
    loadRuntimeConfig({
      NODE_ENV: "test",
      SESSION_MAX_TURNS: "1",
      SESSION_MAX_ASR_JOBS: "50",
      SESSION_MAX_REPORT_ATTEMPTS: "5",
    });

    expect(() =>
      assertSessionWithinLimitsOrThrow({
        scenario: coffeeOrderingScenario,
        session: {
          id: "session-1",
          startedAt: new Date().toISOString(),
        },
        turns: [
          {
            id: "turn-1",
            sessionId: "session-1",
            role: "user",
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            evaluationStatus: "pending",
          },
        ],
        pending: { additionalUserTurns: 1 },
      }),
    ).toThrow(SessionServiceError);

    try {
      assertSessionWithinLimitsOrThrow({
        scenario: coffeeOrderingScenario,
        session: {
          id: "session-1",
          startedAt: new Date().toISOString(),
        },
        turns: [
          {
            id: "turn-1",
            sessionId: "session-1",
            role: "user",
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            evaluationStatus: "pending",
          },
        ],
        pending: { additionalUserTurns: 1 },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SessionServiceError);
      expect((error as SessionServiceError).code).toBe(
        sessionLimitViolationErrorCode("turn_limit"),
      );
    }
  });
});

describe("provider observability helpers", () => {
  it("classifies provider and session errors for alerts", () => {
    expect(classifyProviderErrorCode("timeout")).toBe("provider_timeout");
    expect(classifySessionServiceErrorCode("session_asr_limit")).toBe(
      "session_usage_limit",
    );
    expect(
      resolveOperationalErrorCategory({
        providerErrorCode: "rate_limited",
      }),
    ).toBe("provider_rate_limit");
  });

  it("maps provider failures to user-safe messages", () => {
    expect(mapProviderErrorToUserMessage("provider_unavailable")).toContain(
      "temporarily unavailable",
    );
  });

  it("logs structured provider call metadata without secrets", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logProviderCall({
      provider: "qwen-omni",
      operation: "realtime.session.create",
      latencyMs: 120,
      status: "success",
      retryCount: 0,
      costEstimate: 0.002,
      sessionId: "session-1",
    });

    expect(info).toHaveBeenCalledOnce();
    const payload = String(info.mock.calls[0]?.[0]);
    expect(payload).toContain("qwen-omni");
    expect(payload).toContain("costEstimate");
    expect(payload).not.toContain("API_KEY");

    info.mockRestore();
  });
});

describe("provider health checks", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
  });

  it("reports healthy mock providers", async () => {
    loadRuntimeConfig({
      NODE_ENV: "test",
      REALTIME_PROVIDER: "mock",
      ASR_PROVIDER: "mock",
    });

    const report = await checkConfiguredProviderHealth();
    expect(report.ok).toBe(true);
    expect(report.providers.some((entry) => entry.provider === "mock-realtime")).toBe(
      true,
    );
  });

  it("tags configuration checks with checkKind", async () => {
    loadRuntimeConfig({
      NODE_ENV: "test",
      REALTIME_PROVIDER: "mock",
    });

    const report = await checkConfiguredProviderHealth();
    expect(report.providers.every((entry) => entry.checkKind === "configuration")).toBe(
      true,
    );
  });

  it("flags missing realtime credentials for real providers", async () => {
    const report = await checkConfiguredProviderHealth(
      parseRuntimeConfigFromEnv({
        NODE_ENV: "test",
        REALTIME_PROVIDER: "qwen-omni",
      }),
    );
    expect(report.ok).toBe(false);
    expect(report.providers.some((entry) => entry.provider === "qwen-omni" && !entry.ok)).toBe(
      true,
    );
  });
});

describe("ASR usage counting", () => {
  it("uses the higher of turn-linked audio and invocation logs", () => {
    expect(
      resolveAsrJobsUsed({
        turns: [
          {
            id: "turn-1",
            sessionId: "session-1",
            role: "user",
            audioSegmentId: "audio-1",
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            evaluationStatus: "pending",
          },
        ],
        asrInvocationCount: 3,
      }),
    ).toBe(3);
  });
});

describe("realtime token ttl", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
  });

  it("caps token ttl by remaining session duration", () => {
    loadRuntimeConfig({
      NODE_ENV: "test",
      SESSION_MAX_REALTIME_DURATION_SEC: "120",
    });

    const startedAt = new Date("2026-06-06T00:00:00.000Z").toISOString();
    const ttl = resolveRealtimeTokenTtlSec({
      session: { startedAt },
      scenario: coffeeOrderingScenario,
      configuredTokenTtlSec: 600,
      now: new Date("2026-06-06T00:01:40.000Z"),
    });

    expect(ttl).toBe(20);
  });
});

describe("GET /api/health detail mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    resetRuntimeConfigForTests();
  });

  it("returns provider and observability sections when detail=1", async () => {
    vi.doMock("@/server/infrastructure", () => ({
      checkInfrastructureHealth: vi.fn(async () => ({
        ok: true,
        checks: {
          postgres: { ok: true, latencyMs: 1 },
          redis: { ok: true, skipped: true },
          ffmpeg: { ok: true, skipped: true },
        },
      })),
    }));

    vi.doMock("@/server/db/client", () => ({
      getDb: () => {
        throw new Error("database unavailable in test");
      },
    }));

    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://localhost/api/health?detail=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.infrastructure.checks.postgres.ok).toBe(true);
    expect(body.providers).toBeDefined();
    expect(body.aiInvocations.totalCalls).toBe(0);
  });

  it("requires authorization in production", () => {
    loadRuntimeConfig({
      NODE_ENV: "production",
      OPS_HEALTH_DETAIL_TOKEN: "ops-secret",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5434/talkforge",
      STORAGE_SIGNING_SECRET: "talkforge-test-storage-secret",
    });

    expect(isHealthDetailAuthorized(new Request("http://localhost/api/health?detail=1"))).toBe(
      false,
    );
    expect(
      isHealthDetailAuthorized(
        new Request("http://localhost/api/health?detail=1", {
          headers: {
            Authorization: "Bearer ops-secret",
          },
        }),
      ),
    ).toBe(true);
  });
});
