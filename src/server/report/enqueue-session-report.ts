import type { QueueAdapter } from "@/queue/adapter";
import { enqueueReportGenerateJob } from "@/queue/enqueue";

import { buildReportJobId } from "./constants";

export async function enqueueSessionReportGeneration(
  queueAdapter: QueueAdapter,
  sessionId: string,
) {
  return enqueueReportGenerateJob(
    queueAdapter,
    { sessionId },
    { jobId: buildReportJobId(sessionId) },
  );
}
