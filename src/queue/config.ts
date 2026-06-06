export type QueueConfig = {
  redisUrl?: string;
  prefix?: string;
  queueName?: string;
  defaultMaxAttempts?: number;
  defaultBackoffDelayMs?: number;
};

export const DEFAULT_QUEUE_CONFIG: Required<
  Pick<
    QueueConfig,
    "prefix" | "queueName" | "defaultMaxAttempts" | "defaultBackoffDelayMs"
  >
> = {
  prefix: "talkforge",
  queueName: "background-jobs",
  defaultMaxAttempts: 3,
  defaultBackoffDelayMs: 1_000,
};

export function resolveQueueConfig(config: QueueConfig = {}): QueueConfig & {
  prefix: string;
  queueName: string;
  defaultMaxAttempts: number;
  defaultBackoffDelayMs: number;
} {
  return {
    ...DEFAULT_QUEUE_CONFIG,
    ...config,
  };
}
