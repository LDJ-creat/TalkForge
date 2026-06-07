import type { TalkForgeDatabase } from "@/server/db/client";
import {
  getCorrectionsByTurnIds,
  getReportBySessionId,
  getScenarioById,
  getSessionById,
  listTurnsBySessionId,
  prepareShadowingGeneration,
  replaceShadowingItemsForSession,
  updateShadowingItemStandardAudio,
} from "@/server/db/repositories";
import type { TtsProvider } from "@/providers/tts/contract";
import type { WorkerHandler } from "@/queue/worker-types";

import { getTtsProvider } from "@/server/tts/provider";
import {
  generateSessionShadowingContent,
  type GenerateSessionShadowingDeps,
} from "@/server/shadowing/generate-session-shadowing";

export type CreateShadowingGenerateHandlerOptions = {
  db: TalkForgeDatabase;
  ttsProvider?: TtsProvider;
  deps?: Partial<GenerateSessionShadowingDeps>;
};

export function createDbShadowingGenerateDeps(
  options: CreateShadowingGenerateHandlerOptions,
): GenerateSessionShadowingDeps {
  const { db, ttsProvider, deps } = options;

  return {
    ttsProvider: deps?.ttsProvider ?? ttsProvider ?? getTtsProvider(),
    defaultVoice: deps?.defaultVoice,
    getSessionById:
      deps?.getSessionById ?? ((sessionId) => getSessionById(db, sessionId)),
    getScenarioById:
      deps?.getScenarioById ?? ((scenarioId) => getScenarioById(db, scenarioId)),
    getReportBySessionId:
      deps?.getReportBySessionId ??
      ((sessionId) => getReportBySessionId(db, sessionId)),
    listTurnsBySessionId:
      deps?.listTurnsBySessionId ??
      ((sessionId) => listTurnsBySessionId(db, sessionId)),
    getCorrectionsByTurnIds:
      deps?.getCorrectionsByTurnIds ??
      ((turnIds) => getCorrectionsByTurnIds(db, turnIds)),
    prepareShadowingGeneration:
      deps?.prepareShadowingGeneration ??
      ((sessionId) => prepareShadowingGeneration(db, sessionId)),
    replaceShadowingItemsForSession:
      deps?.replaceShadowingItemsForSession ??
      ((input) => replaceShadowingItemsForSession(db, input)),
    updateShadowingItemStandardAudio:
      deps?.updateShadowingItemStandardAudio ??
      ((itemId, input) => updateShadowingItemStandardAudio(db, itemId, input)),
  };
}

export function createShadowingGenerateHandler(
  options: CreateShadowingGenerateHandlerOptions,
): WorkerHandler<"shadowing.generate"> {
  const deps = createDbShadowingGenerateDeps(options);

  return async (payload, context) => {
    await generateSessionShadowingContent(payload, deps, {
      attempts: context.attempts,
    });
  };
}

export type RegisterShadowingGenerateWorkerOptions =
  CreateShadowingGenerateHandlerOptions;

export function registerShadowingGenerateWorker(
  registry: {
    handlers: {
      shadowingGenerate: (
        handler: WorkerHandler<"shadowing.generate">,
      ) => unknown;
    };
  },
  options: RegisterShadowingGenerateWorkerOptions,
) {
  return registry.handlers.shadowingGenerate(createShadowingGenerateHandler(options));
}
