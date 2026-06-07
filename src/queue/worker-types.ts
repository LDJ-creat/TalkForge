import type { JobName } from "./job-names";
import type { JobPayloadMap } from "./payloads";

export type WorkerContext = {
  jobId: string;
  attempts: number;
  maxAttempts: number;
};

export type WorkerHandler<TName extends JobName = JobName> = (
  payload: JobPayloadMap[TName],
  context: WorkerContext,
) => Promise<void>;

export type WorkerRegistry = {
  register<TName extends JobName>(
    name: TName,
    handler: WorkerHandler<TName>,
  ): WorkerRegistry;
  getHandler<TName extends JobName>(
    name: TName,
  ): WorkerHandler<TName> | undefined;
  listRegisteredJobs(): JobName[];
  handlers: {
    asrTranscribe: (
      handler: WorkerHandler<"asr.transcribe">,
    ) => WorkerRegistry;
    correctionAnalyze: (
      handler: WorkerHandler<"correction.analyze">,
    ) => WorkerRegistry;
    evaluationFreeSpeech: (
      handler: WorkerHandler<"evaluation.freeSpeech">,
    ) => WorkerRegistry;
    scenarioProgressEvaluate: (
      handler: WorkerHandler<"scenarioProgress.evaluate">,
    ) => WorkerRegistry;
    reportGenerate: (
      handler: WorkerHandler<"report.generate">,
    ) => WorkerRegistry;
    shadowingGenerate: (
      handler: WorkerHandler<"shadowing.generate">,
    ) => WorkerRegistry;
  };
};

export function createWorkerRegistry(): WorkerRegistry {
  const handlers = new Map<JobName, WorkerHandler>();

  const registry: WorkerRegistry = {
    register(name, handler) {
      handlers.set(name, handler as WorkerHandler);
      return registry;
    },
    getHandler(name) {
      return handlers.get(name) as WorkerHandler<typeof name> | undefined;
    },
    listRegisteredJobs() {
      return [...handlers.keys()];
    },
    handlers: {
      asrTranscribe(handler) {
        return registry.register("asr.transcribe", handler);
      },
      correctionAnalyze(handler) {
        return registry.register("correction.analyze", handler);
      },
      evaluationFreeSpeech(handler) {
        return registry.register("evaluation.freeSpeech", handler);
      },
      scenarioProgressEvaluate(handler) {
        return registry.register("scenarioProgress.evaluate", handler);
      },
      reportGenerate(handler) {
        return registry.register("report.generate", handler);
      },
      shadowingGenerate(handler) {
        return registry.register("shadowing.generate", handler);
      },
    },
  };

  return registry;
}
