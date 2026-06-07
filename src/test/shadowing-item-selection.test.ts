import { describe, expect, it } from "vitest";

import type { Correction } from "@/domain/correction";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import {
  DEFAULT_SHADOWING_ITEM_LIMIT,
  selectShadowingItems,
} from "@/server/shadowing/select-items";

const TURN_ID = "22222222-2222-4222-8222-222222222222";

describe("selectShadowingItems", () => {
  it("prioritizes report recommendations and corrected expressions before scenario targets", () => {
    const corrections = new Map<string, Correction[]>([
      [
        TURN_ID,
        [
          {
            id: "corr-1",
            turnId: TURN_ID,
            type: "grammar",
            originalText: "I want coffee",
            correctedText: "Could I get a medium latte?",
            explanation: "Use a more natural ordering phrase.",
            confidence: 0.91,
          },
        ],
      ],
    ]);

    const items = selectShadowingItems({
      scenario: coffeeOrderingScenario,
      shadowingRecommendations: [
        {
          text: "Could I get a medium latte?",
          reason: "Practice this corrected phrase.",
        },
      ],
      correctionsByTurnId: corrections,
      maxItems: 3,
    });

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      standardText: "Could I get a medium latte?",
      originalText: "I want coffee",
      source: "report_recommendation",
      turnId: TURN_ID,
    });
    expect(items.some((item) => item.source === "scenario_target_expression")).toBe(true);
  });

  it("deduplicates by standard text and respects the item limit", () => {
    const corrections = new Map<string, Correction[]>([
      [
        TURN_ID,
        [
          {
            id: "corr-1",
            turnId: TURN_ID,
            type: "expression",
            originalText: "Give me latte",
            correctedText: "Could I get a medium latte?",
            explanation: "More polite phrasing.",
            confidence: 0.88,
          },
          {
            id: "corr-2",
            turnId: TURN_ID,
            type: "grammar",
            originalText: "medium size",
            correctedText: "Could I get a medium latte?",
            explanation: "Duplicate corrected phrase.",
            confidence: 0.7,
          },
        ],
      ],
    ]);

    const items = selectShadowingItems({
      scenario: coffeeOrderingScenario,
      shadowingRecommendations: [
        { text: "Could I get a medium latte?", reason: "Recommended in report." },
      ],
      correctionsByTurnId: corrections,
      maxItems: DEFAULT_SHADOWING_ITEM_LIMIT,
    });

    const normalized = items.map((item) => item.standardText.toLowerCase());
    expect(new Set(normalized).size).toBe(normalized.length);
    expect(items.length).toBeLessThanOrEqual(DEFAULT_SHADOWING_ITEM_LIMIT);
  });

  it("skips asr uncertain corrections and empty recommendations", () => {
    const corrections = new Map<string, Correction[]>([
      [
        TURN_ID,
        [
          {
            id: "corr-1",
            turnId: TURN_ID,
            type: "asr_uncertain",
            originalText: "unclear audio",
            correctedText: "Maybe this?",
            explanation: "Low confidence transcript.",
            confidence: 0.2,
          },
        ],
      ],
    ]);

    const items = selectShadowingItems({
      scenario: coffeeOrderingScenario,
      shadowingRecommendations: [{ text: "   ", reason: "Empty recommendation." }],
      correctionsByTurnId: corrections,
      maxItems: 2,
    });

    expect(items.every((item) => item.standardText.trim().length > 0)).toBe(true);
    expect(items.every((item) => item.source === "scenario_target_expression")).toBe(true);
  });
});
