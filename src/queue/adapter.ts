import { resolveQueueConfig, type QueueConfig } from "./config";
import type { JobName } from "./job-names";
import type { JobPayloadMap } from "./payloads";
import type { EnqueueOptions, JobSnapshot } from "./status";

export type QueueAdapter = {
  enqueue<TName extends JobName>(
    name: TName,
    payload: JobPayloadMap[TName],
    options?: EnqueueOptions,
  ): Promise<JobSnapshot<TName>>;
  getJob(jobId: string): Promise<JobSnapshot | null>;
  /** Optional: remove a job by id (used to re-enqueue terminal report jobs). */
  removeJob?(jobId: string): Promise<void>;
  close(): Promise<void>;
};

export type ResolvedQueueConfig = ReturnType<typeof resolveQueueConfig>;
