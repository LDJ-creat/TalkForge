import { count, eq, sql } from "drizzle-orm";

import type {
  AiInvocationCountFilter,
  AiInvocationLog,
  CreateAiInvocationLogInput,
} from "@/domain/ai-invocation-log";

import type { TalkForgeDatabase } from "../client";
import { toAiInvocationLog } from "../mappers";
import { aiInvocationLogs } from "../schema";
import { buildAiInvocationLogCountConditions } from "./ai-invocation-log-count-filter";

export { buildAiInvocationLogCountConditions, matchesAiInvocationCountFilter } from "./ai-invocation-log-count-filter";

export async function createAiInvocationLog(
  db: TalkForgeDatabase,
  input: CreateAiInvocationLogInput & { id?: string },
): Promise<AiInvocationLog> {
  const [row] = await db
    .insert(aiInvocationLogs)
    .values({
      id: input.id,
      sessionId: input.sessionId,
      turnId: input.turnId,
      jobId: input.jobId,
      provider: input.provider,
      model: input.model,
      operation: input.operation,
      promptVersion: input.promptVersion,
      inputObjectKey: input.inputObjectKey,
      outputObjectKey: input.outputObjectKey,
      requestSummary: input.requestSummary,
      responseSummary: input.responseSummary,
      rawRequestObjectKey: input.rawRequestObjectKey,
      rawResponseObjectKey: input.rawResponseObjectKey,
      status: input.status,
      latencyMs: input.latencyMs,
      retryCount: input.retryCount,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      audioDurationMs: input.audioDurationMs,
      costEstimate: input.costEstimate,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    })
    .returning();

  return toAiInvocationLog(row);
}

export async function countAiInvocationLogs(
  db: TalkForgeDatabase,
  filter: AiInvocationCountFilter = {},
): Promise<number> {
  const where = buildAiInvocationLogCountConditions(filter);
  const query = db.select({ value: count() }).from(aiInvocationLogs);
  const [row] = where ? await query.where(where) : await query;
  return Number(row?.value ?? 0);
}

export async function listAiInvocationLogsBySessionId(
  db: TalkForgeDatabase,
  sessionId: string,
  limit = 100,
): Promise<AiInvocationLog[]> {
  const rows = await db
    .select()
    .from(aiInvocationLogs)
    .where(eq(aiInvocationLogs.sessionId, sessionId))
    .orderBy(sql`${aiInvocationLogs.createdAt} desc`)
    .limit(limit);

  return rows.map(toAiInvocationLog);
}

export async function getAiInvocationLogById(
  db: TalkForgeDatabase,
  id: string,
): Promise<AiInvocationLog | null> {
  const [row] = await db
    .select()
    .from(aiInvocationLogs)
    .where(eq(aiInvocationLogs.id, id))
    .limit(1);

  return row ? toAiInvocationLog(row) : null;
}
