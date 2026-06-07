import { and, eq, gte, lte, type SQL } from "drizzle-orm";

import type { AiInvocationCountFilter } from "@/domain/ai-invocation-log";

import { aiInvocationLogs } from "../schema";

export type AiInvocationLogCountRow = {
  provider: string;
  model: string;
  operation: string;
  sessionId?: string | null;
  createdAt: string;
};

export function matchesAiInvocationCountFilter(
  row: AiInvocationLogCountRow,
  filter: AiInvocationCountFilter,
): boolean {
  if (filter.provider && row.provider !== filter.provider) {
    return false;
  }
  if (filter.model && row.model !== filter.model) {
    return false;
  }
  if (filter.operation && row.operation !== filter.operation) {
    return false;
  }
  if (filter.sessionId && row.sessionId !== filter.sessionId) {
    return false;
  }
  if (filter.from && row.createdAt < filter.from) {
    return false;
  }
  if (filter.to && row.createdAt > filter.to) {
    return false;
  }
  return true;
}

export function buildAiInvocationLogCountConditions(
  filter: AiInvocationCountFilter,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (filter.provider) {
    conditions.push(eq(aiInvocationLogs.provider, filter.provider));
  }
  if (filter.model) {
    conditions.push(eq(aiInvocationLogs.model, filter.model));
  }
  if (filter.operation) {
    conditions.push(eq(aiInvocationLogs.operation, filter.operation));
  }
  if (filter.sessionId) {
    conditions.push(eq(aiInvocationLogs.sessionId, filter.sessionId));
  }
  if (filter.from) {
    conditions.push(gte(aiInvocationLogs.createdAt, filter.from));
  }
  if (filter.to) {
    conditions.push(lte(aiInvocationLogs.createdAt, filter.to));
  }

  if (conditions.length === 0) {
    return undefined;
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  return and(...conditions);
}
