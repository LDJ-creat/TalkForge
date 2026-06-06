import { getSeedScenarioById } from "@/server/scenario/catalog";

import type { TalkForgeDatabase } from "../client";
import { getScenarioById, upsertScenario } from "../repositories/scenario-session-repository";
import { ensureUserExists } from "../repositories/user-repository";

export async function ensureDevSessionPrerequisites(
  db: TalkForgeDatabase,
  userId: string,
  scenarioId: string,
): Promise<void> {
  await ensureUserExists(db, userId);

  const existingScenario = await getScenarioById(db, scenarioId);
  if (existingScenario) {
    return;
  }

  const seedScenario = getSeedScenarioById(scenarioId);
  if (seedScenario) {
    await upsertScenario(db, seedScenario);
  }
}
