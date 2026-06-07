import { describe, expect, it } from "vitest";

import {
  parseGoalJudgeResponse,
  parseGoalJudgeSectionsFromContent,
} from "@/providers/openai-compatible-text-llm";

describe("openai-compatible goal judge parse helpers", () => {
  const validGoalIds = new Set(["choose_drink", "choose_size", "confirm_payment"]);
  const validStageIds = new Set(["greeting", "confirmation"]);

  it("parses structured goal judge output", () => {
    const parsed = parseGoalJudgeResponse(
      {
        completedGoalIds: ["choose_drink", "choose_size"],
        missingGoalIds: ["confirm_payment"],
        currentStageId: "confirmation",
        offTopic: false,
        shouldSuggestEnding: false,
      },
      { validGoalIds, validStageIds },
    );

    expect(parsed.completedGoalIds).toEqual(["choose_drink", "choose_size"]);
    expect(parsed.missingGoalIds).toEqual(["confirm_payment"]);
    expect(parsed.currentStageId).toBe("confirmation");
    expect(parsed.offTopic).toBe(false);
    expect(parsed.shouldSuggestEnding).toBe(false);
  });

  it("filters unknown goal and stage ids", () => {
    const parsed = parseGoalJudgeResponse(
      {
        completedGoalIds: ["choose_drink", "unknown_goal"],
        currentStageId: "unknown_stage",
        offTopic: true,
      },
      { validGoalIds, validStageIds },
    );

    expect(parsed.completedGoalIds).toEqual(["choose_drink"]);
    expect(parsed.currentStageId).toBeUndefined();
    expect(parsed.offTopic).toBe(true);
  });

  it("parses JSON content from provider responses", () => {
    const parsed = parseGoalJudgeSectionsFromContent(
      JSON.stringify({
        completedGoalIds: ["confirm_payment"],
        offTopic: false,
        shouldSuggestEnding: true,
      }),
      { validGoalIds, validStageIds },
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.completedGoalIds).toEqual(["confirm_payment"]);
      expect(parsed.value.shouldSuggestEnding).toBe(true);
    }
  });
});
