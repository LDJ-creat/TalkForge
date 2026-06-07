import type { CefrLevel } from "./enums";

export type ScenarioGoal = {
  id: string;
  description: string;
  required: boolean;
  completedWhen: string;
};

export type ScenarioStage = {
  id: string;
  name: string;
  purpose: string;
  aiBehavior: string;
  expectedUserActions: string[];
};

export type ExitPolicy = {
  minTurns: number;
  maxTurns: number;
  maxDurationSec: number;
  requiredGoals: string[];
  endWhenGoalsCompleted: boolean;
  allowUserManualEnd: boolean;
  aiCanSuggestEnd: boolean;
};

export type EvaluationRubric = {
  dimensions: string[];
};

export type Scenario = {
  id: string;
  title: string;
  description: string;
  level: CefrLevel;
  userRole: string;
  aiRole: string;
  userRoleLabel?: string;
  aiRoleLabel?: string;
  situation: string;
  mission: string;
  goals: ScenarioGoal[];
  stages: ScenarioStage[];
  vocabulary: string[];
  targetExpressions: string[];
  constraints: string[];
  exitPolicy: ExitPolicy;
  evaluationRubric: EvaluationRubric;
};

export type CreateScenarioInput = Omit<Scenario, "id"> & { id?: string };
