import type { TalkForgeDatabase } from "../client";
import { upsertScenario } from "../repositories/scenario-session-repository";
import { ensureUserExists } from "../repositories/user-repository";
import { seedScenarios } from "./scenarios";
import { DEV_USER_ID } from "@/shared/dev-user";

export type BootstrapDevDataResult = {
  userId: string;
  scenarioCount: number;
};

export async function bootstrapDevData(
  db: TalkForgeDatabase,
  userId = DEV_USER_ID,
): Promise<BootstrapDevDataResult> {
  await ensureUserExists(db, userId);

  for (const scenario of seedScenarios) {
    await upsertScenario(db, scenario);
  }

  return {
    userId,
    scenarioCount: seedScenarios.length,
  };
}
