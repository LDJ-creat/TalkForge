import { validateScenario } from "@/domain/scenario-validation";
import type { Scenario, CreateScenarioInput } from "@/domain/scenario";
import type { TalkForgeDatabase } from "@/server/db/client";
import { upsertScenario } from "@/server/db/repositories/scenario-session-repository";
import {
  assignCustomScenarioId,
  collectExistingScenarioIds,
} from "@/server/scenario/catalog";
import { ScenarioServiceError } from "@/server/scenario/errors";

export type CreateCustomScenarioInput = {
  scenario: CreateScenarioInput;
};

export type CreateCustomScenarioDeps = {
  collectExistingScenarioIds: () => Promise<Set<string>>;
  upsertScenario: (scenario: Scenario) => Promise<Scenario>;
};

export function createCreateCustomScenarioDeps(
  db: TalkForgeDatabase,
): CreateCustomScenarioDeps {
  return {
    collectExistingScenarioIds: () => collectExistingScenarioIds(db),
    upsertScenario: (scenario) => upsertScenario(db, scenario),
  };
}

export async function createCustomScenario(
  input: CreateCustomScenarioInput,
  deps: CreateCustomScenarioDeps,
): Promise<Scenario> {
  const draft = input.scenario;
  const provisionalId = draft.id?.trim() || "draft";
  const validation = validateScenario({
    ...draft,
    id: provisionalId,
  });

  if (!validation.valid) {
    const details = validation.errors
      .map((error) => `${error.field}: ${error.message}`)
      .join("; ");
    throw new ScenarioServiceError(
      422,
      "invalid_scenario",
      `Scenario failed validation: ${details}`,
    );
  }

  const existingIds = await deps.collectExistingScenarioIds();
  const id = draft.id?.trim()
    ? draft.id.trim()
    : assignCustomScenarioId(validation.scenario.title, existingIds);

  if (existingIds.has(id)) {
    throw new ScenarioServiceError(
      409,
      "scenario_id_conflict",
      `Scenario id "${id}" already exists.`,
    );
  }

  return deps.upsertScenario({
    ...validation.scenario,
    id,
  });
}
