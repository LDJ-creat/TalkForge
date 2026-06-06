import { createQueueAdapter } from "@/queue/factory";
import type { QueueAdapter } from "@/queue/adapter";

let queueAdapter: QueueAdapter | undefined;

export function getQueueAdapter(): QueueAdapter {
  queueAdapter ??= createQueueAdapter();
  return queueAdapter;
}

export function resetQueueAdapterForTests(): void {
  queueAdapter = undefined;
}
