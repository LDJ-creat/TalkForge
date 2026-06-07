import type { Worker } from "bullmq";

import { isBullMQQueueAdapter } from "@/queue/bullmq-adapter";
import { getRuntimeConfig } from "@/server/config";
import { getQueueAdapter } from "@/server/queue/provider";

import { createP0WorkerRegistry } from "./create-p0-worker-registry";
import { createWorkerRuntime } from "./runtime";

export type BullMQWorkerProcess = {
  worker: Worker;
  stop(): Promise<void>;
};

export function assertBullMQWorkerRuntime(): void {
  const { providers } = getRuntimeConfig();

  if (providers.queue.name !== "redis") {
    throw new Error(
      'BullMQ worker requires QUEUE_PROVIDER="redis" and REDIS_URL to be configured.',
    );
  }
}

export function startBullMQWorkerProcess(): BullMQWorkerProcess {
  assertBullMQWorkerRuntime();

  const adapter = getQueueAdapter();
  if (!isBullMQQueueAdapter(adapter)) {
    throw new Error("Queue adapter is not configured for BullMQ processing.");
  }

  const registry = createP0WorkerRegistry();
  const runtime = createWorkerRuntime({ adapter, registry });

  if (runtime.mode !== "bullmq") {
    throw new Error("Failed to initialize BullMQ worker runtime.");
  }

  const worker = runtime.start();

  return {
    worker,
    stop: () => runtime.stop(),
  };
}
