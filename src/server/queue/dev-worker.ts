import { isMemoryQueueAdapter } from "@/queue/memory-adapter";
import { getRuntimeConfig } from "@/server/config";
import { logJobLifecycle } from "@/server/observability/log";
import { createP0WorkerRegistry } from "@/workers/create-p0-worker-registry";

import { getQueueAdapter } from "./provider";

let workersRegistered = false;

function shouldAutoProcessJobs(): boolean {
  return getRuntimeConfig().providers.queue.name === "memory";
}

export function ensureP0WorkersRegistered(): void {
  if (workersRegistered) {
    return;
  }

  const adapter = getQueueAdapter();
  if (!isMemoryQueueAdapter(adapter)) {
    return;
  }

  const registry = createP0WorkerRegistry({ queueAdapter: adapter });
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
