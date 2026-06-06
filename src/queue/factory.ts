import { createBullMQQueueAdapter } from "./bullmq-adapter";
import type { QueueAdapter } from "./adapter";
import { resolveQueueConfig, type QueueConfig } from "./config";
import { createMemoryQueueAdapter } from "./memory-adapter";
import type { JobSnapshot } from "./status";
import type { WorkerRegistry } from "./worker-types";

export type CreateQueueAdapterOptions = {
  config?: QueueConfig;
  registry?: WorkerRegistry;
  forceMemory?: boolean;
};

export function createQueueAdapter(options: CreateQueueAdapterOptions = {}) {
  const config = resolveQueueConfig(options.config);

  if (!options.forceMemory && config.redisUrl) {
    return createBullMQQueueAdapter({
      config,
      registry: options.registry,
    });
  }

  return createMemoryQueueAdapter({
    config,
    registry: options.registry,
  });
}

/** Read-only job status lookup by job id (P0: backed by queue adapter, not PostgreSQL). */
export type JobStatusQuery = {
  getJob(jobId: string): Promise<JobSnapshot | null>;
};

export function createJobStatusQuery(adapter: QueueAdapter): JobStatusQuery {
  return {
    getJob(jobId: string) {
      return adapter.getJob(jobId);
    },
  };
}

/** @deprecated Use createJobStatusQuery. */
export const createJobStatusStore = createJobStatusQuery;

export type JobStatusStore = JobStatusQuery;
