import { describe, expect, it } from "vitest";

import {
  countReferenceWords,
  isValidFreeSpeechReferenceText,
  resolveReferenceTextForTurn,
} from "@/server/pronunciation/resolve-reference-text";

const TURN_ID = "22222222-2222-4222-8222-222222222222";

describe("resolveReferenceTextForTurn", () => {
  it("prefers official transcript text over turn fallback", async () => {
    const resolved = await resolveReferenceTextForTurn(TURN_ID, {
      getTranscriptByTurnId: async () => ({
        id: "transcript-1",
        turnId: TURN_ID,
        provider: "dashscope-paraformer-asr",
        text: "Could I get a medium latte?",
        confidence: 0.9,
        segments: [],
      }),
      getTurnById: async () => ({
        id: TURN_ID,
        sessionId: "session-1",
        role: "user",
        startedAt: "2026-06-06T00:00:00.000Z",
        endedAt: "2026-06-06T00:00:05.000Z",
        transcriptText: "Realtime fallback text here",
        evaluationStatus: "pending",
      }),
    });

    expect(resolved).toEqual({
      text: "Could I get a medium latte?",
      wordCount: 6,
      source: "transcript",
    });
  });

  it("falls back to turn transcript text when official transcript is missing", async () => {
    const resolved = await resolveReferenceTextForTurn(TURN_ID, {
      getTranscriptByTurnId: async () => null,
      getTurnById: async () => ({
        id: TURN_ID,
        sessionId: "session-1",
        role: "user",
        startedAt: "2026-06-06T00:00:00.000Z",
        endedAt: "2026-06-06T00:00:05.000Z",
        transcriptText: "I want coffee please",
        evaluationStatus: "pending",
      }),
    });

    expect(resolved.source).toBe("turn_fallback");
    expect(resolved.wordCount).toBe(4);
  });

  it("validates minimum word count for free speech evaluation", () => {
    expect(countReferenceWords("Hi")).toBe(1);
    expect(
      isValidFreeSpeechReferenceText({
        text: "Hi",
        wordCount: 1,
        source: "turn_fallback",
      }),
    ).toBe(false);
    expect(
      isValidFreeSpeechReferenceText({
        text: "Hello there",
        wordCount: 2,
        source: "transcript",
      }),
    ).toBe(true);
  });
});
