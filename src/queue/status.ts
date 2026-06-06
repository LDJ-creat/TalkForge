import type { JobErrorMetadata } from "./errors";
import type { JobName } from "./job-names";
import type { JobPayloadMap } from "./payloads";

export const JOB_STATUSES = [
  "pending",
  "processing",
  "succeeded",
  "failed",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobSnapshot<TName extends JobName = JobName> = {
  id: string;
  name: TName;
  payload: JobPayloadMap[TName];
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error?: JobErrorMetadata;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export type EnqueueOptions = {
  jobId?: string;
  maxAttempts?: number;
  delayMs?: number;
};

export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === "succeeded" || status === "failed";
}
