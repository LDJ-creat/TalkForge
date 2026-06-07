import type { QueueAdapter } from "@/queue/adapter";
import { enqueueShadowingGenerateJob } from "@/queue/enqueue";

import { buildShadowingJobId } from "./constants";

export async function enqueueSessionShadowingGeneration(
  queueAdapter: QueueAdapter,
  sessionId: string,
) {
  return enqueueShadowingGenerateJob(
    queueAdapter,
    { sessionId },
    { jobId: buildShadowingJobId(sessionId) },
  );
}
