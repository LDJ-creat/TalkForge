import type { CorrectionType } from "./enums";

export type Correction = {
  id: string;
  turnId: string;
  type: CorrectionType;
  originalText: string;
  correctedText?: string;
  explanation: string;
  confidence: number;
};

export type CreateCorrectionInput = {
  turnId: string;
  type: CorrectionType;
  originalText: string;
  correctedText?: string;
  explanation: string;
  confidence: number;
};
