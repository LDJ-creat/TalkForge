import { beforeEach, describe, expect, it, vi } from "vitest";

import { submitShadowingPracticeEvaluation } from "@/server/shadowing/submit-practice-evaluation";

const evaluateAndSaveShadowingAttempt = vi.fn();
const persistTurnPracticeAudio = vi.fn();
const createTurn = vi.fn();
const createAudioSegment = vi.fn();
const linkTurnAudioSegment = vi.fn();
const updateTurnEvaluationStatus = vi.fn();
const saveShadowingEvaluationForTurnIfAbsent = vi.fn();

vi.mock("@/server/shadowing/evaluate-shadowing", () => ({
  evaluateAndSaveShadowingAttempt: (...args: unknown[]) =>
    evaluateAndSaveShadowingAttempt(...args),
  ShadowingEvaluationError: class ShadowingEvaluationError extends Error {},
}));

vi.mock("@/server/shadowing/persist-practice-audio", () => ({
  persistTurnPracticeAudio: (...args: unknown[]) => persistTurnPracticeAudio(...args),
}));

vi.mock("@/server/db/repositories/turn-repository", () => ({
  createTurn: (...args: unknown[]) => createTurn(...args),
  linkTurnAudioSegment: (...args: unknown[]) => linkTurnAudioSegment(...args),
  updateTurnEvaluationStatus: (...args: unknown[]) => updateTurnEvaluationStatus(...args),
}));

vi.mock("@/server/db/repositories/audio-segment-repository", () => ({
  createAudioSegment: (...args: unknown[]) => createAudioSegment(...args),
}));

vi.mock("@/server/db/repositories/pronunciation-evaluation-repository", () => ({
  saveShadowingEvaluationForTurnIfAbsent: (...args: unknown[]) =>
    saveShadowingEvaluationForTurnIfAbsent(...args),
}));

describe("submitShadowingPracticeEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a practice turn, stores audio, and returns pronunciation feedback", async () => {
    createTurn.mockResolvedValue({
      id: "turn-practice-1",
      sessionId: "session-1",
      role: "user",
    });
    persistTurnPracticeAudio.mockResolvedValue({
      objectKey: "audio/session-1/turn-practice-1.webm",
      sizeBytes: 4096,
    });
    createAudioSegment.mockResolvedValue({
      id: "segment-1",
      objectKey: "audio/session-1/turn-practice-1.webm",
    });
    evaluateAndSaveShadowingAttempt.mockResolvedValue({
      evaluation: {
        id: "eval-1",
        turnId: "turn-practice-1",
        mode: "shadowing",
        overallScore: 90,
        accuracyScore: 88,
        completenessScore: 92,
        details: { words: [{ word: "latte", score: 70 }] },
      },
      created: true,
    });

    const db = {
      transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
    };

    const result = await submitShadowingPracticeEvaluation(
      {
        sessionId: "session-1",
        itemId: "shadowing-item-1",
        userId: "user-1",
        audioBody: Buffer.from("audio"),
        durationMs: 1200,
      },
      {
        db: db as never,
        pronunciationProvider: { name: "mock-pronunciation", evaluate: vi.fn() },
        getSessionById: async () => ({
          id: "session-1",
          userId: "user-1",
          status: "completed",
          scenarioId: "coffee_ordering_a2",
        }),
        getShadowingItemById: async () => ({
          id: "shadowing-item-1",
          sessionId: "session-1",
          standardText: "Could I get a medium latte?",
          source: "report_recommendation",
        }),
      },
    );

    expect(result.turnId).toBe("turn-practice-1");
    expect(result.feedback.evaluationStatus).toBe("done");
    expect(result.feedback.overallScore).toBe(90);
    expect(updateTurnEvaluationStatus).toHaveBeenCalledWith(db, "turn-practice-1", "done");
  });
});
