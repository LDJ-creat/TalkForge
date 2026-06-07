import { describe, expect, it } from "vitest";

import { parseScenarioGenerateFromContent } from "@/providers/openai-compatible-text-llm/parse";

const validScenarioJson = {
  title: "Pharmacy Visit",
  description: "Practice asking for medicine at a pharmacy.",
  level: "A2",
  userRole: "customer",
  aiRole: "pharmacist",
  situation: "The learner needs cold medicine at a local pharmacy.",
  mission: "Help the learner explain symptoms and buy suitable medicine.",
  goals: [
    {
      id: "explain_symptoms",
      description: "The learner explains their symptoms.",
      required: true,
      completedWhen: "The learner describes at least one symptom clearly.",
    },
  ],
  stages: [
    {
      id: "opening",
      name: "Opening",
      purpose: "Start the visit.",
      aiBehavior: "Greet the learner and ask how you can help.",
      expectedUserActions: ["greet", "state need"],
    },
  ],
  vocabulary: ["medicine", "headache"],
  targetExpressions: ["I need something for a cold."],
  constraints: ["Stay in character as a pharmacist."],
  exitPolicy: {
    minTurns: 4,
    maxTurns: 10,
    maxDurationSec: 300,
    requiredGoals: ["explain_symptoms"],
    endWhenGoalsCompleted: true,
    allowUserManualEnd: true,
    aiCanSuggestEnd: true,
  },
  evaluationRubric: {
    dimensions: ["task_completion", "fluency"],
  },
};

describe("parseScenarioGenerateFromContent", () => {
  it("parses a valid scenario payload", () => {
    const parsed = parseScenarioGenerateFromContent(JSON.stringify(validScenarioJson));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.title).toBe("Pharmacy Visit");
      expect(parsed.value.goals).toHaveLength(1);
    }
  });

  it("rejects invalid scenario payloads", () => {
    const parsed = parseScenarioGenerateFromContent(JSON.stringify({ title: "Incomplete" }));

    expect(parsed.ok).toBe(false);
  });
});
