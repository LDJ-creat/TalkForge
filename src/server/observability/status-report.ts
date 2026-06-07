import type { AiInvocationCountFilter } from "@/domain/ai-invocation-log";
import { checkInfrastructureHealth, type InfrastructureHealthReport } from "@/server/infrastructure";
import type { TalkForgeDatabase } from "@/server/db/client";
import {
  aggregateAiInvocationMetrics,
  listAiInvocationProviderBreakdown,
  type AiInvocationAggregateMetrics,
  type AiInvocationProviderBreakdown,
} from "@/server/db/repositories/ai-invocation-metrics-repository";

import { checkConfiguredProviderHealth, type ProviderHealthReport } from "./provider-health";

export type ObservabilityStatusReport = {
  ok: boolean;
  infrastructure: InfrastructureHealthReport;
  providers: ProviderHealthReport;
  aiInvocations: AiInvocationAggregateMetrics;
  providerBreakdown: AiInvocationProviderBreakdown[];
};

export type BuildObservabilityStatusReportOptions = {
  db?: TalkForgeDatabase;
  invocationFilter?: AiInvocationCountFilter;
  breakdownLimit?: number;
};

export async function aggregateAiInvocationMetricsForWindow(
  db: TalkForgeDatabase,
  filter: AiInvocationCountFilter = {},
): Promise<AiInvocationAggregateMetrics> {
  return aggregateAiInvocationMetrics(db, filter);
}

export async function buildObservabilityStatusReport(
  options: BuildObservabilityStatusReportOptions = {},
): Promise<ObservabilityStatusReport> {
  const [infrastructure, providers] = await Promise.all([
    checkInfrastructureHealth(),
    checkConfiguredProviderHealth(),
  ]);

  let aiInvocations: AiInvocationAggregateMetrics = {
    totalCalls: 0,
    successCount: 0,
    failedCount: 0,
    timeoutCount: 0,
    rateLimitedCount: 0,
    avgLatencyMs: 0,
    totalCostEstimate: 0,
    errorRate: 0,
  };
  let providerBreakdown: AiInvocationProviderBreakdown[] = [];

  if (options.db) {
    [aiInvocations, providerBreakdown] = await Promise.all([
      aggregateAiInvocationMetrics(options.db, options.invocationFilter),
      listAiInvocationProviderBreakdown(
        options.db,
        options.invocationFilter,
        options.breakdownLimit ?? 20,
      ),
    ]);
  }

  return {
    ok: infrastructure.ok && providers.ok,
    infrastructure,
    providers,
    aiInvocations,
    providerBreakdown,
  };
}
