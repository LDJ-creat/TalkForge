import type { QueueAdapter } from "@/queue/adapter";
import type { Report } from "@/domain/report";
import type { ShadowingItem } from "@/domain/shadowing";
import { isReportGenerationComplete } from "@/server/report/report-status";

import { buildShadowingJobId } from "./constants";
import { enqueueSessionShadowingGeneration } from "./enqueue-session-shadowing";

/** Removes terminal BullMQ jobs so shadowing.generate can be re-enqueued with the same id. */
export async function clearStaleShadowingJob(
  queueAdapter: QueueAdapter,
  sessionId: string,
): Promise<void> {
  const jobId = buildShadowingJobId(sessionId);
  const existing = await queueAdapter.getJob(jobId);

  if (!existing) {
    return;
  }

  if (existing.status === "pending" || existing.status === "processing") {
    return;
  }

  if (queueAdapter.removeJob) {
    await queueAdapter.removeJob(jobId);
  }
}

export async function ensureSessionShadowingGeneration(input: {
  sessionId: string;
  report: Report;
  shadowingItems: ShadowingItem[];
  queueAdapter: QueueAdapter;
}): Promise<{ enqueued: boolean }> {
  if (input.shadowingItems.length > 0) {
    return { enqueued: false };
  }

  if (!isReportGenerationComplete(input.report)) {
    return { enqueued: false };
  }

  if (input.report.shadowingRecommendations.length === 0) {
    return { enqueued: false };
  }

  await clearStaleShadowingJob(input.queueAdapter, input.sessionId);
  await enqueueSessionShadowingGeneration(input.queueAdapter, input.sessionId);
  return { enqueued: true };
}
