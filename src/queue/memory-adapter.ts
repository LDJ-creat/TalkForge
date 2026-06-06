import { randomUUID } from "node:crypto";

import type { QueueAdapter } from "./adapter";
import { resolveQueueConfig, type QueueConfig } from "./config";
import {
  JobProcessingError,
  normalizeJobError,
  shouldRetryJobFailure,
} from "./errors";
import type { JobName } from "./job-names";
import { validateJobPayload } from "./payloads";
import type { EnqueueOptions, JobSnapshot } from "./status";
import type { WorkerRegistry } from "./worker-types";

type InternalJobRecord = JobSnapshot & {
  availableAtMs: number;
};

export type MemoryQueueAdapter = QueueAdapter & {
  registerWorkerRegistry(registry: WorkerRegistry): void;
  processNext(): Promise<JobSnapshot | null>;
  processAll(limit?: number): Promise<JobSnapshot[]>;
};

export type MemoryQueueAdapterOptions = {
  config?: QueueConfig;
  registry?: WorkerRegistry;
  now?: () => Date;
};

export function createMemoryQueueAdapter(
  options: MemoryQueueAdapterOptions = {},
): MemoryQueueAdapter {
  const config = resolveQueueConfig(options.config);
  const jobs = new Map<string, InternalJobRecord>();
  const pendingJobIds: string[] = [];
  let registry = options.registry;
  const now = options.now ?? (() => new Date());

  function timestamp(): string {
    return now().toISOString();
  }

  function toSnapshot<TName extends JobName>(
    record: InternalJobRecord,
  ): JobSnapshot<TName> {
    return {
      id: record.id,
      name: record.name as TName,
      payload: record.payload as JobSnapshot<TName>["payload"],
      status: record.status,
      attempts: record.attempts,
      maxAttempts: record.maxAttempts,
      error: record.error,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
    };
  }

  function enqueuePending(jobId: string, delayMs = 0) {
    const record = jobs.get(jobId);

    if (!record) {
      return;
    }

    record.availableAtMs = now().getTime() + delayMs;
    record.status = "pending";
    record.updatedAt = timestamp();

    if (!pendingJobIds.includes(jobId)) {
      pendingJobIds.push(jobId);
    }
  }

  async function enqueue<TName extends JobName>(
    name: TName,
    payload: JobSnapshot<TName>["payload"],
    enqueueOptions: EnqueueOptions = {},
  ): Promise<JobSnapshot<TName>> {
    const validation = validateJobPayload(name, payload);
    if (!validation.valid) {
      throw new JobProcessingError({
        code: "validation",
        message: validation.errors.map((error) => error.message).join(" "),
        attempts: 0,
        retryable: false,
        metadata: { errors: validation.errors },
      });
    }

    const id = enqueueOptions.jobId ?? randomUUID();
    const existing = jobs.get(id);
    if (
      existing &&
      (existing.status === "pending" || existing.status === "processing")
    ) {
      return toSnapshot(existing);
    }

    const createdAt = timestamp();
    const record: InternalJobRecord = {
      id,
      name,
      payload: validation.payload,
      status: "pending",
      attempts: 0,
      maxAttempts: enqueueOptions.maxAttempts ?? config.defaultMaxAttempts,
      createdAt,
      updatedAt: createdAt,
      availableAtMs: now().getTime() + (enqueueOptions.delayMs ?? 0),
    };

    jobs.set(id, record);
    if (!pendingJobIds.includes(id)) {
      pendingJobIds.push(id);
    }
    return toSnapshot(record);
  }

  async function getJob(jobId: string): Promise<JobSnapshot | null> {
    const record = jobs.get(jobId);
    return record ? toSnapshot(record) : null;
  }

  function pickNextJobId(): string | null {
    const currentTime = now().getTime();

    for (let index = 0; index < pendingJobIds.length; index += 1) {
      const jobId = pendingJobIds[index];
      const record = jobs.get(jobId);

      if (!record || record.status !== "pending") {
        pendingJobIds.splice(index, 1);
        index -= 1;
        continue;
      }

      if (record.availableAtMs <= currentTime) {
        pendingJobIds.splice(index, 1);
        return jobId;
      }
    }

    return null;
  }

  async function processNext(): Promise<JobSnapshot | null> {
    const jobId = pickNextJobId();
    if (!jobId) {
      return null;
    }

    const record = jobs.get(jobId);
    if (!record) {
      return null;
    }

    record.status = "processing";
    record.attempts += 1;
    record.startedAt = record.startedAt ?? timestamp();
    record.updatedAt = timestamp();

    const handler = registry?.getHandler(record.name);
    if (!handler) {
      const error = new JobProcessingError({
        code: "handler_missing",
        message: `No worker registered for job "${record.name}".`,
        attempts: record.attempts,
        retryable: false,
      });
      record.status = "failed";
      record.finishedAt = timestamp();
      record.error = normalizeJobError(error, { attempts: record.attempts });
      record.updatedAt = timestamp();
      return toSnapshot(record);
    }

    try {
      await handler(record.payload, {
        jobId: record.id,
        attempts: record.attempts,
        maxAttempts: record.maxAttempts,
      });
      record.status = "succeeded";
      record.finishedAt = timestamp();
      record.error = undefined;
      record.updatedAt = timestamp();
      return toSnapshot(record);
    } catch (error) {
      const normalized = normalizeJobError(error, {
        attempts: record.attempts,
      });

      if (shouldRetryJobFailure(error, record.attempts, record.maxAttempts)) {
        enqueuePending(record.id, config.defaultBackoffDelayMs);
        record.error = normalized;
        record.updatedAt = timestamp();
        return toSnapshot(record);
      }

      record.status = "failed";
      record.finishedAt = timestamp();
      record.error = normalized;
      record.updatedAt = timestamp();
      return toSnapshot(record);
    }
  }

  async function processAll(limit = Number.POSITIVE_INFINITY): Promise<JobSnapshot[]> {
    const processed: JobSnapshot[] = [];

    while (processed.length < limit) {
      const snapshot = await processNext();
      if (!snapshot) {
        break;
      }
      processed.push(snapshot);
    }

    return processed;
  }

  async function close(): Promise<void> {
    jobs.clear();
    pendingJobIds.length = 0;
  }

  return {
    enqueue,
    getJob,
    close,
    registerWorkerRegistry(nextRegistry: WorkerRegistry) {
      registry = nextRegistry;
    },
    processNext,
    processAll,
  };
}

export function isMemoryQueueAdapter(
  adapter: QueueAdapter,
): adapter is MemoryQueueAdapter {
  return (
    "processNext" in adapter &&
    "processAll" in adapter &&
    "registerWorkerRegistry" in adapter
  );
}
