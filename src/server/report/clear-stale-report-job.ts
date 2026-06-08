import type { QueueAdapter } from "@/queue/adapter";

import { buildReportJobId } from "./constants";

/** Removes terminal BullMQ jobs so report.generate can be re-enqueued with the same id. */
export async function clearStaleReportJob(
  queueAdapter: QueueAdapter,
  sessionId: string,
): Promise<void> {
  const jobId = buildReportJobId(sessionId);
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
