import { eq } from "drizzle-orm";

import type { TalkForgeDatabase } from "../client";
import { toScenarioProgress } from "../mappers";
import { scenarioProgress } from "../schema";

export async function getScenarioProgressBySessionId(
  db: TalkForgeDatabase,
  sessionId: string,
) {
  const [row] = await db
    .select()
    .from(scenarioProgress)
    .where(eq(scenarioProgress.sessionId, sessionId))
    .limit(1);

  return row ? toScenarioProgress(row) : null;
}
