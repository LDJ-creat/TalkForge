import type { QueueAdapter } from "@/queue/adapter";
import type { WorkerRegistry } from "@/queue/worker-types";
import type { TalkForgeDatabase } from "@/server/db/client";
import type { AsrProvider } from "@/providers/asr/contract";

import { registerAsrTranscribeWorker } from "./handlers/asr-transcribe";

export type RegisterP0WorkerHandlersOptions = {
  db: TalkForgeDatabase;
  queueAdapter?: QueueAdapter;
  asrProvider?: AsrProvider;
};

export function registerP0WorkerHandlers(
  registry: WorkerRegistry,
  options: RegisterP0WorkerHandlersOptions,
) {
  registerAsrTranscribeWorker(registry, {
    db: options.db,
    queueAdapter: options.queueAdapter,
    asrProvider: options.asrProvider,
  });

  return registry;
}
