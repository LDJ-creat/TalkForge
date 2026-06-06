import { describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import type { ScenarioProgress } from "@/domain/scenario-progress";
import type { Session } from "@/domain/session";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import { createMockGoalJudgeProvider } from "@/providers/mock/goal-judge";
import { evaluateSessionProgress } from "@/server/scenario-progress/evaluate-session-progress";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";

const activeSession: Session = {
  id: SESSION_ID,
  userId: "user-1",
  scenarioId: coffeeOrderingScenario.id,
  realtimeProvider: "mock-realtime",
  status: "active",
  startedAt: "2026-06-06T00:00:00.000Z",
};

const userTurn: Turn = {
  id: TURN_ID,
  sessionId: SESSION_ID,
  role: "user",
  startedAt: "2026-06-06T00:00:05.000Z",
  endedAt: "2026-06-06T00:00:10.000Z",
  evaluationStatus: "pending",
};

const userTranscript: Transcript = {
  id: "transcript-1",
  turnId: TURN_ID,
  provider: "mock-asr",
  text: "Could I get a medium latte with oat milk? Yes, that's correct.",
  confidence: 0.95,
  segments: [],
  createdAt: "2026-06-06T00:00:10.000Z",
};

function createEvaluateDeps(options?: {
  session?: Session;
  storedProgress?: ScenarioProgress | null;
  goalJudgeProvider?: ReturnType<typeof createMockGoalJudgeProvider>;
}) {
  let storedProgress = options?.storedProgress ?? null;
  const goalJudgeProvider = options?.goalJudgeProvider ?? createMockGoalJudgeProvider();

  return {
    goalJudgeProvider,
    getSessionById: async () => options?.session ?? activeSession,
    getScenarioById: async () => coffeeOrderingScenario,
    listTurnsBySessionId: async () => [userTurn],
    getTranscriptsByTurnIds: async () => new Map([[TURN_ID, userTranscript]]),
    getScenarioProgressBySessionId: async () => storedProgress,
    upsertScenarioProgress: async (_sessionId: string, progress: ScenarioProgress) => {
      storedProgress = progress;
      return progress;
    },
    getStoredProgress: () => storedProgress,
  };
}

describe("scenario progress evaluate worker logic", () => {
  it("updates progress from mock goal judge output", async () => {
    const deps = createEvaluateDeps();

    const result = await evaluateSessionProgress(
      { sessionId: SESSION_ID, triggerTurnId: TURN_ID },
      deps,
      { attempts: 1 },
    );

    expect(result.created).toBe(true);
    expect(result.progress.completedGoalIds).toEqual(
      expect.arrayContaining([
        "choose_drink",
        "choose_size",
        "customize_order",
        "confirm_payment",
      ]),
    );
    expect(result.progress.missingGoalIds).toEqual([]);
    expect(result.progress.shouldSuggestEnding).toBe(true);
    expect(deps.getStoredProgress()?.shouldSuggestEnding).toBe(true);
  });

  it("evaluates progress for completed sessions when transcripts arrive late", async () => {
    const deps = createEvaluateDeps({
      session: {
        ...activeSession,
        status: "completed",
        endedAt: "2026-06-06T00:10:00.000Z",
      },
    });

    const result = await evaluateSessionProgress(
      { sessionId: SESSION_ID, triggerTurnId: TURN_ID },
      deps,
      { attempts: 1 },
    );

    expect(result.progress.completedGoalIds).toEqual(
      expect.arrayContaining(["choose_drink", "confirm_payment"]),
    );
    expect(result.progress.shouldSuggestEnding).toBe(true);
  });

  it("preserves previously completed goals when judge returns incremental ids", async () => {
    const goalJudgeProvider = createMockGoalJudgeProvider();
    const evaluateGoals = vi.spyOn(goalJudgeProvider, "evaluateGoals");
    evaluateGoals.mockResolvedValueOnce({
      provider: goalJudgeProvider.name,
      completedGoalIds: ["confirm_payment"],
      offTopic: false,
    });

    const deps = createEvaluateDeps({
      storedProgress: {
        sessionId: SESSION_ID,
        currentStageId: "customization",
        completedGoalIds: ["choose_drink", "choose_size", "customize_order"],
        missingGoalIds: ["confirm_payment"],
        shouldSuggestEnding: false,
        offTopic: false,
        updatedAt: "2026-06-06T00:05:00.000Z",
      },
      goalJudgeProvider,
    });

    const result = await evaluateSessionProgress(
      { sessionId: SESSION_ID, triggerTurnId: TURN_ID },
      deps,
      { attempts: 1 },
    );

    expect(result.created).toBe(false);
    expect(result.progress.completedGoalIds).toEqual(
      expect.arrayContaining([
        "choose_drink",
        "choose_size",
        "customize_order",
        "confirm_payment",
      ]),
    );
  });
});
