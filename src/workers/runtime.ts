import type { Worker } from "bullmq";

import type { QueueAdapter } from "@/queue/adapter";
import {
  isBullMQQueueAdapter,
  type BullMQQueueAdapter,
} from "@/queue/bullmq-adapter";
import { isMemoryQueueAdapter } from "@/queue/memory-adapter";
import type { JobSnapshot } from "@/queue/status";
import type { WorkerRegistry } from "@/queue/worker-types";

export type WorkerRuntimeOptions = {
  adapter: QueueAdapter;
  registry: WorkerRegistry;
};

export type MemoryWorkerRuntime = {
  mode: "memory";
  processNext(): Promise<JobSnapshot | null>;
  processAll(limit?: number): Promise<JobSnapshot[]>;
};

export type BullMQWorkerRuntime = {
  mode: "bullmq";
  start(): Worker;
  stop(): Promise<void>;
};

export type WorkerRuntime = MemoryWorkerRuntime | BullMQWorkerRuntime;

export function createWorkerRuntime(
  options: WorkerRuntimeOptions,
): WorkerRuntime {
  const { adapter, registry } = options;

  if (isMemoryQueueAdapter(adapter)) {
    adapter.registerWorkerRegistry(registry);
    return {
      mode: "memory",
      processNext: () => adapter.processNext(),
      processAll: (limit?: number) => adapter.processAll(limit),
    };
  }

  if (isBullMQQueueAdapter(adapter)) {
    return createBullMQWorkerRuntime({ adapter, registry });
  }

  throw new Error("Unsupported queue adapter for worker runtime.");
}

export function createBullMQWorkerRuntime(options: {
  adapter: BullMQQueueAdapter;
  registry: WorkerRegistry;
}): BullMQWorkerRuntime {
  const { adapter, registry } = options;

  return {
    mode: "bullmq",
    start() {
      return adapter.registerWorkerRegistry(registry);
    },
    async stop() {
      await adapter.close();
    },
  };
}

export async function runMockWorkerCycle(
  options: WorkerRuntimeOptions & { limit?: number },
): Promise<JobSnapshot[]> {
  const runtime = createWorkerRuntime(options);

  if (runtime.mode !== "memory") {
    throw new Error("runMockWorkerCycle requires a memory queue adapter.");
  }

  return runtime.processAll(options.limit);
}

export type { BullMQQueueAdapter, WorkerRegistry };
