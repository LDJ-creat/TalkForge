import type { ScenarioDraft } from "@/providers/llm/scenario-generate-types";
import { isProviderError } from "@/providers/errors";
import { validateScenario } from "@/domain/scenario-validation";
import type { Scenario } from "@/domain/scenario";
import { SCENARIO_GENERATE_PROMPT_VERSION } from "@/providers/openai-compatible-text-llm/prompt-versions";
import { listSeedScenarios } from "@/server/scenario/catalog";
import { getScenarioGenerateProvider } from "@/server/scenario-generation/provider";
import { ScenarioServiceError } from "@/server/scenario/errors";
import type { AiInvocationTraceWriter } from "@/server/ai-tracing";
import type { ScenarioGenerateInput } from "@/providers/llm/scenario-generate-types";

const MAX_DESCRIPTION_LENGTH = 2000;

export type GenerateScenarioInput = {
  description: string;
};

export type GenerateScenarioResult = {
  scenario: ScenarioDraft;
  provider: string;
  promptVersion: string;
};

export type GenerateScenarioDeps = {
  generateScenario: (
    input: ScenarioGenerateInput,
  ) => Promise<{ provider: string; scenario: ScenarioDraft }>;
};

function validateGeneratedScenario(scenario: ScenarioDraft): Scenario {
  const result = validateScenario({
    ...scenario,
    id: "draft",
  });

  if (!result.valid) {
    const details = result.errors
      .map((error) => `${error.field}: ${error.message}`)
      .join("; ");
    throw new ScenarioServiceError(
      422,
      "invalid_generated_scenario",
      `Generated scenario failed validation: ${details}`,
    );
  }

  return result.scenario;
}

export function createGenerateScenarioDeps(options?: {
  traceWriter?: AiInvocationTraceWriter;
}): GenerateScenarioDeps {
  const provider = getScenarioGenerateProvider(options);

  return {
    generateScenario: async (input) => {
      try {
        return await provider.generateScenario(input);
      } catch (error) {
        if (isProviderError(error)) {
          throw new ScenarioServiceError(
            error.retryable ? 502 : 500,
            error.code,
            error.message,
          );
        }

        throw error;
      }
    },
  };
}

export async function generateScenarioFromDescription(
  input: GenerateScenarioInput,
  deps: GenerateScenarioDeps,
): Promise<GenerateScenarioResult> {
  const description = input.description.trim();
  if (!description) {
    throw new ScenarioServiceError(400, "invalid_description", "description is required.");
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ScenarioServiceError(
      400,
      "invalid_description",
      `description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
    );
  }

  const referenceScenarios = listSeedScenarios().slice(0, 2).map((scenario) => ({
    title: scenario.title,
    level: scenario.level,
    userRole: scenario.userRole,
    aiRole: scenario.aiRole,
  }));

  const generation = await deps.generateScenario({
    description,
    referenceScenarios,
  });

  const scenario = validateGeneratedScenario(generation.scenario);

  return {
    scenario: {
      title: scenario.title,
      description: scenario.description,
      level: scenario.level,
      userRole: scenario.userRole,
      aiRole: scenario.aiRole,
      situation: scenario.situation,
      mission: scenario.mission,
      goals: scenario.goals,
      stages: scenario.stages,
      vocabulary: scenario.vocabulary,
      targetExpressions: scenario.targetExpressions,
      constraints: scenario.constraints,
      exitPolicy: scenario.exitPolicy,
      evaluationRubric: scenario.evaluationRubric,
    },
    provider: generation.provider,
    promptVersion: SCENARIO_GENERATE_PROMPT_VERSION,
  };
}
