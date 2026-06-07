import type { ReportGenerateInput } from "@/providers/llm/types";

export type ReportPrompt = {
  system: string;
  user: string;
  outputSchema: string;
};

function formatGoals(
  goals: ReportGenerateInput["scenario"]["goals"],
): string {
  if (goals.length === 0) {
    return "No explicit goals were provided.";
  }

  return goals
    .map(
      (goal) =>
        `- [${goal.required ? "required" : "optional"}] ${goal.id}: ${goal.description}`,
    )
    .join("\n");
}

function formatTurns(turns: ReportGenerateInput["turns"]): string {
  if (turns.length === 0) {
    return "No transcript turns were captured.";
  }

  return turns
    .map((turn, index) => {
      const correctionLines = (turn.corrections ?? [])
        .filter((correction) => correction.type !== "asr_uncertain")
        .map(
          (correction) =>
            `    - ${correction.type}: ${correction.originalText}${
              correction.correctedText ? ` -> ${correction.correctedText}` : ""
            } (${correction.explanation})`,
        );

      return [
        `${index + 1}. ${turn.role} (${turn.turnId}): ${turn.text}`,
        correctionLines.length > 0 ? correctionLines.join("\n") : "    - no corrections",
      ].join("\n");
    })
    .join("\n\n");
}

export function buildReportPrompt(input: ReportGenerateInput): ReportPrompt {
  const outputSchema = `{
  "summary": "string",
  "nextPracticeSuggestion": "string",
  "alternativeExpressions": [
    {
      "original": "string",
      "suggestion": "string",
      "context": "string | null"
    }
  ],
  "shadowingRecommendations": [
    {
      "text": "string",
      "reason": "string | null"
    }
  ]
}`;

  const system = [
    "You write concise English-learning session reports for TalkForge.",
    "Use the provided scenario goals, progress, transcripts, and corrections.",
    "Focus on actionable feedback the learner can practice next.",
    "Suggest alternative expressions only when they improve naturalness or clarity.",
    "Do not invent transcript content or corrections that are not grounded in the input.",
    "Write all narrative feedback in Simplified Chinese (summary, nextPracticeSuggestion, alternativeExpressions[].context, shadowingRecommendations[].reason).",
    "Keep learner quotes in English: turn transcripts, originalText, correctedText, alternativeExpressions[].original, alternativeExpressions[].suggestion, and shadowingRecommendations[].text must stay in English.",
    "Return JSON only. Do not wrap the JSON in markdown fences.",
  ].join("\n");

  const user = [
    `Scenario: ${input.scenario.title} (${input.scenario.level})`,
    "",
    "Goals:",
    formatGoals(input.scenario.goals),
    "",
    "Progress:",
    `- Completed goals: ${input.scenarioProgress.completedGoalIds.join(", ") || "none"}`,
    `- Missing goals: ${input.scenarioProgress.missingGoalIds.join(", ") || "none"}`,
    `- Off topic: ${input.scenarioProgress.offTopic ? "yes" : "no"}`,
    "",
    "Conversation turns:",
    formatTurns(input.turns),
    "",
    "Respond with JSON matching this schema:",
    outputSchema,
  ].join("\n");

  return { system, user, outputSchema };
}
