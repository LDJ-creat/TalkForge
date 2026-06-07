import type { TalkForgeDatabase } from "@/server/db/client";
import {
  getAudioSegmentById,
  getTurnById,
  prepareShadowingEvaluation,
  saveShadowingEvaluationForTurnIfAbsent,
} from "@/server/db/repositories";
import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import type { WorkerHandler } from "@/queue/worker-types";

import { getShadowingPronunciationProvider } from "@/server/pronunciation/provider";
import {
  evaluateShadowingTurn,
  type EvaluateShadowingTurnDeps,
} from "@/server/shadowing/evaluate-shadowing-turn";

export type CreateEvaluationShadowingHandlerOptions = {
  db: TalkForgeDatabase;
  pronunciationProvider?: PronunciationEvaluationProvider;
  deps?: Partial<EvaluateShadowingTurnDeps>;
};

export function createDbEvaluationShadowingDeps(
  options: CreateEvaluationShadowingHandlerOptions,
): EvaluateShadowingTurnDeps {
  const { db, pronunciationProvider, deps } = options;

  return {
    pronunciationProvider:
      deps?.pronunciationProvider ??
      pronunciationProvider ??
      getShadowingPronunciationProvider(),
    getTurnById:
      deps?.getTurnById ?? ((turnId) => getTurnById(db, turnId)),
    getAudioSegmentById:
      deps?.getAudioSegmentById ??
      ((audioSegmentId) => getAudioSegmentById(db, audioSegmentId)),
    prepareShadowingEvaluation:
      deps?.prepareShadowingEvaluation ??
      ((turnId) => prepareShadowingEvaluation(db, turnId)),
    saveShadowingEvaluationForTurnIfAbsent:
      deps?.saveShadowingEvaluationForTurnIfAbsent ??
      ((input) => saveShadowingEvaluationForTurnIfAbsent(db, input)),
  };
}

export function createEvaluationShadowingHandler(
  options: CreateEvaluationShadowingHandlerOptions,
): WorkerHandler<"evaluation.shadowing"> {
  const deps = createDbEvaluationShadowingDeps(options);

  return async (payload, context) => {
    await evaluateShadowingTurn(payload, deps, {
      attempts: context.attempts,
      jobId: context.jobId,
    });
  };
}

export type RegisterEvaluationShadowingWorkerOptions =
  CreateEvaluationShadowingHandlerOptions;

export function registerEvaluationShadowingWorker(
  registry: {
    handlers: {
      evaluationShadowing: (
        handler: WorkerHandler<"evaluation.shadowing">,
      ) => unknown;
    };
  },
  options: RegisterEvaluationShadowingWorkerOptions,
) {
  return registry.handlers.evaluationShadowing(
    createEvaluationShadowingHandler(options),
  );
}
