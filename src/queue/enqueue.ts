import type { QueueAdapter } from "./adapter";
import type { JobPayloadMap } from "./payloads";
import type { EnqueueOptions, JobSnapshot } from "./status";

export function enqueueAsrTranscribeJob(
  adapter: QueueAdapter,
  payload: JobPayloadMap["asr.transcribe"],
  options?: EnqueueOptions,
): Promise<JobSnapshot<"asr.transcribe">> {
  return adapter.enqueue("asr.transcribe", payload, options);
}

export function enqueueCorrectionAnalyzeJob(
  adapter: QueueAdapter,
  payload: JobPayloadMap["correction.analyze"],
  options?: EnqueueOptions,
): Promise<JobSnapshot<"correction.analyze">> {
  return adapter.enqueue("correction.analyze", payload, options);
}

export function enqueueEvaluationFreeSpeechJob(
  adapter: QueueAdapter,
  payload: JobPayloadMap["evaluation.freeSpeech"],
  options?: EnqueueOptions,
): Promise<JobSnapshot<"evaluation.freeSpeech">> {
  return adapter.enqueue("evaluation.freeSpeech", payload, options);
}

export function enqueueScenarioProgressEvaluateJob(
  adapter: QueueAdapter,
  payload: JobPayloadMap["scenarioProgress.evaluate"],
  options?: EnqueueOptions,
): Promise<JobSnapshot<"scenarioProgress.evaluate">> {
  return adapter.enqueue("scenarioProgress.evaluate", payload, options);
}

export function enqueueReportGenerateJob(
  adapter: QueueAdapter,
  payload: JobPayloadMap["report.generate"],
  options?: EnqueueOptions,
): Promise<JobSnapshot<"report.generate">> {
  return adapter.enqueue("report.generate", payload, options);
}

export function enqueueShadowingGenerateJob(
  adapter: QueueAdapter,
  payload: JobPayloadMap["shadowing.generate"],
  options?: EnqueueOptions,
): Promise<JobSnapshot<"shadowing.generate">> {
  return adapter.enqueue("shadowing.generate", payload, options);
}

export const typedEnqueue = {
  asrTranscribe: enqueueAsrTranscribeJob,
  correctionAnalyze: enqueueCorrectionAnalyzeJob,
  evaluationFreeSpeech: enqueueEvaluationFreeSpeechJob,
  scenarioProgressEvaluate: enqueueScenarioProgressEvaluateJob,
  reportGenerate: enqueueReportGenerateJob,
  shadowingGenerate: enqueueShadowingGenerateJob,
};
