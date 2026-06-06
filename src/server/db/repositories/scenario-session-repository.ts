import { eq } from "drizzle-orm";

import type { CreateSessionInput } from "@/domain/session";

import type { TalkForgeDatabase } from "../client";
import { fromScenario, toScenario, toSession } from "../mappers";
import { scenarios, sessions } from "../schema";
import { createInitialScenarioProgressForSession } from "./scenario-progress-repository";

export async function listScenarios(db: TalkForgeDatabase) {
  const rows = await db.select().from(scenarios);
  return rows.map(toScenario);
}

export async function getScenarioById(db: TalkForgeDatabase, scenarioId: string) {
  const [row] = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, scenarioId))
    .limit(1);

  return row ? toScenario(row) : null;
}

export async function upsertScenario(
  db: TalkForgeDatabase,
  scenario: Parameters<typeof fromScenario>[0],
) {
  const values = fromScenario(scenario);
  const [row] = await db
    .insert(scenarios)
    .values(values)
    .onConflictDoUpdate({
      target: scenarios.id,
      set: {
        title: values.title,
        description: values.description,
        level: values.level,
        userRole: values.userRole,
        aiRole: values.aiRole,
        situation: values.situation,
        mission: values.mission,
        goals: values.goals,
        stages: values.stages,
        vocabulary: values.vocabulary,
        targetExpressions: values.targetExpressions,
        constraints: values.constraints,
        exitPolicy: values.exitPolicy,
        evaluationRubric: values.evaluationRubric,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning();

  return toScenario(row);
}

export async function createSession(
  db: TalkForgeDatabase,
  input: CreateSessionInput,
) {
  const [row] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      scenarioId: input.scenarioId,
      realtimeProvider: input.realtimeProvider,
      realtimeProviderSessionId: input.realtimeProviderSessionId,
    })
    .returning();

  const session = toSession(row);
  const scenario = await getScenarioById(db, input.scenarioId);
  if (scenario) {
    await createInitialScenarioProgressForSession(db, session.id, scenario);
  }

  return session;
}

export async function getSessionById(db: TalkForgeDatabase, sessionId: string) {
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return row ? toSession(row) : null;
}

export async function updateSessionRealtimeProviderSessionId(
  db: TalkForgeDatabase,
  sessionId: string,
  realtimeProviderSessionId: string,
) {
  const [row] = await db
    .update(sessions)
    .set({ realtimeProviderSessionId })
    .where(eq(sessions.id, sessionId))
    .returning();

  return row ? toSession(row) : null;
}

export async function failSession(
  db: TalkForgeDatabase,
  sessionId: string,
  endedAt?: string,
) {
  const resolvedEndedAt = endedAt ?? new Date().toISOString();
  const [row] = await db
    .update(sessions)
    .set({
      status: "failed",
      endedAt: resolvedEndedAt,
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  return row ? toSession(row) : null;
}

export async function completeSession(
  db: TalkForgeDatabase,
  sessionId: string,
  endedAt?: string,
) {
  const resolvedEndedAt = endedAt ?? new Date().toISOString();
  const [row] = await db
    .update(sessions)
    .set({
      status: "completed",
      endedAt: resolvedEndedAt,
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (row) {
    return toSession(row);
  }

  const [existing] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return existing ? toSession(existing) : null;
}
