export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const SESSION_STATUSES = ["active", "completed", "failed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const TURN_ROLES = ["user", "assistant"] as const;
export type TurnRole = (typeof TURN_ROLES)[number];

export const EVALUATION_STATUSES = [
  "none",
  "pending",
  "processing",
  "done",
  "failed",
] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export const AUDIO_FORMATS = ["webm", "wav", "pcm"] as const;
export type AudioFormat = (typeof AUDIO_FORMATS)[number];

export const AUDIO_CODECS = ["opus", "pcm_s16le"] as const;
export type AudioCodec = (typeof AUDIO_CODECS)[number];

export const CORRECTION_TYPES = [
  "grammar",
  "expression",
  "vocabulary",
  "clarity",
  "asr_uncertain",
] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const PRONUNCIATION_MODES = ["free_speech", "shadowing"] as const;
export type PronunciationMode = (typeof PRONUNCIATION_MODES)[number];
