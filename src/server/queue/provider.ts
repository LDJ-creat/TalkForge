import { createQueueAdapter } from "@/queue/factory";
import type { QueueAdapter } from "@/queue/adapter";
import { getRuntimeConfig } from "@/server/config";

let queueAdapter: QueueAdapter | undefined;

export function getQueueAdapter(): QueueAdapter {
  if (!queueAdapter) {
    const { providers, secrets } = getRuntimeConfig();
    queueAdapter = createQueueAdapter({
      config:
        providers.queue.name === "redis"
          ? { redisUrl: secrets.redisUrl }
          : undefined,
    });
  }
  return queueAdapter;
}

export function resetQueueAdapterForTests(): void {
  queueAdapter = undefined;
}
