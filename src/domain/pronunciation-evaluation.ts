import type { PronunciationMode } from "./enums";

export type PronunciationEvaluation = {
  id: string;
  turnId: string;
  mode: PronunciationMode;
  overallScore?: number;
  fluencyScore?: number;
  accuracyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  details?: unknown;
};

export type CreatePronunciationEvaluationInput = {
  turnId: string;
  mode: PronunciationMode;
  overallScore?: number;
  fluencyScore?: number;
  accuracyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  details?: unknown;
};
