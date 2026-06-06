import type { TalkForgeDatabase } from "@/server/db/client";
import {
  getAudioSegmentById,
  getTurnById,
  markTurnEvaluationFailed,
  prepareFreeSpeechEvaluation,
  saveFreeSpeechEvaluationForTurnIfAbsent,
} from "@/server/db/repositories";
import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import type { WorkerHandler } from "@/queue/worker-types";

import { getPronunciationProvider } from "@/server/pronunciation/provider";
import {
  evaluateFreeSpeechTurn,
  type EvaluateFreeSpeechDeps,
} from "@/server/pronunciation/evaluate-free-speech";

export type CreateEvaluationFreeSpeechHandlerOptions = {
  db: TalkForgeDatabase;
  pronunciationProvider?: PronunciationEvaluationProvider;
  deps?: Partial<EvaluateFreeSpeechDeps>;
};

export function createDbEvaluationFreeSpeechDeps(
  options: CreateEvaluationFreeSpeechHandlerOptions,
): EvaluateFreeSpeechDeps {
  const { db, pronunciationProvider, deps } = options;

  return {
    pronunciationProvider:
      deps?.pronunciationProvider ??
      pronunciationProvider ??
      getPronunciationProvider(),
    getTurnById:
      deps?.getTurnById ?? ((turnId) => getTurnById(db, turnId)),
    getAudioSegmentById:
      deps?.getAudioSegmentById ??
      ((audioSegmentId) => getAudioSegmentById(db, audioSegmentId)),
    prepareFreeSpeechEvaluation:
      deps?.prepareFreeSpeechEvaluation ??
      ((turnId) => prepareFreeSpeechEvaluation(db, turnId)),
    saveFreeSpeechEvaluationForTurnIfAbsent:
      deps?.saveFreeSpeechEvaluationForTurnIfAbsent ??
      ((input) => saveFreeSpeechEvaluationForTurnIfAbsent(db, input)),
    markTurnEvaluationFailed:
      deps?.markTurnEvaluationFailed ??
      ((turnId) => markTurnEvaluationFailed(db, turnId)),
  };
}

export function createEvaluationFreeSpeechHandler(
  options: CreateEvaluationFreeSpeechHandlerOptions,
): WorkerHandler<"evaluation.freeSpeech"> {
  const deps = createDbEvaluationFreeSpeechDeps(options);

  return async (payload, context) => {
    await evaluateFreeSpeechTurn(payload, deps, {
      attempts: context.attempts,
    });
  };
}

export type RegisterEvaluationFreeSpeechWorkerOptions =
  CreateEvaluationFreeSpeechHandlerOptions;

export function registerEvaluationFreeSpeechWorker(
  registry: {
    handlers: {
      evaluationFreeSpeech: (
        handler: WorkerHandler<"evaluation.freeSpeech">,
      ) => unknown;
    };
  },
  options: RegisterEvaluationFreeSpeechWorkerOptions,
) {
  return registry.handlers.evaluationFreeSpeech(
    createEvaluationFreeSpeechHandler(options),
  );
}
