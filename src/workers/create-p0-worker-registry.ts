import { createWorkerRegistry } from "@/queue/worker-types";
import type { WorkerRegistry } from "@/queue/worker-types";
import { createAiInvocationTraceService } from "@/server/ai-tracing";
import { getAsrProvider } from "@/server/asr/provider";
import { getLlmCorrectionProvider } from "@/server/correction/provider";
import { getDb } from "@/server/db/client";
import { getFreeSpeechPronunciationProvider, getShadowingPronunciationProvider } from "@/server/pronunciation/provider";
import { getLlmReportProvider } from "@/server/report/provider";
import { getGoalJudgeProvider } from "@/server/scenario-progress/provider";
import { getQueueAdapter } from "@/server/queue/provider";
import { getTtsProvider } from "@/server/tts/provider";

import {
  registerP0WorkerHandlers,
  type RegisterP0WorkerHandlersOptions,
} from "./register-p0-handlers";

export function createP0WorkerRegistry(
  overrides: Partial<RegisterP0WorkerHandlersOptions> = {},
): WorkerRegistry {
  const registry = createWorkerRegistry();
  const db = overrides.db ?? getDb();
  const traceWriter = createAiInvocationTraceService({ db });

  registerP0WorkerHandlers(registry, {
    db,
    queueAdapter: overrides.queueAdapter ?? getQueueAdapter(),
    asrProvider: overrides.asrProvider ?? getAsrProvider({ traceWriter }),
    llmCorrectionProvider:
      overrides.llmCorrectionProvider ??
      getLlmCorrectionProvider({ traceWriter }),
    llmReportProvider:
      overrides.llmReportProvider ?? getLlmReportProvider({ traceWriter }),
    llmGoalJudgeProvider:
      overrides.llmGoalJudgeProvider ?? getGoalJudgeProvider({ traceWriter }),
    pronunciationProvider:
      overrides.pronunciationProvider ?? getFreeSpeechPronunciationProvider({ traceWriter }),
    shadowingPronunciationProvider:
      overrides.shadowingPronunciationProvider ??
      getShadowingPronunciationProvider({ traceWriter }),
    ttsProvider: overrides.ttsProvider ?? getTtsProvider(),
  });

  return registry;
}
