import type { TalkForgeDatabase } from "@/server/db/client";
import {
  getAudioSegmentById,
  getTranscriptByTurnId,
  getTurnById,
  saveTranscriptForTurn,
} from "@/server/db/repositories";
import type { QueueAdapter } from "@/queue/adapter";
import type { AsrProvider } from "@/providers/asr/contract";
import type { WorkerHandler } from "@/queue/worker-types";

import { getAsrProvider } from "@/server/asr/provider";
import {
  transcribeTurnAudio,
  type AsrTranscribeTurnDeps,
} from "@/server/asr/transcribe-turn";

export type CreateAsrTranscribeHandlerOptions = {
  db: TalkForgeDatabase;
  asrProvider?: AsrProvider;
  queueAdapter?: QueueAdapter;
  deps?: Partial<AsrTranscribeTurnDeps>;
};

export function createDbAsrTranscribeDeps(
  options: CreateAsrTranscribeHandlerOptions,
): AsrTranscribeTurnDeps {
  const { db, asrProvider, queueAdapter, deps } = options;

  return {
    asrProvider: deps?.asrProvider ?? asrProvider ?? getAsrProvider(),
    queueAdapter: deps?.queueAdapter ?? queueAdapter,
    getTurnById:
      deps?.getTurnById ??
      ((turnId) => getTurnById(db, turnId)),
    getAudioSegmentById:
      deps?.getAudioSegmentById ??
      ((audioSegmentId) => getAudioSegmentById(db, audioSegmentId)),
    getTranscriptByTurnId:
      deps?.getTranscriptByTurnId ??
      ((turnId) => getTranscriptByTurnId(db, turnId)),
    persistTranscriptForTurn:
      deps?.persistTranscriptForTurn ??
      ((input) => saveTranscriptForTurn(db, input)),
  };
}

export function createAsrTranscribeHandler(
  options: CreateAsrTranscribeHandlerOptions,
): WorkerHandler<"asr.transcribe"> {
  const deps = createDbAsrTranscribeDeps(options);

  return async (payload, context) => {
    await transcribeTurnAudio(payload, deps, {
      attempts: context.attempts,
    });
  };
}

export type RegisterAsrWorkerOptions = CreateAsrTranscribeHandlerOptions;

export function registerAsrTranscribeWorker(
  registry: { handlers: { asrTranscribe: (handler: WorkerHandler<"asr.transcribe">) => unknown } },
  options: RegisterAsrWorkerOptions,
) {
  return registry.handlers.asrTranscribe(createAsrTranscribeHandler(options));
}
