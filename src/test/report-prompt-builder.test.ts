import { describe, expect, it } from "vitest";

import { buildReportPrompt } from "@/server/report/prompt-builder";

describe("buildReportPrompt", () => {
  it("includes scenario goals, progress, and turn corrections", () => {
    const prompt = buildReportPrompt({
      sessionId: "session-1",
      scenario: {
        id: "cafe-order",
        title: "Cafe Order",
        level: "A2",
        goals: [{ id: "order-drink", description: "Order a drink", required: true }],
        evaluationRubric: { dimensions: ["fluency"] },
      },
      scenarioProgress: {
        sessionId: "session-1",
        currentStageId: "stage-1",
        completedGoalIds: ["order-drink"],
        missingGoalIds: [],
        shouldSuggestEnding: true,
        offTopic: false,
        updatedAt: "2026-06-07T00:00:00.000Z",
      },
      turns: [
        {
          turnId: "turn-1",
          role: "user",
          text: "I want coffee.",
          corrections: [
            {
              type: "expression",
              originalText: "I want coffee.",
              correctedText: "Could I get a coffee, please?",
              explanation: "More polite ordering phrase.",
              confidence: 0.82,
            },
          ],
        },
      ],
    });

    expect(prompt.system).toMatch(/Return JSON only/i);
    expect(prompt.system).toMatch(/Simplified Chinese/i);
    expect(prompt.system).toMatch(/must stay in English/i);
    expect(prompt.user).toContain("Cafe Order");
    expect(prompt.user).toContain("order-drink");
    expect(prompt.user).toContain("Could I get a coffee, please?");
    expect(prompt.outputSchema).toContain("alternativeExpressions");
  });
});
