import { eq } from "drizzle-orm";

import type { ScenarioProgress, UpdateScenarioProgressInput } from "@/domain/scenario-progress";
import type { Scenario } from "@/domain/scenario";
import { createInitialScenarioProgress } from "@/domain/scenario-ending";

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

export async function upsertScenarioProgress(
  db: TalkForgeDatabase,
  sessionId: string,
  input: ScenarioProgress | UpdateScenarioProgressInput,
): Promise<ScenarioProgress> {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const [row] = await db
    .insert(scenarioProgress)
    .values({
      sessionId,
      currentStageId: input.currentStageId ?? "unknown",
      completedGoalIds: input.completedGoalIds ?? [],
      missingGoalIds: input.missingGoalIds ?? [],
      shouldSuggestEnding: input.shouldSuggestEnding ?? false,
      offTopic: input.offTopic ?? false,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: scenarioProgress.sessionId,
      set: {
        currentStageId: input.currentStageId ?? "unknown",
        completedGoalIds: input.completedGoalIds ?? [],
        missingGoalIds: input.missingGoalIds ?? [],
        shouldSuggestEnding: input.shouldSuggestEnding ?? false,
        offTopic: input.offTopic ?? false,
        updatedAt,
      },
    })
    .returning();

  return toScenarioProgress(row);
}

export async function createInitialScenarioProgressForSession(
  db: TalkForgeDatabase,
  sessionId: string,
  scenario: Scenario,
): Promise<ScenarioProgress> {
  const initial = createInitialScenarioProgress(sessionId, scenario);
  return upsertScenarioProgress(db, sessionId, initial);
}
