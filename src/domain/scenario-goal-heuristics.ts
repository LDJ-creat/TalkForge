import type { Scenario, ScenarioGoal } from "./scenario";

const DRINK_PATTERN =
  /\b(latte|americano|espresso|cappuccino|coffee|mocha|tea|chai|macchiato|frappuccino)\b/i;
const SIZE_PATTERN = /\b(small|medium|large|tall|grande|venti)\b/i;
const CUSTOMIZATION_PATTERN =
  /\b(milk|oat|soy|almond|ice|iced|hot|sugar|sweet|extra|shot|whip|cream|temperature|warm|cold|no ice)\b/i;
const CONFIRMATION_PATTERN =
  /\b(yes|yeah|correct|right|confirm|confirmed|sounds good|that'?s fine|that is fine|perfect|thank you|thanks)\b/i;

const GOAL_MATCHERS: Record<string, RegExp> = {
  // Coffee ordering scenario ids; other scenarios fall back to completedWhen keywords.
  choose_drink: DRINK_PATTERN,
  choose_size: SIZE_PATTERN,
  customize_order: CUSTOMIZATION_PATTERN,
  confirm_payment: CONFIRMATION_PATTERN,
};

function matchesGoalHeuristic(goal: ScenarioGoal, combinedText: string): boolean {
  const pattern = GOAL_MATCHERS[goal.id];
  if (pattern) {
    return pattern.test(combinedText);
  }

  const keywords = goal.completedWhen
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);

  if (keywords.length === 0) {
    return false;
  }

  const matchedKeywords = keywords.filter((keyword) => combinedText.includes(keyword));
  return matchedKeywords.length >= Math.min(2, keywords.length);
}

function isOnTopic(scenario: Scenario, combinedText: string): boolean {
  if (combinedText.trim().length === 0) {
    return true;
  }

  const vocabularyHits = scenario.vocabulary.filter((word) =>
    combinedText.includes(word.toLowerCase()),
  ).length;
  if (vocabularyHits > 0) {
    return true;
  }

  const targetExpressionHits = scenario.targetExpressions.filter((expression) =>
    combinedText.includes(expression.toLowerCase()),
  ).length;
  if (targetExpressionHits > 0) {
    return true;
  }

  for (const goal of scenario.goals) {
    if (matchesGoalHeuristic(goal, combinedText)) {
      return true;
    }
  }

  const topicWords = [
    scenario.title,
    scenario.userRole,
    scenario.aiRole,
    ...scenario.stages.map((stage) => stage.name),
  ]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);

  return topicWords.some((word) => combinedText.includes(word));
}

export type GoalHeuristicResult = {
  completedGoalIds: string[];
  offTopic: boolean;
};

export function detectCompletedGoalsFromUserTexts(
  scenario: Scenario,
  userTexts: string[],
  previousCompletedGoalIds: string[] = [],
): GoalHeuristicResult {
  const combinedText = userTexts.join(" ").toLowerCase();
  const completedGoalIds = new Set(previousCompletedGoalIds);

  for (const goal of scenario.goals) {
    if (matchesGoalHeuristic(goal, combinedText)) {
      completedGoalIds.add(goal.id);
    }
  }

  const offTopic =
    userTexts.some((text) => text.trim().length > 0) && !isOnTopic(scenario, combinedText);

  return {
    completedGoalIds: [...completedGoalIds],
    offTopic,
  };
}
