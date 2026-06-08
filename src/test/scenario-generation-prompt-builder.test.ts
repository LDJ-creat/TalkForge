import { describe, expect, it } from "vitest";

import { buildScenarioGeneratePrompt } from "@/server/scenario-generation/prompt-builder";

describe("buildScenarioGeneratePrompt", () => {
  it("includes the learner request and output schema", () => {
    const prompt = buildScenarioGeneratePrompt({
      description: "Practice buying medicine at a pharmacy.",
      referenceScenarios: [
        {
          title: "Order Coffee at a Cafe",
          level: "A2",
          userRole: "customer",
          aiRole: "barista",
        },
      ],
    });

    expect(prompt.system).toContain("TalkForge");
    expect(prompt.system).toContain("title and description MUST be in Simplified Chinese");
    expect(prompt.system).toContain("Every other string field MUST be in English");
    expect(prompt.user).toContain("Practice buying medicine at a pharmacy.");
    expect(prompt.user).toContain("Order Coffee at a Cafe");
    expect(prompt.outputSchema).toContain("exitPolicy");
  });
});
