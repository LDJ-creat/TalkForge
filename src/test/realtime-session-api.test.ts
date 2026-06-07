import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as createSessionRoute } from "@/app/api/sessions/route";
import { createMockRealtimeProvider } from "@/providers/mock/realtime";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { DEV_USER_ID } from "@/shared/dev-user";

const { SESSION_ID, activeSession, getRealtimeProviderMock } = vi.hoisted(() => {
  const id = "11111111-1111-4111-8111-111111111111";
  return {
    SESSION_ID: id,
    activeSession: {
      id,
      userId: "99999999-9999-4999-8999-999999999999",
      scenarioId: "coffee_ordering_a2",
      realtimeProvider: "mock-realtime",
      status: "active" as const,
      startedAt: "2026-06-06T00:00:00.000Z",
    },
    getRealtimeProviderMock: vi.fn(),
  };
});

vi.mock("@/server/db/seeds/ensure-dev-session-prerequisites", () => ({
  ensureDevSessionPrerequisites: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/server/db/repositories", () => ({
  createSession: vi.fn().mockResolvedValue(activeSession),
  getScenarioById: vi.fn().mockImplementation(async () => {
    const { coffeeOrderingScenario: scenario } = await import(
      "@/server/db/seeds/scenarios"
    );
    return scenario;
  }),
  updateSessionRealtimeProviderSessionId: vi
    .fn()
    .mockImplementation((_db, _sessionId, providerSessionId) =>
      Promise.resolve({
        ...activeSession,
        realtimeProviderSessionId: providerSessionId,
      }),
    ),
  failSession: vi.fn(),
}));

vi.mock("@/server/ai-tracing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/ai-tracing")>();
  return {
    ...actual,
    createAiInvocationTraceService: vi.fn(() => ({
      record: vi.fn().mockResolvedValue(null),
    })),
  };
});

vi.mock("@/server/realtime/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/realtime/provider")>();
  return {
    ...actual,
    getRealtimeProvider: (...args: unknown[]) => getRealtimeProviderMock(...args),
  };
});

describe("POST /api/sessions realtime integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRealtimeProviderMock.mockReturnValue(createMockRealtimeProvider());
  });

  it("returns short-lived mock credentials when mock provider is configured", async () => {
    const response = await createSessionRoute(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [REQUEST_USER_ID_HEADER]: DEV_USER_ID,
        },
        body: JSON.stringify({ scenarioId: coffeeOrderingScenario.id }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.session.id).toBe(SESSION_ID);
    expect(body.realtimeCredentials.provider).toBe("mock-realtime");
    expect(body.realtimeCredentials.token).toMatch(/^rt_token_/);
    expect(body.realtimeCredentials.connectionMode).toBe("websocket");
    expect(getRealtimeProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        traceWriter: expect.objectContaining({
          record: expect.any(Function),
        }),
      }),
    );
  });

  it("returns 503 when the configured realtime provider fails to start", async () => {
    getRealtimeProviderMock.mockReturnValue(
      createMockRealtimeProvider({ failOnCreate: true }),
    );

    const response = await createSessionRoute(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [REQUEST_USER_ID_HEADER]: DEV_USER_ID,
        },
        body: JSON.stringify({ scenarioId: coffeeOrderingScenario.id }),
      }),
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("realtime_unavailable");
  });
});
