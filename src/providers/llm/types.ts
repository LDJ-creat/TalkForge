import type { CefrLevel, CorrectionType, TurnRole } from "@/domain/enums";
import type {
  ReportAlternativeExpression,
  ReportKeyCorrection,
  ReportShadowingRecommendation,
  ReportTaskCompletion,
} from "@/domain/report";
import type { ScenarioProgress } from "@/domain/scenario-progress";
import type { ProviderMetadata } from "../types";

export type CorrectionContextTurn = {
  role: TurnRole;
  text: string;
  confidence?: number;
};

export type CorrectionAnalyzeInput = {
  turnId: string;
  transcriptText: string;
  transcriptConfidence?: number;
  recentContext: CorrectionContextTurn[];
  scenarioLevel: CefrLevel;
  scenarioConstraints?: string[];
  /** Built by the correction pipeline for LLM providers that consume chat prompts. */
  prompt?: {
    system: string;
    user: string;
  };
};

export type CorrectionAnalysisItem = {
  type: CorrectionType;
  originalText: string;
  correctedText?: string;
  explanation: string;
  confidence: number;
};

export type CorrectionAnalysisResult = {
  provider: string;
  corrections: CorrectionAnalysisItem[];
  metadata?: ProviderMetadata;
};

export type ReportScenarioContext = {
  id: string;
  title: string;
  level: CefrLevel;
  goals: Array<{ id: string; description: string; required: boolean }>;
  evaluationRubric: { dimensions: string[] };
};

export type ReportTurnContext = {
  turnId: string;
  role: TurnRole;
  text: string;
  corrections?: CorrectionAnalysisItem[];
};

export type ReportGenerateInput = {
  sessionId: string;
  scenario: ReportScenarioContext;
  scenarioProgress: ScenarioProgress;
  turns: ReportTurnContext[];
};

export type ReportGenerationResult = {
  provider: string;
  summary: string;
  taskCompletion: ReportTaskCompletion;
  keyCorrections: ReportKeyCorrection[];
  alternativeExpressions: ReportAlternativeExpression[];
  shadowingRecommendations: ReportShadowingRecommendation[];
  nextPracticeSuggestion: string;
  metadata?: ProviderMetadata;
};
