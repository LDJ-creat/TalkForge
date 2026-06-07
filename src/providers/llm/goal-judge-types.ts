import type { Scenario, ScenarioGoal, ScenarioStage } from "@/domain/scenario";
import type { ScenarioProgress } from "@/domain/scenario-progress";
import type { TurnRole } from "@/domain/enums";
import type { ProviderMetadata } from "../types";

export type GoalJudgeScenarioContext = Pick<
  Scenario,
  "id" | "title" | "vocabulary" | "targetExpressions" | "exitPolicy"
> & {
  goals: ScenarioGoal[];
  stages: ScenarioStage[];
};

export type GoalJudgeTurnContext = {
  turnId: string;
  role: TurnRole;
  text: string;
};

export type GoalJudgeInput = {
  sessionId: string;
  scenario: GoalJudgeScenarioContext;
  turns: GoalJudgeTurnContext[];
  previousProgress: ScenarioProgress | null;
};

export type GoalJudgeResult = {
  provider: string;
  completedGoalIds: string[];
  offTopic: boolean;
  currentStageId?: string;
  metadata?: ProviderMetadata;
};
