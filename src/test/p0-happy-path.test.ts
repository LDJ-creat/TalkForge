import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { POST as createSessionRoute } from "@/app/api/sessions/route";
import { POST as createTurnRoute } from "@/app/api/sessions/[sessionId]/turns/route";
import type { Session } from "@/domain/session";
import type { Turn } from "@/domain/turn";
import { createMemoryQueueAdapter, typedEnqueue } from "@/queue";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { createMockRealtimeProvider } from "@/providers/mock/realtime";
import { createMockProviderBundle } from "@/providers/mock";
import {
  completeSessionForUser,
  createCompleteSessionDeps,
  createTurnForUser,
  startSessionForUser,
} from "@/server/session";
import { fetchSessionReportForUser } from "@/server/report";
import { REPORT_GENERATING_MARKER } from "@/server/report/constants";
import { createReportGenerateHandler } from "@/workers/handlers/report-generate";
import {
  createWorkerRegistry,
  createWorkerRuntime,
  registerP0WorkerHandlers,
} from "@/workers";
import { DEV_USER_ID } from "@/shared/dev-user";
import { startSessionOnServer } from "@/features/conversation/start-session-api";
import { resetDevWorkerStateForTests } from "@/server/queue/dev-worker";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";

const activeSession: Session = {
  id: SESSION_ID,
  userId: DEV_USER_ID,
  scenarioId: coffeeOrderingScenario.id,
  realtimeProvider: "mock-realtime",
  status: "active",
  startedAt: "2026-06-06T00:00:00.000Z",
};

const createSession = vi.fn();
const getScenarioById = vi.fn();
const updateSessionRealtimeProviderSessionId = vi.fn();
const getSessionById = vi.fn();
const completeSession = vi.fn();
const createTurn = vi.fn();
const getReportBySessionId = vi.fn();

vi.mock("@/server/db/seeds/ensure-dev-session-prerequisites", () => ({
  ensureDevSessionPrerequisites: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

const failSession = vi.fn();

vi.mock("@/server/db/repositories/scenario-session-repository", () => ({
  createSession: (...args: unknown[]) => createSession(...args),
  getScenarioById: (...args: unknown[]) => getScenarioById(...args),
  updateSessionRealtimeProviderSessionId: (...args: unknown[]) =>
    updateSessionRealtimeProviderSessionId(...args),
  getSessionById: (...args: unknown[]) => getSessionById(...args),
  completeSession: (...args: unknown[]) => completeSession(...args),
  failSession: (...args: unknown[]) => failSession(...args),
  upsertScenario: vi.fn(),
  listScenarios: vi.fn(),
}));

vi.mock("@/server/db/repositories/turn-repository", () => ({
  createTurn: (...args: unknown[]) => createTurn(...args),
  getTurnById: vi.fn(),
  listTurnsBySessionId: vi.fn(),
}));

vi.mock("@/server/db/repositories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db/repositories")>();
  return {
    ...actual,
    createSession: (...args: unknown[]) => createSession(...args),
    getScenarioById: (...args: unknown[]) => getScenarioById(...args),
    updateSessionRealtimeProviderSessionId: (...args: unknown[]) =>
      updateSessionRealtimeProviderSessionId(...args),
    getSessionById: (...args: unknown[]) => getSessionById(...args),
    completeSession: (...args: unknown[]) => completeSession(...args),
    failSession: (...args: unknown[]) => failSession(...args),
    createTurn: (...args: unknown[]) => createTurn(...args),
    getReportBySessionId: (...args: unknown[]) => getReportBySessionId(...args),
  };
});

vi.mock("@/server/realtime/provider", () => ({
  getRealtimeProvider: () => createMockRealtimeProvider(),
}));

describe("P0 mock happy path services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getScenarioById.mockResolvedValue(coffeeOrderingScenario);
    createSession.mockResolvedValue(activeSession);
    updateSessionRealtimeProviderSessionId.mockResolvedValue({
      ...activeSession,
      realtimeProviderSessionId: "rt_session_test",
    });
  });

  it("starts a session with mock realtime credentials", async () => {
    const result = await startSessionForUser(DEV_USER_ID, coffeeOrderingScenario.id, {
      getScenarioById,
      createSession,
      updateRealtimeProviderSessionId: updateSessionRealtimeProviderSessionId,
      realtimeProvider: createMockRealtimeProvider(),
    });

    expect(result.session.id).toBe(SESSION_ID);
    expect(result.realtimeCredentials.provider).toBe("mock-realtime");
    expect(result.realtimeCredentials.token).toBeTruthy();
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: DEV_USER_ID,
        scenarioId: coffeeOrderingScenario.id,
      }),
    );
  });

  it("marks the session failed when realtime startup fails", async () => {
    failSession.mockResolvedValue({
      ...activeSession,
      status: "failed",
      endedAt: "2026-06-06T00:01:00.000Z",
    });

    await expect(
      startSessionForUser(DEV_USER_ID, coffeeOrderingScenario.id, {
        getScenarioById,
        createSession,
        updateRealtimeProviderSessionId: updateSessionRealtimeProviderSessionId,
        failSession,
        realtimeProvider: createMockRealtimeProvider({ failOnCreate: true }),
      }),
    ).rejects.toMatchObject({ code: "realtime_unavailable" });

    expect(failSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it("creates a user turn for an active session", async () => {
    getSessionById.mockResolvedValue(activeSession);
    createTurn.mockResolvedValue({
      id: TURN_ID,
      sessionId: SESSION_ID,
      role: "user",
      startedAt: "2026-06-06T00:00:05.000Z",
      endedAt: "2026-06-06T00:00:10.000Z",
      evaluationStatus: "pending",
    } satisfies Turn);

    const turn = await createTurnForUser(
      SESSION_ID,
      DEV_USER_ID,
      { role: "user", transcriptText: "Could I get a medium latte?" },
      { getSessionById, createTurn },
    );

    expect(turn.id).toBe(TURN_ID);
    expect(createTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        role: "user",
        evaluationStatus: "pending",
      }),
    );
  });

  it("completes a session and processes a report job through P0 workers", async () => {
    const completedSession: Session = {
      ...activeSession,
      status: "completed",
      endedAt: "2026-06-06T00:10:00.000Z",
    };

    getSessionById.mockResolvedValue(activeSession);
    completeSession.mockResolvedValue(completedSession);

    const adapter = createMemoryQueueAdapter();
    const result = await completeSessionForUser(
      SESSION_ID,
      DEV_USER_ID,
      createCompleteSessionDeps(getSessionById, completeSession, adapter),
    );

    expect(result.reportJobEnqueued).toBe(true);

    const mocks = createMockProviderBundle();
    const registry = createWorkerRegistry();
    registerP0WorkerHandlers(registry, {
      db: {} as never,
      queueAdapter: adapter,
      llmReportProvider: mocks.llmReport,
    });

    registry.handlers.reportGenerate(
      createReportGenerateHandler({
        db: {} as never,
        deps: {
          llmProvider: mocks.llmReport,
          getSessionById: async () => completedSession,
          getScenarioById: async () => coffeeOrderingScenario,
          getScenarioProgressBySessionId: async () => null,
          listTurnsBySessionId: async () => [],
          getTranscriptsByTurnIds: async () => new Map(),
          getCorrectionsByTurnIds: async () => new Map(),
          getFreeSpeechEvaluationsByTurnIds: async () => new Map(),
          prepareReportGeneration: async () => ({
            status: "claimed",
            report: {
              id: "report-1",
              sessionId: SESSION_ID,
              summary: REPORT_GENERATING_MARKER,
              taskCompletion: { completedGoalIds: [], missingGoalIds: [] },
              keyCorrections: [],
              alternativeExpressions: [],
              shadowingRecommendations: [],
              nextPracticeSuggestion: "",
              createdAt: "2026-06-06T00:11:00.000Z",
            },
          }),
          finalizeReport: async (_sessionId, input) => ({
            id: "report-1",
            createdAt: "2026-06-06T00:11:00.000Z",
            ...input,
          }),
        },
      }),
    );

    const runtime = createWorkerRuntime({ adapter, registry });
    const processed = runtime.mode === "memory" ? await runtime.processAll() : [];

    expect(processed).toHaveLength(1);
    expect(processed[0]?.status).toBe("succeeded");

    getSessionById.mockResolvedValue(completedSession);
    getReportBySessionId.mockResolvedValue({
      id: "report-1",
      sessionId: SESSION_ID,
      summary: "Great job ordering coffee today.",
      taskCompletion: {
        completedGoalIds: ["choose_drink"],
        missingGoalIds: ["choose_size"],
      },
      keyCorrections: [],
      alternativeExpressions: [],
      shadowingRecommendations: [],
      nextPracticeSuggestion: "Try adding a customization next time.",
      createdAt: "2026-06-06T00:11:00.000Z",
    });

    const report = await fetchSessionReportForUser(SESSION_ID, DEV_USER_ID, {
      getSessionById,
      getReportBySessionId,
    });

    expect(report.summary).toContain("coffee");
  });

  it("processes queued jobs without throwing when a handler fails", async () => {
    resetDevWorkerStateForTests();
    const adapter = createMemoryQueueAdapter();
    const registry = createWorkerRegistry();
    registry.handlers.reportGenerate(async () => {
      throw new Error("simulated worker failure");
    });
    adapter.registerWorkerRegistry(registry);

    await typedEnqueue.reportGenerate(adapter, { sessionId: SESSION_ID });

    await expect(adapter.processAll()).resolves.toHaveLength(1);
  });
});

describe("startSessionOnServer fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when the backend responds with 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await expect(startSessionOnServer(coffeeOrderingScenario.id, DEV_USER_ID)).resolves.toBeNull();
  });
});

describe("P0 mock happy path API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getScenarioById.mockResolvedValue(coffeeOrderingScenario);
    createSession.mockResolvedValue(activeSession);
    updateSessionRealtimeProviderSessionId.mockResolvedValue(activeSession);
  });

  it("creates a session through POST /api/sessions", async () => {
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
  });

  it("creates a turn through POST /api/sessions/:id/turns", async () => {
    getSessionById.mockResolvedValue(activeSession);
    createTurn.mockResolvedValue({
      id: TURN_ID,
      sessionId: SESSION_ID,
      role: "user",
      startedAt: "2026-06-06T00:00:05.000Z",
      endedAt: "2026-06-06T00:00:10.000Z",
      evaluationStatus: "pending",
    });

    const response = await createTurnRoute(
      new Request(`http://localhost/api/sessions/${SESSION_ID}/turns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [REQUEST_USER_ID_HEADER]: DEV_USER_ID,
        },
        body: JSON.stringify({
          role: "user",
          transcriptText: "Could I get a medium latte?",
        }),
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.turn.id).toBe(TURN_ID);
  });
});
