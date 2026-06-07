export const JOB_NAMES = [
  "asr.transcribe",
  "correction.analyze",
  "evaluation.freeSpeech",
  "scenarioProgress.evaluate",
  "report.generate",
  "shadowing.generate",
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value);
}
