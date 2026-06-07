import { describe, expect, it } from "vitest";

import { buildGoalJudgePrompt } from "@/server/scenario-progress/prompt-builder";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";

describe("buildGoalJudgePrompt", () => {
  it("includes scenario goals, current stage, prior progress, and recent transcript", () => {
    const prompt = buildGoalJudgePrompt({
      sessionId: "session-1",
      scenario: {
        id: coffeeOrderingScenario.id,
        title: coffeeOrderingScenario.title,
        goals: coffeeOrderingScenario.goals,
        stages: coffeeOrderingScenario.stages,
        vocabulary: coffeeOrderingScenario.vocabulary,
        targetExpressions: coffeeOrderingScenario.targetExpressions,
        exitPolicy: coffeeOrderingScenario.exitPolicy,
      },
      turns: [
        { turnId: "turn-1", role: "assistant", text: "What can I get for you?" },
        {
          turnId: "turn-2",
          role: "user",
          text: "Could I get a medium latte with oat milk?",
        },
      ],
      previousProgress: {
        sessionId: "session-1",
        currentStageId: "customization",
        completedGoalIds: ["choose_drink"],
        missingGoalIds: ["choose_size", "customize_order", "confirm_payment"],
        shouldSuggestEnding: false,
        offTopic: false,
        updatedAt: "2026-06-07T00:00:00.000Z",
      },
    });

    expect(prompt.system).toMatch(/Return JSON only/i);
    expect(prompt.user).toContain("choose_drink");
    expect(prompt.user).toContain("customization");
    expect(prompt.user).toContain("Previously completed goals: choose_drink");
    expect(prompt.user).toContain("medium latte");
    expect(prompt.outputSchema).toContain("shouldSuggestEnding");
  });
});
