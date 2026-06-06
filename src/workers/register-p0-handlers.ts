import type { QueueAdapter } from "@/queue/adapter";
import type { WorkerRegistry } from "@/queue/worker-types";
import type { TalkForgeDatabase } from "@/server/db/client";
import type { AsrProvider } from "@/providers/asr/contract";
import type { LlmCorrectionProvider, LlmReportProvider } from "@/providers/llm/contract";
import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";

import { registerAsrTranscribeWorker } from "./handlers/asr-transcribe";
import { registerCorrectionAnalyzeWorker } from "./handlers/correction-analyze";
import { registerEvaluationFreeSpeechWorker } from "./handlers/evaluation-free-speech";
import { registerReportGenerateWorker } from "./handlers/report-generate";

export type RegisterP0WorkerHandlersOptions = {
  db: TalkForgeDatabase;
  queueAdapter?: QueueAdapter;
  asrProvider?: AsrProvider;
  llmCorrectionProvider?: LlmCorrectionProvider;
  llmReportProvider?: LlmReportProvider;
  pronunciationProvider?: PronunciationEvaluationProvider;
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

  registerEvaluationFreeSpeechWorker(registry, {
    db: options.db,
    pronunciationProvider: options.pronunciationProvider,
  });

  registerReportGenerateWorker(registry, {
    db: options.db,
    llmProvider: options.llmReportProvider,
  });

  return registry;
}
