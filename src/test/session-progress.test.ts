import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/domain/session";
import { GET as getSessionProgressRoute } from "@/app/api/sessions/[sessionId]/progress/route";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { fetchSessionProgressForUser } from "@/server/scenario-progress/fetch-session-progress";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "99999999-9999-4999-8999-999999999999";

const activeSession: Session = {
  id: SESSION_ID,
  userId: USER_ID,
  scenarioId: coffeeOrderingScenario.id,
  realtimeProvider: "mock-realtime",
  status: "active",
  startedAt: "2026-06-06T00:00:00.000Z",
};

const getSessionById = vi.fn();
const getScenarioById = vi.fn();
const listTurnsBySessionId = vi.fn();
const getScenarioProgressBySessionId = vi.fn();

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

const countReportGenerationAttemptsForSession = vi.fn();
const countAsrTranscribeAttemptsForSession = vi.fn();

vi.mock("@/server/db/repositories/ai-invocation-metrics-repository", () => ({
  countReportGenerationAttemptsForSession: (...args: unknown[]) =>
    countReportGenerationAttemptsForSession(...args),
  countAsrTranscribeAttemptsForSession: (...args: unknown[]) =>
    countAsrTranscribeAttemptsForSession(...args),
}));

vi.mock("@/server/db/repositories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db/repositories")>();
  return {
    ...actual,
    getSessionById: (...args: unknown[]) => getSessionById(...args),
    getScenarioById: (...args: unknown[]) => getScenarioById(...args),
    listTurnsBySessionId: (...args: unknown[]) => listTurnsBySessionId(...args),
    getScenarioProgressBySessionId: (...args: unknown[]) =>
      getScenarioProgressBySessionId(...args),
  };
});

describe("session progress API and service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionById.mockResolvedValue(activeSession);
    getScenarioById.mockResolvedValue(coffeeOrderingScenario);
    listTurnsBySessionId.mockResolvedValue([]);
    getScenarioProgressBySessionId.mockResolvedValue(null);
    countReportGenerationAttemptsForSession.mockResolvedValue(0);
    countAsrTranscribeAttemptsForSession.mockResolvedValue(0);
  });

  it("recomputes shouldSuggestEnding from live turns and stored progress", async () => {
    getSessionById.mockResolvedValue({
      ...activeSession,
      startedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    getScenarioProgressBySessionId.mockResolvedValue({
      sessionId: SESSION_ID,
      currentStageId: "closing",
      completedGoalIds: coffeeOrderingScenario.exitPolicy.requiredGoals,
      missingGoalIds: [],
      shouldSuggestEnding: false,
      offTopic: false,
      updatedAt: "2026-06-06T00:05:00.000Z",
    });

    const progress = await fetchSessionProgressForUser(SESSION_ID, USER_ID, {
      getSessionById,
      getScenarioById,
      listTurnsBySessionId,
      getScenarioProgressBySessionId,
    });

    expect(progress.shouldSuggestEnding).toBe(true);
    expect(progress.endingSuggestionReason).toBe("required_goals_complete");
    expect(progress.usageLimits.maxTurns).toBe(coffeeOrderingScenario.exitPolicy.maxTurns);
  });

  it("returns max turn boundary through the progress API route", async () => {
    listTurnsBySessionId.mockResolvedValue(
      Array.from({ length: coffeeOrderingScenario.exitPolicy.maxTurns }, (_, index) => ({
        id: `turn-${index}`,
        sessionId: SESSION_ID,
        role: "user",
        startedAt: "2026-06-06T00:00:00.000Z",
        endedAt: "2026-06-06T00:00:05.000Z",
        evaluationStatus: "pending",
      })),
    );

    const request = new Request(`http://localhost/api/sessions/${SESSION_ID}/progress`, {
      headers: {
        [REQUEST_USER_ID_HEADER]: USER_ID,
      },
    });

    const response = await getSessionProgressRoute(request, {
      params: Promise.resolve({ sessionId: SESSION_ID }),
    });
    const body = (await response.json()) as {
      progress: { shouldSuggestEnding: boolean; endingSuggestionReason: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.progress.shouldSuggestEnding).toBe(true);
    expect(body.progress.endingSuggestionReason).toBe("max_turns_reached");
  });
});
