import type { CorrectionType } from "./enums";

export type ReportTaskCompletion = {
  completedGoalIds: string[];
  missingGoalIds: string[];
  score?: number;
};

export type ReportKeyCorrection = {
  turnId: string;
  type: CorrectionType;
  originalText: string;
  correctedText?: string;
  explanation: string;
};

export type ReportAlternativeExpression = {
  original: string;
  suggestion: string;
  context?: string;
};

export type ReportShadowingRecommendation = {
  text: string;
  reason?: string;
};

export type Report = {
  id: string;
  sessionId: string;
  summary: string;
  taskCompletion: ReportTaskCompletion;
  keyCorrections: ReportKeyCorrection[];
  alternativeExpressions: ReportAlternativeExpression[];
  shadowingRecommendations: ReportShadowingRecommendation[];
  nextPracticeSuggestion: string;
  createdAt: string;
};

export type CreateReportInput = {
  sessionId: string;
  summary: string;
  taskCompletion: ReportTaskCompletion;
  keyCorrections: ReportKeyCorrection[];
  alternativeExpressions: ReportAlternativeExpression[];
  shadowingRecommendations: ReportShadowingRecommendation[];
  nextPracticeSuggestion: string;
};
