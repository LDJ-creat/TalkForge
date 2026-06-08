import { Queue, Worker } from "bullmq";

import type { QueueAdapter } from "./adapter";
import { resolveQueueConfig, type QueueConfig } from "./config";
import { JobProcessingError, normalizeJobError } from "./errors";
import type { JobName } from "./job-names";
import { validateJobPayload, type JobPayloadMap } from "./payloads";
import type { EnqueueOptions, JobSnapshot, JobStatus } from "./status";
import type { WorkerRegistry } from "./worker-types";

type BullMQJobData = {
  name: JobName;
  payload: JobPayloadMap[JobName];
};

export type BullMQQueueAdapter = QueueAdapter & {
  registerWorkerRegistry(registry: WorkerRegistry): Worker;
  startWorker(): Worker;
};

export type BullMQQueueAdapterOptions = {
  config: QueueConfig;
  registry?: WorkerRegistry;
  queueFactory?: typeof Queue;
  workerFactory?: typeof Worker;
};

function mapBullMQState(state: string, failedReason?: string | null): JobStatus {
  switch (state) {
    case "completed":
      return "succeeded";
    case "failed":
      return "failed";
    case "active":
      return "processing";
    default:
      return failedReason ? "failed" : "pending";
  }
}

export function createBullMQQueueAdapter(
  options: BullMQQueueAdapterOptions,
): BullMQQueueAdapter {
  const config = resolveQueueConfig(options.config);
  if (!config.redisUrl) {
    throw new Error("BullMQ queue adapter requires redisUrl.");
  }

  const QueueCtor = options.queueFactory ?? Queue;
  const WorkerCtor = options.workerFactory ?? Worker;

  const connection = {
    url: config.redisUrl,
    maxRetriesPerRequest: null,
  };

  const queue = new QueueCtor<BullMQJobData>(config.queueName, {
    connection,
    prefix: config.prefix,
  });

  let worker: Worker<BullMQJobData> | undefined;
  let registry = options.registry;

  function buildEnqueueOptions(enqueueOptions: EnqueueOptions = {}) {
    return {
      jobId: enqueueOptions.jobId,
      attempts: enqueueOptions.maxAttempts ?? config.defaultMaxAttempts,
      backoff: {
        type: "exponential" as const,
        delay: config.defaultBackoffDelayMs,
      },
      delay: enqueueOptions.delayMs,
    };
  }

  async function enqueue<TName extends JobName>(
    name: TName,
    payload: JobPayloadMap[TName],
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

    const job = await queue.add(
      name,
      { name, payload: validation.payload },
      buildEnqueueOptions(enqueueOptions),
    );

    const snapshot = await getJob(job.id!);
    if (!snapshot) {
      throw new Error(`Failed to load enqueued job "${job.id}".`);
    }

    return snapshot as JobSnapshot<TName>;
  }

  async function removeJob(jobId: string): Promise<void> {
    const job = await queue.getJob(jobId);
    if (!job) {
      return;
    }

    await job.remove();
  }

  async function getJob(jobId: string): Promise<JobSnapshot | null> {
    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const data = job.data;
    const failedReason = job.failedReason;
    const status = mapBullMQState(state, failedReason);

    return {
      id: job.id!,
      name: data.name,
      payload: data.payload,
      status,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? config.defaultMaxAttempts,
      error:
        status === "failed"
          ? normalizeJobError(new Error(failedReason ?? "Background job failed."), {
              attempts: job.attemptsMade,
            })
          : undefined,
      createdAt: new Date(job.timestamp).toISOString(),
      updatedAt: new Date(job.processedOn ?? job.timestamp).toISOString(),
      startedAt: job.processedOn
        ? new Date(job.processedOn).toISOString()
        : undefined,
      finishedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : undefined,
    };
  }

  function startWorker(): Worker<BullMQJobData> {
    if (worker) {
      return worker;
    }

    worker = new WorkerCtor<BullMQJobData>(
      config.queueName,
      async (job) => {
        const handler = registry?.getHandler(job.data.name);
        if (!handler) {
          throw new JobProcessingError({
            code: "handler_missing",
            message: `No worker registered for job "${job.data.name}".`,
            attempts: job.attemptsMade + 1,
            retryable: false,
          });
        }

        await handler(job.data.payload, {
          jobId: job.id!,
          attempts: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts ?? config.defaultMaxAttempts,
        });
      },
      {
        connection,
        prefix: config.prefix,
      },
    );

    return worker;
  }

  function registerWorkerRegistry(nextRegistry: WorkerRegistry): Worker {
    registry = nextRegistry;
    return startWorker();
  }

  async function close(): Promise<void> {
    await worker?.close();
    await queue.close();
  }

  return {
    enqueue,
    getJob,
    removeJob,
    close,
    registerWorkerRegistry,
    startWorker,
  };
}

export function isBullMQQueueAdapter(
  adapter: QueueAdapter,
): adapter is BullMQQueueAdapter {
  return "startWorker" in adapter && "registerWorkerRegistry" in adapter;
}
