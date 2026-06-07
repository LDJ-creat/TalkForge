import type { Scenario } from "@/domain/scenario";
import type { ScenarioGenerateInput } from "@/providers/llm/scenario-generate-types";

export type ScenarioGeneratePrompt = {
  system: string;
  user: string;
  outputSchema: string;
};

function formatReferenceScenarios(
  referenceScenarios: Pick<Scenario, "title" | "level" | "userRole" | "aiRole">[],
): string {
  if (referenceScenarios.length === 0) {
    return "No reference scenarios provided.";
  }

  return referenceScenarios
    .map(
      (scenario, index) =>
        `${index + 1}. ${scenario.title} (${scenario.level}) — You: ${scenario.userRole}, AI: ${scenario.aiRole}`,
    )
    .join("\n");
}

export function buildScenarioGeneratePrompt(
  input: ScenarioGenerateInput,
): ScenarioGeneratePrompt {
  const outputSchema = `{
  "title": "string",
  "description": "string",
  "level": "A1 | A2 | B1 | B2 | C1",
  "userRole": "string",
  "aiRole": "string",
  "situation": "string",
  "mission": "string",
  "goals": [
    {
      "id": "string",
      "description": "string",
      "required": true,
      "completedWhen": "string"
    }
  ],
  "stages": [
    {
      "id": "string",
      "name": "string",
      "purpose": "string",
      "aiBehavior": "string",
      "expectedUserActions": ["string"]
    }
  ],
  "vocabulary": ["string"],
  "targetExpressions": ["string"],
  "constraints": ["string"],
  "exitPolicy": {
    "minTurns": 4,
    "maxTurns": 12,
    "maxDurationSec": 360,
    "requiredGoals": ["goal_id"],
    "endWhenGoalsCompleted": true,
    "allowUserManualEnd": true,
    "aiCanSuggestEnd": true
  },
  "evaluationRubric": {
    "dimensions": ["task_completion", "fluency", "clarity", "grammar", "expression"]
  }
}`;

  const system = [
    "You design structured English speaking practice scenarios for TalkForge.",
    "Each scenario must be a complete role-play task with goals, stages, exit policy, and evaluation rubric.",
    "Goals must use stable snake_case ids. Every required goal id must appear in exitPolicy.requiredGoals.",
    "Stages should progress naturally from opening to closing.",
    "Constraints must keep the AI in character and suitable for spoken dialogue.",
    "Choose an appropriate CEFR level based on the learner request.",
    "Do not include an id field in the JSON output.",
    "Return JSON only. Do not wrap the JSON in markdown fences.",
  ].join("\n");

  const user = [
    "Learner request:",
    input.description.trim(),
    "",
    "Reference scenario summaries:",
    formatReferenceScenarios(input.referenceScenarios ?? []),
    "",
    "Output schema:",
    outputSchema,
  ].join("\n");

  return {
    system,
    user,
    outputSchema,
  };
}
