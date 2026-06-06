import { CEFR_LEVELS } from "./enums";
import type { ExitPolicy, Scenario, ScenarioGoal } from "./scenario";

export type ScenarioValidationError = {
  field: string;
  message: string;
};

export type ScenarioValidationResult =
  | { valid: true; scenario: Scenario }
  | { valid: false; errors: ScenarioValidationError[] };

function requireNonEmptyString(
  errors: ScenarioValidationError[],
  field: string,
  value: string,
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push({ field, message: `${field} is required.` });
  }
}

function requirePositiveInteger(
  errors: ScenarioValidationError[],
  field: string,
  value: number,
) {
  if (!Number.isInteger(value) || value <= 0) {
    errors.push({ field, message: `${field} must be a positive integer.` });
  }
}

function validateGoals(
  errors: ScenarioValidationError[],
  goals: ScenarioGoal[],
) {
  if (goals.length === 0) {
    errors.push({ field: "goals", message: "At least one goal is required." });
    return new Set<string>();
  }

  const goalIds = new Set<string>();

  for (const [index, goal] of goals.entries()) {
    const prefix = `goals[${index}]`;
    requireNonEmptyString(errors, `${prefix}.id`, goal.id);
    requireNonEmptyString(errors, `${prefix}.description`, goal.description);
    requireNonEmptyString(errors, `${prefix}.completedWhen`, goal.completedWhen);

    if (goal.id && goalIds.has(goal.id)) {
      errors.push({
        field: `${prefix}.id`,
        message: `Duplicate goal id "${goal.id}".`,
      });
    } else if (goal.id) {
      goalIds.add(goal.id);
    }
  }

  return goalIds;
}

function validateExitPolicy(
  errors: ScenarioValidationError[],
  exitPolicy: ExitPolicy,
  goalIds: Set<string>,
) {
  if (!Number.isInteger(exitPolicy.minTurns) || exitPolicy.minTurns < 1) {
    errors.push({
      field: "exitPolicy.minTurns",
      message: "exitPolicy.minTurns must be at least 1.",
    });
  }

  if (!Number.isInteger(exitPolicy.maxTurns) || exitPolicy.maxTurns < 1) {
    errors.push({
      field: "exitPolicy.maxTurns",
      message: "exitPolicy.maxTurns must be at least 1.",
    });
  } else if (
    Number.isInteger(exitPolicy.minTurns) &&
    exitPolicy.maxTurns < exitPolicy.minTurns
  ) {
    errors.push({
      field: "exitPolicy.maxTurns",
      message: "exitPolicy.maxTurns must be greater than or equal to minTurns.",
    });
  }

  requirePositiveInteger(
    errors,
    "exitPolicy.maxDurationSec",
    exitPolicy.maxDurationSec,
  );

  if (exitPolicy.requiredGoals.length === 0) {
    errors.push({
      field: "exitPolicy.requiredGoals",
      message: "exitPolicy.requiredGoals must include at least one goal id.",
    });
  }

  for (const goalId of exitPolicy.requiredGoals) {
    if (!goalIds.has(goalId)) {
      errors.push({
        field: "exitPolicy.requiredGoals",
        message: `Unknown required goal id "${goalId}".`,
      });
    }
  }
}

export function validateScenario(scenario: Scenario): ScenarioValidationResult {
  const errors: ScenarioValidationError[] = [];

  requireNonEmptyString(errors, "id", scenario.id);
  requireNonEmptyString(errors, "title", scenario.title);
  requireNonEmptyString(errors, "description", scenario.description);
  requireNonEmptyString(errors, "userRole", scenario.userRole);
  requireNonEmptyString(errors, "aiRole", scenario.aiRole);
  requireNonEmptyString(errors, "situation", scenario.situation);
  requireNonEmptyString(errors, "mission", scenario.mission);

  if (!CEFR_LEVELS.includes(scenario.level)) {
    errors.push({
      field: "level",
      message: `level must be one of: ${CEFR_LEVELS.join(", ")}.`,
    });
  }

  const goalIds = validateGoals(errors, scenario.goals);

  if (scenario.stages.length === 0) {
    errors.push({
      field: "stages",
      message: "At least one stage is required.",
    });
  }

  const stageIds = new Set<string>();
  for (const [index, stage] of scenario.stages.entries()) {
    const prefix = `stages[${index}]`;
    requireNonEmptyString(errors, `${prefix}.id`, stage.id);
    requireNonEmptyString(errors, `${prefix}.name`, stage.name);
    requireNonEmptyString(errors, `${prefix}.purpose`, stage.purpose);
    requireNonEmptyString(errors, `${prefix}.aiBehavior`, stage.aiBehavior);

    if (stage.expectedUserActions.length === 0) {
      errors.push({
        field: `${prefix}.expectedUserActions`,
        message: "Each stage must include at least one expected user action.",
      });
    }

    if (stage.id && stageIds.has(stage.id)) {
      errors.push({
        field: `${prefix}.id`,
        message: `Duplicate stage id "${stage.id}".`,
      });
    } else if (stage.id) {
      stageIds.add(stage.id);
    }
  }

  if (scenario.targetExpressions.length === 0) {
    errors.push({
      field: "targetExpressions",
      message: "At least one target expression is required.",
    });
  }

  if (scenario.constraints.length === 0) {
    errors.push({
      field: "constraints",
      message: "At least one constraint is required.",
    });
  }

  validateExitPolicy(errors, scenario.exitPolicy, goalIds);

  const requiredGoalIds = new Set(
    scenario.goals.filter((goal) => goal.required).map((goal) => goal.id),
  );
  for (const goalId of requiredGoalIds) {
    if (!scenario.exitPolicy.requiredGoals.includes(goalId)) {
      errors.push({
        field: "exitPolicy.requiredGoals",
        message: `Required goal "${goalId}" must appear in exitPolicy.requiredGoals.`,
      });
    }
  }

  if (scenario.evaluationRubric.dimensions.length === 0) {
    errors.push({
      field: "evaluationRubric.dimensions",
      message: "evaluationRubric.dimensions must include at least one dimension.",
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, scenario };
}

export function assertValidScenario(scenario: Scenario): Scenario {
  const result = validateScenario(scenario);
  if (!result.valid) {
    const details = result.errors
      .map((error) => `${error.field}: ${error.message}`)
      .join("; ");
    throw new Error(`Invalid scenario "${scenario.id}": ${details}`);
  }

  return result.scenario;
}
