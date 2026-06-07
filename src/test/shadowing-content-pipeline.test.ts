import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Correction } from "@/domain/correction";
import type { Report } from "@/domain/report";
import type { Scenario } from "@/domain/scenario";
import type { Session } from "@/domain/session";
import type { ShadowingItem } from "@/domain/shadowing";
import { GET as getShadowingRoute } from "@/app/api/sessions/[sessionId]/shadowing/route";
import { createMockTtsProvider } from "@/providers";
import { createMemoryQueueAdapter, typedEnqueue } from "@/queue";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import type { PrepareShadowingGenerationResult } from "@/server/db/repositories/shadowing-item-repository";
import {
  generateSessionShadowingContent,
  type GenerateSessionShadowingDeps,
} from "@/server/shadowing/generate-session-shadowing";
import {
  createDbShadowingGenerateDeps,
  createShadowingGenerateHandler,
} from "@/workers/handlers/shadowing-generate";
import {
  createWorkerRegistry,
  createWorkerRuntime,
  registerP0WorkerHandlers,
} from "@/workers";

const getSessionById = vi.fn();
const listShadowingItemsBySessionId = vi.fn();

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/server/db/repositories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db/repositories")>();
  return {
    ...actual,
    getSessionById: (...args: unknown[]) => getSessionById(...args),
    listShadowingItemsBySessionId: (...args: unknown[]) =>
      listShadowingItemsBySessionId(...args),
  };
});

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "99999999-9999-4999-8999-999999999999";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const REPORT_ID = "88888888-8888-4888-8888-888888888888";

const completedSession: Session = {
  id: SESSION_ID,
  userId: USER_ID,
  scenarioId: coffeeOrderingScenario.id,
  realtimeProvider: "mock-realtime",
  status: "completed",
  startedAt: "2026-06-06T00:00:00.000Z",
  endedAt: "2026-06-06T00:10:00.000Z",
};

const report: Report = {
  id: REPORT_ID,
  sessionId: SESSION_ID,
  summary: "Good practice session.",
  taskCompletion: {
    completedGoalIds: ["choose_drink"],
    missingGoalIds: [],
  },
  keyCorrections: [],
  alternativeExpressions: [],
  shadowingRecommendations: [
    {
      text: "Could I get a medium latte?",
      reason: "Practice this corrected phrase.",
    },
  ],
  nextPracticeSuggestion: "Retry the scenario.",
  createdAt: "2026-06-06T00:11:00.000Z",
};

const grammarCorrection: Correction = {
  id: "55555555-5555-4555-8555-555555555555",
  turnId: TURN_ID,
  type: "grammar",
  originalText: "I want coffee",
  correctedText: "Could I get a medium latte?",
  explanation: "Use a more natural ordering phrase.",
  confidence: 0.91,
};

function createDeps(
  overrides: Partial<GenerateSessionShadowingDeps> = {},
): GenerateSessionShadowingDeps {
  const storedItems: ShadowingItem[] = [];

  return {
    ttsProvider: createMockTtsProvider(),
    getSessionById: async () => completedSession,
    getScenarioById: async () => coffeeOrderingScenario as Scenario,
    getReportBySessionId: async () => report,
    listTurnsBySessionId: async () => [{ id: TURN_ID }],
    getCorrectionsByTurnIds: async () =>
      new Map([[TURN_ID, [grammarCorrection]]]),
    prepareShadowingGeneration: async (): Promise<PrepareShadowingGenerationResult> => ({
      status: "claimed",
    }),
    replaceShadowingItemsForSession: async ({ items }) => {
      storedItems.splice(
        0,
        storedItems.length,
        ...items.map((item, index) => ({
          id: `shadowing-item-${index}`,
          sessionId: item.sessionId,
          standardText: item.standardText,
          originalText: item.originalText,
          reason: item.reason,
          source: item.source,
          turnId: item.turnId,
          sortOrder: item.sortOrder,
          standardAudioStatus: item.standardAudioStatus,
        })),
      );
      return [...storedItems];
    },
    updateShadowingItemStandardAudio: async (itemId, input) => {
      const index = storedItems.findIndex((item) => item.id === itemId);
      if (index === -1) {
        return null;
      }

      storedItems[index] = {
        ...storedItems[index]!,
        standardAudio: input.standardAudio,
        standardAudioStatus: input.standardAudioStatus,
      };

      return storedItems[index]!;
    },
    ...overrides,
  };
}

describe("generateSessionShadowingContent", () => {
  beforeEach(() => {
    getSessionById.mockReset();
    listShadowingItemsBySessionId.mockReset();
  });

  it("creates shadowing items with standard audio metadata from report and corrections", async () => {
    const result = await generateSessionShadowingContent(
      { sessionId: SESSION_ID },
      createDeps(),
      { attempts: 1 },
    );

    expect(result.created).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({
      standardText: "Could I get a medium latte?",
      originalText: "I want coffee",
      standardAudioStatus: "ready",
    });
    expect(result.items[0]?.standardAudio?.objectKey).toContain("tts/");
  });

  it("returns existing items without regenerating when already prepared", async () => {
    const existing: ShadowingItem[] = [
      {
        id: "existing-item",
        sessionId: SESSION_ID,
        standardText: "Could I get a medium latte?",
        source: "report_recommendation",
        standardAudioStatus: "ready",
      },
    ];

    const result = await generateSessionShadowingContent(
      { sessionId: SESSION_ID },
      createDeps({
        prepareShadowingGeneration: async () => ({
          status: "complete",
          items: existing,
        }),
      }),
      { attempts: 1 },
    );

    expect(result.created).toBe(false);
    expect(result.items).toEqual(existing);
  });
});

describe("shadowing.generate worker", () => {
  it("processes queued jobs through the registered worker runtime", async () => {
    const registry = createWorkerRegistry();
    const ttsProvider = createMockTtsProvider();

    registry.handlers.shadowingGenerate(
      createShadowingGenerateHandler({
        db: {} as never,
        ttsProvider,
        deps: createDeps({ ttsProvider }),
      }),
    );

    const adapter = createMemoryQueueAdapter({ registry });
    const runtime = createWorkerRuntime({ adapter, registry });

    await typedEnqueue.shadowingGenerate(adapter, { sessionId: SESSION_ID });

    const snapshot =
      runtime.mode === "memory" ? await runtime.processNext() : null;

    expect(snapshot?.status).toBe("succeeded");
  });

  it("registers shadowing.generate in the P0 worker bundle", () => {
    const registry = createWorkerRegistry();
    registerP0WorkerHandlers(registry, { db: {} as never });

    expect(registry.listRegisteredJobs()).toContain("shadowing.generate");
  });
});

describe("GET /api/sessions/:sessionId/shadowing", () => {
  it("returns shadowing items for the session owner", async () => {
    getSessionById.mockResolvedValue(completedSession);
    listShadowingItemsBySessionId.mockResolvedValue([
      {
        id: "shadowing-item-0",
        sessionId: SESSION_ID,
        standardText: "Could I get a medium latte?",
        originalText: "I want coffee",
        source: "report_recommendation",
        turnId: TURN_ID,
        sortOrder: 0,
        standardAudioStatus: "ready",
        standardAudio: {
          provider: "mock-tts",
          objectKey: "tts/abc123.wav",
          format: "wav",
          sizeBytes: 4096,
          voice: "en-us-neutral",
          speed: 1,
          language: "en",
          cacheKey: "cache-key",
        },
      },
    ]);

    const response = await getShadowingRoute(
      new Request("http://localhost/api/sessions/test/shadowing", {
        headers: {
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: ShadowingItem[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.standardText).toBe("Could I get a medium latte?");
    expect(body.items[0]?.originalText).toBe("I want coffee");
  });
});

describe("createDbShadowingGenerateDeps", () => {
  it("wires repository helpers to the database client", () => {
    const deps = createDbShadowingGenerateDeps({
      db: {} as never,
      ttsProvider: createMockTtsProvider(),
    });

    expect(deps.getSessionById).toBeTypeOf("function");
    expect(deps.prepareShadowingGeneration).toBeTypeOf("function");
  });
});
