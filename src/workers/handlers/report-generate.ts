import type { TalkForgeDatabase } from "@/server/db/client";
import {
  finalizeReport,
  getCorrectionsByTurnIds,
  getFreeSpeechEvaluationsByTurnIds,
  getScenarioById,
  getScenarioProgressBySessionId,
  getSessionById,
  getTranscriptsByTurnIds,
  isReportGenerationComplete,
  listTurnsBySessionId,
  prepareReportGeneration,
} from "@/server/db/repositories";
import type { LlmReportProvider } from "@/providers/llm/contract";
import type { QueueAdapter } from "@/queue/adapter";
import type { WorkerHandler } from "@/queue/worker-types";

import {
  generateSessionReport,
  getLlmReportProvider,
  type GenerateSessionReportDeps,
} from "@/server/report";
import { enqueueSessionShadowingGeneration } from "@/server/shadowing/enqueue-session-shadowing";

export type CreateReportGenerateHandlerOptions = {
  db: TalkForgeDatabase;
  llmProvider?: LlmReportProvider;
  queueAdapter?: QueueAdapter;
  deps?: Partial<GenerateSessionReportDeps>;
};

export function createDbReportGenerateDeps(
  options: CreateReportGenerateHandlerOptions,
): GenerateSessionReportDeps {
  const { db, llmProvider, deps } = options;

  return {
    llmProvider: deps?.llmProvider ?? llmProvider ?? getLlmReportProvider(),
    getSessionById:
      deps?.getSessionById ?? ((sessionId) => getSessionById(db, sessionId)),
    getScenarioById:
      deps?.getScenarioById ?? ((scenarioId) => getScenarioById(db, scenarioId)),
    getScenarioProgressBySessionId:
      deps?.getScenarioProgressBySessionId ??
      ((sessionId) => getScenarioProgressBySessionId(db, sessionId)),
    listTurnsBySessionId:
      deps?.listTurnsBySessionId ??
      ((sessionId) => listTurnsBySessionId(db, sessionId)),
    getTranscriptsByTurnIds:
      deps?.getTranscriptsByTurnIds ??
      ((turnIds) => getTranscriptsByTurnIds(db, turnIds)),
    getCorrectionsByTurnIds:
      deps?.getCorrectionsByTurnIds ??
      ((turnIds) => getCorrectionsByTurnIds(db, turnIds)),
    getFreeSpeechEvaluationsByTurnIds:
      deps?.getFreeSpeechEvaluationsByTurnIds ??
      ((turnIds) => getFreeSpeechEvaluationsByTurnIds(db, turnIds)),
    prepareReportGeneration:
      deps?.prepareReportGeneration ??
      ((sessionId) => prepareReportGeneration(db, sessionId)),
    finalizeReport:
      deps?.finalizeReport ??
      ((sessionId, input) => finalizeReport(db, sessionId, input)),
  };
}

export function createReportGenerateHandler(
  options: CreateReportGenerateHandlerOptions,
): WorkerHandler<"report.generate"> {
  const deps = createDbReportGenerateDeps(options);
  const queueAdapter = options.queueAdapter;

  return async (payload, context) => {
    const result = await generateSessionReport(payload, deps, {
      attempts: context.attempts,
    });

    if (queueAdapter && isReportGenerationComplete(result.report)) {
      await enqueueSessionShadowingGeneration(queueAdapter, payload.sessionId);
    }
  };
}

export type RegisterReportGenerateWorkerOptions = CreateReportGenerateHandlerOptions;

export function registerReportGenerateWorker(
  registry: {
    handlers: {
      reportGenerate: (handler: WorkerHandler<"report.generate">) => unknown;
    };
  },
  options: RegisterReportGenerateWorkerOptions,
) {
  return registry.handlers.reportGenerate(createReportGenerateHandler(options));
}
