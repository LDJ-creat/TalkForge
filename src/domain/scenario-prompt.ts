import type { Scenario } from "./scenario";

const LEVEL_GUIDANCE: Record<Scenario["level"], string> = {
  A1: "Use very simple words and short sentences. Offer choices when the learner hesitates.",
  A2: "Use short, natural sentences. Avoid complex idioms.",
  B1: "Use clear conversational English with moderate complexity.",
  B2: "Use natural professional or situational English appropriate for independent speakers.",
  C1: "Use fluent, nuanced English while keeping responses concise for speaking practice.",
};

const BASE_BEHAVIOR_RULES = [
  "Stay in character for the full conversation.",
  "Do not interrupt the learner with grammar corrections unless they explicitly ask for help.",
  "If the learner struggles, offer a short hint or a simple choice.",
  "Keep responses concise and suitable for spoken dialogue.",
  "After all conversation goals are complete, naturally ask whether they want to finish the practice.",
  "If the learner goes off-topic, gently guide them back to the scenario.",
];

function formatList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function formatGoalLines(scenario: Scenario): string {
  return scenario.goals
    .map((goal, index) => `${index + 1}. ${goal.description}`)
    .join("\n");
}

function formatStageLines(scenario: Scenario): string {
  return scenario.stages
    .map(
      (stage, index) =>
        `${index + 1}. ${stage.name}: ${stage.aiBehavior}`,
    )
    .join("\n");
}

function formatBehaviorRules(scenario: Scenario): string {
  const rules = [...scenario.constraints, ...BASE_BEHAVIOR_RULES];
  return rules.map((rule) => `- ${rule}`).join("\n");
}

export function generateScenarioSystemInstructions(scenario: Scenario): string {
  const sections = [
    `You are role-playing as a ${scenario.aiRole}.`,
    "",
    "Scenario:",
    `The learner is a ${scenario.userRole}. ${scenario.situation}`,
    "",
    "Learner level:",
    `${scenario.level}. ${LEVEL_GUIDANCE[scenario.level]}`,
    "",
    "Mission:",
    scenario.mission,
    "",
    "Conversation goals:",
    formatGoalLines(scenario),
    "",
    "Conversation stages:",
    formatStageLines(scenario),
    "",
    "Useful vocabulary:",
    scenario.vocabulary.join(", "),
    "",
    "Target expressions:",
    formatList(scenario.targetExpressions),
    "",
    "Behavior rules:",
    formatBehaviorRules(scenario),
  ];

  return sections.join("\n");
}
