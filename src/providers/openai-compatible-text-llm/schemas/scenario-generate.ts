import { CEFR_LEVELS } from "@/domain/enums";
import type {
  EvaluationRubric,
  ExitPolicy,
  ScenarioGoal,
  ScenarioStage,
} from "@/domain/scenario";
import type { ScenarioDraft } from "@/providers/llm/scenario-generate-types";

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function parseGoals(value: unknown): ScenarioGoal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const id = readString(record.id);
    const description = readString(record.description);
    const completedWhen = readString(record.completedWhen);

    if (!id || !description || !completedWhen) {
      return [];
    }

    return [
      {
        id,
        description,
        required: readBoolean(record.required, false),
        completedWhen,
      },
    ];
  });
}

function parseStages(value: unknown): ScenarioStage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const id = readString(record.id);
    const name = readString(record.name);
    const purpose = readString(record.purpose);
    const aiBehavior = readString(record.aiBehavior);
    const expectedUserActions = readStringArray(record.expectedUserActions);

    if (!id || !name || !purpose || !aiBehavior || expectedUserActions.length === 0) {
      return [];
    }

    return [
      {
        id,
        name,
        purpose,
        aiBehavior,
        expectedUserActions,
      },
    ];
  });
}

function parseExitPolicy(value: unknown): ExitPolicy | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const minTurns = readPositiveInteger(record.minTurns);
  const maxTurns = readPositiveInteger(record.maxTurns);
  const maxDurationSec = readPositiveInteger(record.maxDurationSec);
  const requiredGoals = readStringArray(record.requiredGoals);

  if (!minTurns || !maxTurns || !maxDurationSec || requiredGoals.length === 0) {
    return null;
  }

  return {
    minTurns,
    maxTurns,
    maxDurationSec,
    requiredGoals,
    endWhenGoalsCompleted: readBoolean(record.endWhenGoalsCompleted, true),
    allowUserManualEnd: readBoolean(record.allowUserManualEnd, true),
    aiCanSuggestEnd: readBoolean(record.aiCanSuggestEnd, true),
  };
}

function parseEvaluationRubric(value: unknown): EvaluationRubric | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const dimensions = readStringArray((value as Record<string, unknown>).dimensions);
  if (dimensions.length === 0) {
    return null;
  }

  return { dimensions };
}

export function parseScenarioGenerateResponse(value: unknown): ScenarioDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = readString(record.title);
  const description = readString(record.description);
  const level = readString(record.level);
  const userRole = readString(record.userRole);
  const aiRole = readString(record.aiRole);
  const situation = readString(record.situation);
  const mission = readString(record.mission);
  const goals = parseGoals(record.goals);
  const stages = parseStages(record.stages);
  const vocabulary = readStringArray(record.vocabulary);
  const targetExpressions = readStringArray(record.targetExpressions);
  const constraints = readStringArray(record.constraints);
  const exitPolicy = parseExitPolicy(record.exitPolicy);
  const evaluationRubric = parseEvaluationRubric(record.evaluationRubric);

  if (
    !title ||
    !description ||
    !level ||
    !CEFR_LEVELS.includes(level as ScenarioDraft["level"]) ||
    !userRole ||
    !aiRole ||
    !situation ||
    !mission ||
    goals.length === 0 ||
    stages.length === 0 ||
    targetExpressions.length === 0 ||
    constraints.length === 0 ||
    !exitPolicy ||
    !evaluationRubric
  ) {
    return null;
  }

  return {
    title,
    description,
    level: level as ScenarioDraft["level"],
    userRole,
    aiRole,
    situation,
    mission,
    goals,
    stages,
    vocabulary,
    targetExpressions,
    constraints,
    exitPolicy,
    evaluationRubric,
  };
}
