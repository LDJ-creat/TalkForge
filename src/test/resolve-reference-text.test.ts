import { describe, expect, it } from "vitest";

import {
  countReferenceWords,
  isValidFreeSpeechReferenceText,
  resolveReferenceTextForTurn,
} from "@/server/pronunciation/resolve-reference-text";

const TURN_ID = "22222222-2222-4222-8222-222222222222";

describe("resolveReferenceTextForTurn", () => {
  it("prefers realtime turn transcript over legacy ASR transcript records", async () => {
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
        transcriptText: "Realtime transcript text here",
        evaluationStatus: "pending",
      }),
    });

    expect(resolved).toEqual({
      text: "Realtime transcript text here",
      wordCount: 4,
      source: "realtime",
    });
  });

  it("falls back to legacy transcript when realtime turn text is missing", async () => {
    const resolved = await resolveReferenceTextForTurn(TURN_ID, {
      getTranscriptByTurnId: async () => ({
        id: "transcript-1",
        turnId: TURN_ID,
        provider: "dashscope-paraformer-asr",
        text: "I want coffee please",
        confidence: 0.9,
        segments: [],
      }),
      getTurnById: async () => ({
        id: TURN_ID,
        sessionId: "session-1",
        role: "user",
        startedAt: "2026-06-06T00:00:00.000Z",
        endedAt: "2026-06-06T00:00:05.000Z",
        evaluationStatus: "pending",
      }),
    });

    expect(resolved).toEqual({
      text: "I want coffee please",
      wordCount: 4,
      source: "transcript",
    });
  });

  it("validates minimum word count for free speech evaluation", () => {
    expect(countReferenceWords("Hi")).toBe(1);
    expect(
      isValidFreeSpeechReferenceText({
        text: "Hi",
        wordCount: 1,
        source: "realtime",
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
