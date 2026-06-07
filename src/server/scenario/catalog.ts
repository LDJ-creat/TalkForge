import { assertValidScenario, validateScenario } from "@/domain/scenario-validation";
import type { Scenario } from "@/domain/scenario";
import type { TalkForgeDatabase } from "@/server/db/client";
import { listScenarios, getScenarioById } from "@/server/db/repositories/scenario-session-repository";
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

export function getSeedScenarioIds(): Set<string> {
  return new Set(listSeedScenarios().map((scenario) => scenario.id));
}

export function slugifyScenarioTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return slug || "scenario";
}

export function assignCustomScenarioId(title: string, existingIds: Set<string>): string {
  const base = `custom_${slugifyScenarioTitle(title)}`;
  if (!existingIds.has(base)) {
    return base;
  }

  let suffix = 2;
  while (existingIds.has(`${base}_${suffix}`)) {
    suffix += 1;
  }

  return `${base}_${suffix}`;
}

export async function listAllScenarios(db: TalkForgeDatabase): Promise<Scenario[]> {
  const seeds = listSeedScenarios();
  const seedIds = getSeedScenarioIds();
  const dbScenarios = await listScenarios(db);
  const customScenarios = dbScenarios.filter((scenario) => !seedIds.has(scenario.id));

  return [...seeds, ...customScenarios];
}

export async function resolveScenario(
  db: TalkForgeDatabase,
  scenarioId: string,
): Promise<Scenario | null> {
  const seedScenario = getSeedScenarioById(scenarioId);
  if (seedScenario) {
    return seedScenario;
  }

  return getScenarioById(db, scenarioId);
}

export async function collectExistingScenarioIds(
  db: TalkForgeDatabase,
): Promise<Set<string>> {
  const ids = getSeedScenarioIds();
  const dbScenarios = await listScenarios(db);

  for (const scenario of dbScenarios) {
    ids.add(scenario.id);
  }

  return ids;
}
