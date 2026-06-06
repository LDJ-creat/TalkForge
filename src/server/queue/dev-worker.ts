import { isMemoryQueueAdapter } from "@/queue/memory-adapter";
import { createWorkerRegistry } from "@/queue/worker-types";
import { getAsrProvider } from "@/server/asr/provider";
import { getDb } from "@/server/db/client";
import { getLlmCorrectionProvider } from "@/server/correction/provider";
import { logJobLifecycle } from "@/server/observability/log";
import { getPronunciationProvider } from "@/server/pronunciation/provider";
import { getLlmReportProvider } from "@/server/report/provider";
import { getGoalJudgeProvider } from "@/server/scenario-progress/provider";
import { registerP0WorkerHandlers } from "@/workers/register-p0-handlers";

import { getQueueAdapter } from "./provider";

let workersRegistered = false;

function shouldAutoProcessJobs(): boolean {
  return !process.env.REDIS_URL;
}

export function ensureP0WorkersRegistered(): void {
  if (workersRegistered) {
    return;
  }

  const adapter = getQueueAdapter();
  if (!isMemoryQueueAdapter(adapter)) {
    return;
  }

  const registry = createWorkerRegistry();
  registerP0WorkerHandlers(registry, {
    db: getDb(),
    queueAdapter: adapter,
    asrProvider: getAsrProvider(),
    llmCorrectionProvider: getLlmCorrectionProvider(),
    llmReportProvider: getLlmReportProvider(),
    llmGoalJudgeProvider: getGoalJudgeProvider(),
    pronunciationProvider: getPronunciationProvider(),
  });

  adapter.registerWorkerRegistry(registry);
  workersRegistered = true;
  logJobLifecycle("workers_registered", { jobName: "p0" });
}

export async function processEnqueuedJobs(): Promise<number> {
  if (!shouldAutoProcessJobs()) {
    return 0;
  }

  const adapter = getQueueAdapter();
  if (!isMemoryQueueAdapter(adapter)) {
    return 0;
  }

  ensureP0WorkersRegistered();

  const processed = await adapter.processAll();
  if (processed.length > 0) {
    logJobLifecycle("batch_processed", {
      jobName: "p0",
      count: processed.length,
    });
  }

  return processed.length;
}

export async function processEnqueuedJobsSafely(): Promise<number> {
  try {
    return await processEnqueuedJobs();
  } catch (error) {
    console.error("[talkforge:job] batch_failed", error);
    return 0;
  }
}

export function resetDevWorkerStateForTests(): void {
  workersRegistered = false;
}
