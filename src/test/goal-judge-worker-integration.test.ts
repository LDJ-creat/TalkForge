import { afterEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/domain/session";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import { createOpenAiCompatibleTextLlmProvider } from "@/providers/openai-compatible-text-llm";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { evaluateSessionProgress } from "@/server/scenario-progress/evaluate-session-progress";

const originalFetch = global.fetch;

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";

const baseSession: Session = {
  id: SESSION_ID,
  userId: "user-1",
  scenarioId: coffeeOrderingScenario.id,
  realtimeProvider: "mock-realtime",
  status: "active",
  startedAt: "2026-06-06T00:00:00.000Z",
};

const baseTurn: Turn = {
  id: TURN_ID,
  sessionId: SESSION_ID,
  role: "user",
  startedAt: "2026-06-06T00:00:05.000Z",
  endedAt: "2026-06-06T00:00:10.000Z",
  evaluationStatus: "pending",
};

const baseTranscript: Transcript = {
  id: "transcript-1",
  turnId: TURN_ID,
  provider: "mock-asr",
  text: "Could I get a medium latte with oat milk? Yes, that's correct.",
  confidence: 0.95,
  segments: [],
  createdAt: "2026-06-06T00:00:10.000Z",
};

describe("goal judge worker integration", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("persists scenario progress from real-shaped judge output", async () => {
    global.fetch = vi.fn(async () =>
      Response.json({
        model: "gpt-4o-mini",
        choices: [
          {
            message: {
              content: JSON.stringify({
                completedGoalIds: [
                  "choose_drink",
                  "choose_size",
                  "customize_order",
                  "confirm_payment",
                ],
                missingGoalIds: [],
                currentStageId: "closing",
                offTopic: false,
                shouldSuggestEnding: true,
              }),
            },
          },
        ],
      }),
    ) as typeof fetch;

    const provider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "test-key",
    });

    let storedProgress = null;

    const result = await evaluateSessionProgress(
      { sessionId: SESSION_ID, triggerTurnId: TURN_ID },
      {
        goalJudgeProvider: provider,
        getSessionById: async () => baseSession,
        getScenarioById: async () => coffeeOrderingScenario,
        listTurnsBySessionId: async () => [baseTurn],
        getTranscriptsByTurnIds: async () => new Map([[TURN_ID, baseTranscript]]),
        getScenarioProgressBySessionId: async () => storedProgress,
        upsertScenarioProgress: async (_sessionId, progress) => {
          storedProgress = progress;
          return progress;
        },
      },
      { attempts: 1 },
    );

    expect(result.progress.completedGoalIds).toEqual(
      expect.arrayContaining([
        "choose_drink",
        "choose_size",
        "customize_order",
        "confirm_payment",
      ]),
    );
    expect(result.progress.shouldSuggestEnding).toBe(true);
    expect(result.progress.offTopic).toBe(false);
    expect(baseSession.status).toBe("active");
  });
});
