import type { TalkForgeDatabase } from "@/server/db/client";
import {
  getCorrectionsByTurnId,
  getScenarioById,
  getSessionById,
  getTranscriptById,
  getTranscriptByTurnId,
  getTranscriptsByTurnIds,
  getTurnById,
  listTurnsBySessionId,
  saveCorrectionsForTurnIfAbsent,
} from "@/server/db/repositories";
import type { LlmCorrectionProvider } from "@/providers/llm/contract";
import type { WorkerHandler } from "@/queue/worker-types";

import {
  analyzeTurnCorrections,
  type CorrectionAnalyzeTurnDeps,
} from "@/server/correction/analyze-turn";
import { getLlmCorrectionProvider } from "@/server/correction/provider";

export type CreateCorrectionAnalyzeHandlerOptions = {
  db: TalkForgeDatabase;
  llmProvider?: LlmCorrectionProvider;
  deps?: Partial<CorrectionAnalyzeTurnDeps>;
};

export function createDbCorrectionAnalyzeDeps(
  options: CreateCorrectionAnalyzeHandlerOptions,
): CorrectionAnalyzeTurnDeps {
  const { db, llmProvider, deps } = options;

  return {
    llmProvider: deps?.llmProvider ?? llmProvider ?? getLlmCorrectionProvider(),
    getSessionById:
      deps?.getSessionById ?? ((sessionId) => getSessionById(db, sessionId)),
    getScenarioById:
      deps?.getScenarioById ?? ((scenarioId) => getScenarioById(db, scenarioId)),
    getTurnById: deps?.getTurnById ?? ((turnId) => getTurnById(db, turnId)),
    listTurnsBySessionId:
      deps?.listTurnsBySessionId ??
      ((sessionId) => listTurnsBySessionId(db, sessionId)),
    getTranscriptById:
      deps?.getTranscriptById ??
      ((transcriptId) => getTranscriptById(db, transcriptId)),
    getTranscriptByTurnId:
      deps?.getTranscriptByTurnId ??
      ((turnId) => getTranscriptByTurnId(db, turnId)),
    getTranscriptsByTurnIds:
      deps?.getTranscriptsByTurnIds ??
      ((turnIds) => getTranscriptsByTurnIds(db, turnIds)),
    getCorrectionsByTurnId:
      deps?.getCorrectionsByTurnId ??
      ((turnId) => getCorrectionsByTurnId(db, turnId)),
    saveCorrectionsForTurnIfAbsent:
      deps?.saveCorrectionsForTurnIfAbsent ??
      ((turnId, inputs) => saveCorrectionsForTurnIfAbsent(db, turnId, inputs)),
  };
}

export function createCorrectionAnalyzeHandler(
  options: CreateCorrectionAnalyzeHandlerOptions,
): WorkerHandler<"correction.analyze"> {
  const deps = createDbCorrectionAnalyzeDeps(options);

  return async (payload, context) => {
    await analyzeTurnCorrections(payload, deps, {
      attempts: context.attempts,
    });
  };
}

export type RegisterCorrectionWorkerOptions = CreateCorrectionAnalyzeHandlerOptions;

export function registerCorrectionAnalyzeWorker(
  registry: {
    handlers: {
      correctionAnalyze: (handler: WorkerHandler<"correction.analyze">) => unknown;
    };
  },
  options: RegisterCorrectionWorkerOptions,
) {
  return registry.handlers.correctionAnalyze(createCorrectionAnalyzeHandler(options));
}
