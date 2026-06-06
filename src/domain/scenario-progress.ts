export type ScenarioProgress = {
  sessionId: string;
  currentStageId: string;
  completedGoalIds: string[];
  missingGoalIds: string[];
  shouldSuggestEnding: boolean;
  offTopic: boolean;
  updatedAt: string;
};

export type UpdateScenarioProgressInput = Partial<
  Omit<ScenarioProgress, "sessionId" | "updatedAt">
>;
