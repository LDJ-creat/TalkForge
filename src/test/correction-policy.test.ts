import { describe, expect, it } from "vitest";

import {
  ASR_UNCERTAIN_CONFIDENCE_THRESHOLD,
  isLowConfidenceTranscript,
  normalizeCorrectionAnalysisItems,
} from "@/providers/llm/correction-policy";

describe("correction policy", () => {
  it("treats undefined confidence as not low-confidence", () => {
    expect(isLowConfidenceTranscript(undefined)).toBe(false);
  });

  it("uses the shared low-confidence threshold", () => {
    expect(isLowConfidenceTranscript(ASR_UNCERTAIN_CONFIDENCE_THRESHOLD)).toBe(false);
    expect(isLowConfidenceTranscript(ASR_UNCERTAIN_CONFIDENCE_THRESHOLD - 0.01)).toBe(true);
  });

  it("requires correctedText for grammar-like correction types", () => {
    expect(() =>
      normalizeCorrectionAnalysisItems([
        {
          type: "grammar",
          originalText: "I go to",
          explanation: "Use past tense.",
          confidence: 0.9,
        },
      ]),
    ).toThrow(/must include correctedText/);
  });

  it("rejects correctedText on asr_uncertain items", () => {
    expect(() =>
      normalizeCorrectionAnalysisItems([
        {
          type: "asr_uncertain",
          originalText: "maybe latte?",
          correctedText: "maybe a latte?",
          explanation: "Transcript is unclear.",
          confidence: 0.4,
        },
      ]),
    ).toThrow(/must not include correctedText/);
  });

  it("normalizes valid correction items", () => {
    expect(
      normalizeCorrectionAnalysisItems([
        {
          type: "grammar",
          originalText: " I go to ",
          correctedText: " I went to ",
          explanation: " Use past tense. ",
          confidence: 0.88,
        },
      ]),
    ).toEqual([
      {
        type: "grammar",
        originalText: "I go to",
        correctedText: "I went to",
        explanation: "Use past tense.",
        confidence: 0.88,
      },
    ]);
  });
});
