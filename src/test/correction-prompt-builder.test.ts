import { describe, expect, it } from "vitest";

import type { CorrectionContextTurn } from "@/providers/llm/types";
import {
  ASR_UNCERTAIN_CONFIDENCE_THRESHOLD,
  buildCorrectionAnalyzeInput,
  buildCorrectionPrompt,
  buildCorrectionPromptFromAnalyzeInput,
  buildRecentContextTurns,
} from "@/server/correction";

describe("correction prompt builder", () => {
  it("includes transcript, level guidance, and recent context", () => {
    const prompt = buildCorrectionPrompt({
      turnId: "turn-3",
      transcriptText: "I go to the cafe yesterday.",
      transcriptConfidence: 0.91,
      scenarioLevel: "A2",
      scenarioConstraints: ["Stay in character as a barista."],
      recentContext: [
        { role: "assistant", text: "What can I get for you today?" },
        { role: "user", text: "Hi there.", confidence: 0.88 },
      ],
    });

    expect(prompt.system).toContain("Do not treat obvious transcription misrecognitions");
    expect(prompt.system).toMatch(/Simplified Chinese only/i);
    expect(prompt.system).toMatch(/originalText and correctedText in English/i);
    expect(prompt.system).toContain("Learner level: A2");
    expect(prompt.user).toContain("I go to the cafe yesterday.");
    expect(prompt.user).toContain("What can I get for you today?");
    expect(prompt.user).toContain("Stay in character as a barista.");
    expect(prompt.outputSchema).toContain("asr_uncertain");
  });

  it("flags low-confidence transcripts to avoid over-correction", () => {
    const prompt = buildCorrectionPrompt({
      turnId: "turn-4",
      transcriptText: "maybe latte?",
      transcriptConfidence: 0.42,
      scenarioLevel: "B1",
      recentContext: [],
    });

    expect(prompt.user).toContain("0.42");
    expect(prompt.user).toContain("low — avoid over-correction");
    expect(prompt.system).toContain(String(ASR_UNCERTAIN_CONFIDENCE_THRESHOLD));
  });

  it("builds recent context from prior turns with transcript lookup", () => {
    const context: CorrectionContextTurn[] = buildRecentContextTurns(
      [
        {
          id: "turn-1",
          sessionId: "session-1",
          role: "assistant",
          startedAt: "2026-06-06T00:00:00.000Z",
          endedAt: "2026-06-06T00:00:04.000Z",
          evaluationStatus: "pending",
        },
        {
          id: "turn-2",
          sessionId: "session-1",
          role: "user",
          startedAt: "2026-06-06T00:00:05.000Z",
          endedAt: "2026-06-06T00:00:09.000Z",
          evaluationStatus: "pending",
        },
        {
          id: "turn-3",
          sessionId: "session-1",
          role: "user",
          startedAt: "2026-06-06T00:00:10.000Z",
          endedAt: "2026-06-06T00:00:14.000Z",
          evaluationStatus: "pending",
        },
      ],
      "turn-3",
      new Map([
        [
          "turn-2",
          {
            id: "transcript-2",
            turnId: "turn-2",
            provider: "mock-asr",
            text: "Hi there.",
            confidence: 0.88,
            segments: [],
          },
        ],
      ]),
    );

    expect(context).toEqual([
      {
        role: "user",
        text: "Hi there.",
        confidence: 0.88,
      },
    ]);
  });

  it("maps transcript and scenario metadata into provider input", () => {
    const input = buildCorrectionAnalyzeInput({
      turnId: "turn-3",
      transcript: {
        id: "transcript-3",
        turnId: "turn-3",
        provider: "mock-asr",
        text: "I go to the cafe yesterday.",
        confidence: 0.95,
        segments: [],
      },
      recentContext: [{ role: "assistant", text: "Welcome!" }],
      scenarioLevel: "A2",
      scenarioConstraints: ["Use polite ordering language."],
    });

    expect(input).toEqual({
      turnId: "turn-3",
      transcriptText: "I go to the cafe yesterday.",
      transcriptConfidence: 0.95,
      recentContext: [{ role: "assistant", text: "Welcome!" }],
      scenarioLevel: "A2",
      scenarioConstraints: ["Use polite ordering language."],
    });

    const prompt = buildCorrectionPromptFromAnalyzeInput(input);
    expect(prompt.user).toContain("I go to the cafe yesterday.");
    expect(prompt.system).toContain("Learner level: A2");
  });
});
