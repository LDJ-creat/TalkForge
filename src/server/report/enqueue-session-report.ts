import type { QueueAdapter } from "@/queue/adapter";
import { enqueueReportGenerateJob } from "@/queue/enqueue";

import { buildReportJobId } from "./constants";
import { clearStaleReportJob } from "./clear-stale-report-job";

export async function enqueueSessionReportGeneration(
  queueAdapter: QueueAdapter,
  sessionId: string,
) {
  const jobId = buildReportJobId(sessionId);
  await clearStaleReportJob(queueAdapter, sessionId);

  return enqueueReportGenerateJob(
    queueAdapter,
    { sessionId },
    { jobId },
  );
}
