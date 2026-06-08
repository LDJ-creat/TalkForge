import { describe, expect, it } from "vitest";

import type { Report } from "@/domain/report";
import { REPORT_GENERATING_MARKER } from "@/server/report/constants";
import { resolveSessionReportAvailability } from "@/server/report/resolve-report-status";
import { createMemoryQueueAdapter } from "@/queue/memory-adapter";
import { createWorkerRegistry } from "@/workers";
import { enqueueSessionReportGeneration } from "@/server/report/enqueue-session-report";

function buildPlaceholderReport(createdAt: string): Report {
  return {
    id: "report-id",
    sessionId: "session-id",
    summary: REPORT_GENERATING_MARKER,
    taskCompletion: { completedGoalIds: [], missingGoalIds: [] },
    keyCorrections: [],
    alternativeExpressions: [],
    shadowingRecommendations: [],
    nextPracticeSuggestion: REPORT_GENERATING_MARKER,
    createdAt,
  };
}

describe("resolveSessionReportAvailability", () => {
  it("marks recent placeholders as generating", () => {
    const result = resolveSessionReportAvailability(
      buildPlaceholderReport(new Date().toISOString()),
    );

    expect(result.status).toBe("generating");
  });

  it("marks stale placeholders as failed", () => {
    const result = resolveSessionReportAvailability(
      buildPlaceholderReport("2026-06-01T00:00:00.000Z"),
      { now: () => new Date("2026-06-06T00:00:00.000Z") },
    );

    expect(result.status).toBe("failed");
  });

  it("treats a restarted placeholder as generating even when previously stale", () => {
    const restartedAt = "2026-06-08T07:54:00.000Z";
    const result = resolveSessionReportAvailability(
      buildPlaceholderReport(restartedAt),
      { now: () => new Date("2026-06-08T07:54:30.000Z") },
    );

    expect(result.status).toBe("generating");
  });
});

describe("enqueueSessionReportGeneration", () => {
  it("replaces a terminal report job so retries can run again", async () => {
    const registry = createWorkerRegistry();
    registry.handlers.reportGenerate(async () => {
      // no-op
    });

    const adapter = createMemoryQueueAdapter({ registry });
    const sessionId = "11111111-1111-4111-8111-111111111111";

    await enqueueSessionReportGeneration(adapter, sessionId);
    await adapter.processAll();

    const failedSnapshot = await adapter.getJob(`report-${sessionId}`);
    expect(failedSnapshot?.status).toBe("succeeded");

    await enqueueSessionReportGeneration(adapter, sessionId);
    const pendingSnapshot = await adapter.getJob(`report-${sessionId}`);
    expect(pendingSnapshot?.status).toBe("pending");
    expect(pendingSnapshot?.attempts).toBe(0);
  });
});
