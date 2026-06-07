import { describe, expect, it } from "vitest";

import {
  buildPronunciationWordFeedback,
  buildTurnPronunciationFeedback,
} from "@/domain/pronunciation-feedback";

describe("pronunciation feedback mapping", () => {
  it("marks low-scoring words as weak", () => {
    const words = buildPronunciationWordFeedback({
      words: [
        { word: "latte", score: 45 },
        { word: "please", score: 88 },
      ],
    });

    expect(words).toEqual([
      { word: "latte", score: 45, status: "weak" },
      { word: "please", score: 88, status: "ok" },
    ]);
  });

  it("builds turn feedback from stored pronunciation evaluations", () => {
    const feedback = buildTurnPronunciationFeedback({
      evaluationStatus: "done",
      evaluation: {
        id: "eval-1",
        turnId: "turn-1",
        mode: "free_speech",
        overallScore: 82,
        accuracyScore: 79,
        fluencyScore: 85,
        details: {
          words: [{ word: "latte", score: 45 }],
        },
      },
    });

    expect(feedback).toMatchObject({
      evaluationStatus: "done",
      overallScore: 82,
      accuracyScore: 79,
      fluencyScore: 85,
      words: [{ word: "latte", score: 45, status: "weak" }],
    });
  });
});
