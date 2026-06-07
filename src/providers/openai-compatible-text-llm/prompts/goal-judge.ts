import type { GoalJudgeInput } from "@/providers/llm/goal-judge-types";

export type GoalJudgePrompt = {
  system: string;
  user: string;
  outputSchema: string;
};

const RECENT_TURN_LIMIT = 8;

function formatGoals(input: GoalJudgeInput): string {
  if (input.scenario.goals.length === 0) {
    return "No explicit goals.";
  }

  return input.scenario.goals
    .map(
      (goal) =>
        `- [${goal.required ? "required" : "optional"}] ${goal.id}: ${goal.description} (done when: ${goal.completedWhen})`,
    )
    .join("\n");
}

function formatStages(input: GoalJudgeInput): string {
  if (input.scenario.stages.length === 0) {
    return "No stages defined.";
  }

  return input.scenario.stages
    .map((stage) => `- ${stage.id}: ${stage.name} — ${stage.purpose}`)
    .join("\n");
}

function formatRecentTranscript(input: GoalJudgeInput): string {
  const recentTurns = input.turns.slice(-RECENT_TURN_LIMIT);
  if (recentTurns.length === 0) {
    return "No transcript turns yet.";
  }

  return recentTurns
    .map((turn) => `${turn.role}: ${turn.text.trim() || "(empty)"}`)
    .join("\n");
}

export function buildGoalJudgePrompt(input: GoalJudgeInput): GoalJudgePrompt {
  const outputSchema = `{
  "completedGoalIds": ["goal_id"],
  "missingGoalIds": ["goal_id"],
  "currentStageId": "stage_id",
  "offTopic": false,
  "shouldSuggestEnding": false
}`;

  const system = [
    "You evaluate English role-play scenario progress for TalkForge.",
    "Decide which scenario goals the learner has completed based only on the transcript.",
    "Mark offTopic true only when recent learner turns clearly ignore the scenario situation.",
    "shouldSuggestEnding is advisory: set true only when all required goals appear complete.",
    "Use only goal and stage ids from the input. Do not invent ids.",
    "Return JSON only. Do not wrap the JSON in markdown fences.",
  ].join("\n");

  const previous = input.previousProgress;
  const user = [
    `Scenario: ${input.scenario.title}`,
    "",
    "Goals:",
    formatGoals(input),
    "",
    "Stages:",
    formatStages(input),
    "",
    `Current stage: ${previous?.currentStageId ?? input.scenario.stages[0]?.id ?? "unknown"}`,
    `Previously completed goals: ${(previous?.completedGoalIds ?? []).join(", ") || "none"}`,
    "",
    "Recent transcript:",
    formatRecentTranscript(input),
    "",
    "Respond with JSON matching this schema:",
    outputSchema,
  ].join("\n");

  return { system, user, outputSchema };
}
