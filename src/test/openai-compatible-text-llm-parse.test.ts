import { describe, expect, it } from "vitest";

import {
  extractJsonPayload,
  parseCorrectionItemsFromContent,
  parseCorrectionResponse,
  parseJsonContent,
  parseReportResponse,
  parseReportSectionsFromContent,
} from "@/providers/openai-compatible-text-llm";

describe("openai-compatible text LLM parse helpers", () => {
  it("extracts JSON from markdown fences", () => {
    expect(extractJsonPayload('```json\n{"corrections":[]}\n```')).toBe('{"corrections":[]}');
  });

  it("parses valid correction items", () => {
    const items = parseCorrectionResponse({
      corrections: [
        {
          type: "grammar",
          originalText: "I go to",
          correctedText: "I went to",
          explanation: "Use past tense.",
          confidence: 0.9,
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe("grammar");
  });

  it("rejects invalid correction types during normalization", () => {
    const parsed = parseCorrectionItemsFromContent(
      JSON.stringify({
        corrections: [
          {
            type: "spelling",
            originalText: "helo",
            correctedText: "hello",
            explanation: "Misspelled word.",
            confidence: 0.8,
          },
        ],
      }),
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toMatch(/invalid/i);
    }
  });

  it("marks partial schema loss when some correction items are dropped", () => {
    const parsed = parseCorrectionItemsFromContent(
      JSON.stringify({
        corrections: [
          {
            type: "grammar",
            originalText: "I go to",
            correctedText: "I went to",
            explanation: "Use past tense.",
            confidence: 0.9,
          },
          {
            type: "spelling",
            originalText: "helo",
            correctedText: "hello",
            explanation: "Misspelled word.",
            confidence: 0.8,
          },
        ],
      }),
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toHaveLength(1);
      expect(parsed.schemaFallback).toBe(true);
    }
  });

  it("returns empty corrections for malformed JSON", () => {
    const parsed = parseCorrectionItemsFromContent("{not-json");

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toMatch(/JSON/i);
    }
  });

  it("parses report sections and ignores invalid entries", () => {
    const sections = parseReportResponse({
      summary: " Strong session ",
      nextPracticeSuggestion: " Practice ordering phrases ",
      alternativeExpressions: [
        {
          original: "I want coffee.",
          suggestion: "Could I get a latte?",
          context: "Ordering",
        },
        { original: "", suggestion: "skip me" },
      ],
      shadowingRecommendations: [{ text: "Could I get a latte?" }],
    });

    expect(sections.summary).toBe("Strong session");
    expect(sections.alternativeExpressions).toHaveLength(1);
    expect(sections.shadowingRecommendations).toHaveLength(1);
  });

  it("parses report content from fenced JSON", () => {
    const parsed = parseReportSectionsFromContent(
      '```json\n{"summary":"Done","nextPracticeSuggestion":"Retry"}\n```',
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.summary).toBe("Done");
      expect(parsed.value.nextPracticeSuggestion).toBe("Retry");
    }
  });

  it("reports JSON parse failures", () => {
    const parsed = parseJsonContent("[]");
    expect(parsed.ok).toBe(true);
  });
});
