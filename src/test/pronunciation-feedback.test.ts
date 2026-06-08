import { describe, expect, it } from "vitest";

import {
  buildPronunciationWordFeedback,
  buildTurnPronunciationFeedback,
  filterPronunciationDisplayWords,
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

  it("derives overall scores from word details when sentence scores are missing", () => {
    const feedback = buildTurnPronunciationFeedback({
      evaluationStatus: "done",
      evaluation: {
        id: "eval-2",
        turnId: "turn-2",
        mode: "free_speech",
        details: {
          words: [
            { word: "i", score: 40 },
            { word: "sil" },
            { word: "want", score: 80 },
          ],
        },
      },
    });

    expect(feedback?.overallScore).toBeCloseTo(60);
    expect(feedback?.accuracyScore).toBeCloseTo(60);
  });

  it("filters silence markers from display words", () => {
    const words = filterPronunciationDisplayWords([
      { word: "sil", score: undefined, status: "ok" },
      { word: "latte", score: 45, status: "weak" },
    ]);

    expect(words).toEqual([{ word: "latte", score: 45, status: "weak" }]);
  });
});
