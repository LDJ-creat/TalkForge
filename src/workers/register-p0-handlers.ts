import type { QueueAdapter } from "@/queue/adapter";
import type { WorkerRegistry } from "@/queue/worker-types";
import type { TalkForgeDatabase } from "@/server/db/client";
import type { AsrProvider } from "@/providers/asr/contract";
import type { LlmCorrectionProvider } from "@/providers/llm/contract";

import { registerAsrTranscribeWorker } from "./handlers/asr-transcribe";
import { registerCorrectionAnalyzeWorker } from "./handlers/correction-analyze";

export type RegisterP0WorkerHandlersOptions = {
  db: TalkForgeDatabase;
  queueAdapter?: QueueAdapter;
  asrProvider?: AsrProvider;
  llmCorrectionProvider?: LlmCorrectionProvider;
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

  registerCorrectionAnalyzeWorker(registry, {
    db: options.db,
    llmProvider: options.llmCorrectionProvider,
  });

  return registry;
}
