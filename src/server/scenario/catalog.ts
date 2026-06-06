import { assertValidScenario, validateScenario } from "@/domain/scenario-validation";
import type { Scenario } from "@/domain/scenario";
import { seedScenarios } from "@/server/db/seeds/scenarios";

const scenariosById = new Map<string, Scenario>();

function loadCatalog(): Map<string, Scenario> {
  if (scenariosById.size > 0) {
    return scenariosById;
  }

  for (const scenario of seedScenarios) {
    assertValidScenario(scenario);
    scenariosById.set(scenario.id, scenario);
  }

  return scenariosById;
}

export function listSeedScenarios(): Scenario[] {
  return [...loadCatalog().values()];
}

export function getSeedScenarioById(scenarioId: string): Scenario | null {
  return loadCatalog().get(scenarioId) ?? null;
}

export function getSeedScenarioOrThrow(scenarioId: string): Scenario {
  const scenario = getSeedScenarioById(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario not found: ${scenarioId}`);
  }

  return scenario;
}

export function validateSeedScenarios() {
  return seedScenarios.map((scenario) => validateScenario(scenario));
}
