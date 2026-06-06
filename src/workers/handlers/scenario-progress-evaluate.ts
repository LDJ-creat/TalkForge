import type { TalkForgeDatabase } from "@/server/db/client";
import {
  getScenarioById,
  getScenarioProgressBySessionId,
  getSessionById,
  getTranscriptsByTurnIds,
  listTurnsBySessionId,
  upsertScenarioProgress,
} from "@/server/db/repositories";
import type { LlmGoalJudgeProvider } from "@/providers/llm/contract";
import type { WorkerHandler } from "@/queue/worker-types";

import {
  evaluateSessionProgress,
  type EvaluateSessionProgressDeps,
} from "@/server/scenario-progress/evaluate-session-progress";
import { getGoalJudgeProvider } from "@/server/scenario-progress/provider";

export type CreateScenarioProgressEvaluateHandlerOptions = {
  db: TalkForgeDatabase;
  goalJudgeProvider?: LlmGoalJudgeProvider;
  deps?: Partial<EvaluateSessionProgressDeps>;
};

export function createDbScenarioProgressEvaluateDeps(
  options: CreateScenarioProgressEvaluateHandlerOptions,
): EvaluateSessionProgressDeps {
  const { db, goalJudgeProvider, deps } = options;

  return {
    goalJudgeProvider: deps?.goalJudgeProvider ?? goalJudgeProvider ?? getGoalJudgeProvider(),
    getSessionById:
      deps?.getSessionById ?? ((sessionId) => getSessionById(db, sessionId)),
    getScenarioById:
      deps?.getScenarioById ?? ((scenarioId) => getScenarioById(db, scenarioId)),
    listTurnsBySessionId:
      deps?.listTurnsBySessionId ??
      ((sessionId) => listTurnsBySessionId(db, sessionId)),
    getTranscriptsByTurnIds:
      deps?.getTranscriptsByTurnIds ??
      ((turnIds) => getTranscriptsByTurnIds(db, turnIds)),
    getScenarioProgressBySessionId:
      deps?.getScenarioProgressBySessionId ??
      ((sessionId) => getScenarioProgressBySessionId(db, sessionId)),
    upsertScenarioProgress:
      deps?.upsertScenarioProgress ??
      ((sessionId, progress) => upsertScenarioProgress(db, sessionId, progress)),
  };
}

export function createScenarioProgressEvaluateHandler(
  options: CreateScenarioProgressEvaluateHandlerOptions,
): WorkerHandler<"scenarioProgress.evaluate"> {
  const deps = createDbScenarioProgressEvaluateDeps(options);

  return async (payload, context) => {
    await evaluateSessionProgress(payload, deps, {
      attempts: context.attempts,
    });
  };
}

export type RegisterScenarioProgressWorkerOptions =
  CreateScenarioProgressEvaluateHandlerOptions;

export function registerScenarioProgressEvaluateWorker(
  registry: {
    handlers: {
      scenarioProgressEvaluate: (
        handler: WorkerHandler<"scenarioProgress.evaluate">,
      ) => unknown;
    };
  },
  options: RegisterScenarioProgressWorkerOptions,
) {
  return registry.handlers.scenarioProgressEvaluate(
    createScenarioProgressEvaluateHandler(options),
  );
}
