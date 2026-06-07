import { count, sql } from "drizzle-orm";

import type { AiInvocationCountFilter } from "@/domain/ai-invocation-log";

import type { TalkForgeDatabase } from "../client";
import { aiInvocationLogs } from "../schema";
import { buildAiInvocationLogCountConditions } from "./ai-invocation-log-count-filter";
import { countAiInvocationLogs } from "./ai-invocation-log-repository";

export type AiInvocationAggregateMetrics = {
  totalCalls: number;
  successCount: number;
  failedCount: number;
  timeoutCount: number;
  rateLimitedCount: number;
  avgLatencyMs: number;
  totalCostEstimate: number;
  /** Share of calls that failed, timed out, or were rate-limited. */
  errorRate: number;
};

export type AiInvocationProviderBreakdown = {
  provider: string;
  operation: string;
  totalCalls: number;
  failedCount: number;
  avgLatencyMs: number;
  totalCostEstimate: number;
};

export async function aggregateAiInvocationMetrics(
  db: TalkForgeDatabase,
  filter: AiInvocationCountFilter = {},
): Promise<AiInvocationAggregateMetrics> {
  const where = buildAiInvocationLogCountConditions(filter);
  const baseQuery = db
    .select({
      totalCalls: count(),
      successCount: sql<number>`count(*) filter (where ${aiInvocationLogs.status} = 'success')`,
      failedCount: sql<number>`count(*) filter (where ${aiInvocationLogs.status} = 'failed')`,
      timeoutCount: sql<number>`count(*) filter (where ${aiInvocationLogs.status} = 'timeout')`,
      rateLimitedCount: sql<number>`count(*) filter (where ${aiInvocationLogs.status} = 'rate_limited')`,
      avgLatencyMs: sql<number>`coalesce(avg(${aiInvocationLogs.latencyMs}), 0)`,
      totalCostEstimate: sql<number>`coalesce(sum(${aiInvocationLogs.costEstimate}), 0)`,
    })
    .from(aiInvocationLogs);

  const [row] = where ? await baseQuery.where(where) : await baseQuery;
  const totalCalls = Number(row?.totalCalls ?? 0);
  const failedCount =
    Number(row?.failedCount ?? 0) +
    Number(row?.timeoutCount ?? 0) +
    Number(row?.rateLimitedCount ?? 0);

  return {
    totalCalls,
    successCount: Number(row?.successCount ?? 0),
    failedCount: Number(row?.failedCount ?? 0),
    timeoutCount: Number(row?.timeoutCount ?? 0),
    rateLimitedCount: Number(row?.rateLimitedCount ?? 0),
    avgLatencyMs: Math.round(Number(row?.avgLatencyMs ?? 0)),
    totalCostEstimate: Number(row?.totalCostEstimate ?? 0),
    errorRate: totalCalls > 0 ? failedCount / totalCalls : 0,
  };
}

export async function countAiInvocationLogsBySessionAndOperation(
  db: TalkForgeDatabase,
  sessionId: string,
  operation: AiInvocationCountFilter["operation"],
): Promise<number> {
  if (!operation) {
    return 0;
  }

  return countAiInvocationLogs(db, {
    sessionId,
    operation,
  });
}

export async function listAiInvocationProviderBreakdown(
  db: TalkForgeDatabase,
  filter: AiInvocationCountFilter = {},
  limit = 20,
): Promise<AiInvocationProviderBreakdown[]> {
  const where = buildAiInvocationLogCountConditions(filter);
  const baseQuery = db
    .select({
      provider: aiInvocationLogs.provider,
      operation: aiInvocationLogs.operation,
      totalCalls: count(),
      failedCount: sql<number>`count(*) filter (where ${aiInvocationLogs.status} <> 'success')`,
      avgLatencyMs: sql<number>`coalesce(avg(${aiInvocationLogs.latencyMs}), 0)`,
      totalCostEstimate: sql<number>`coalesce(sum(${aiInvocationLogs.costEstimate}), 0)`,
    })
    .from(aiInvocationLogs)
    .groupBy(aiInvocationLogs.provider, aiInvocationLogs.operation)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  const rows = where ? await baseQuery.where(where) : await baseQuery;

  return rows.map((row) => ({
    provider: row.provider,
    operation: row.operation,
    totalCalls: Number(row.totalCalls ?? 0),
    failedCount: Number(row.failedCount ?? 0),
    avgLatencyMs: Math.round(Number(row.avgLatencyMs ?? 0)),
    totalCostEstimate: Number(row.totalCostEstimate ?? 0),
  }));
}

export async function countReportGenerationAttemptsForSession(
  db: TalkForgeDatabase,
  sessionId: string,
): Promise<number> {
  return countAiInvocationLogsBySessionAndOperation(db, sessionId, "llm.report");
}

export async function countAsrTranscribeAttemptsForSession(
  db: TalkForgeDatabase,
  sessionId: string,
): Promise<number> {
  return countAiInvocationLogsBySessionAndOperation(db, sessionId, "asr.transcribe");
}
