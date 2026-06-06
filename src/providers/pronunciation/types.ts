import type { PronunciationMode } from "@/domain/enums";
import type { ProviderMetadata } from "../types";

export type PronunciationEvaluateInput = {
  audioObjectKey: string;
  mode: PronunciationMode;
  referenceText?: string;
  language?: "en";
};

export type PronunciationEvaluationResult = {
  provider: string;
  mode: PronunciationMode;
  overallScore?: number;
  fluencyScore?: number;
  accuracyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  details?: unknown;
  metadata?: ProviderMetadata;
};
