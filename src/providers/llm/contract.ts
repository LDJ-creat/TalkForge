import type { ProviderIdentity } from "../types";
import type { GoalJudgeInput, GoalJudgeResult } from "./goal-judge-types";
import type {
  CorrectionAnalysisResult,
  CorrectionAnalyzeInput,
  ReportGenerateInput,
  ReportGenerationResult,
} from "./types";

export interface LlmCorrectionProvider extends ProviderIdentity {
  analyzeCorrections(input: CorrectionAnalyzeInput): Promise<CorrectionAnalysisResult>;
}

export interface LlmReportProvider extends ProviderIdentity {
  generateReport(input: ReportGenerateInput): Promise<ReportGenerationResult>;
}

export interface LlmGoalJudgeProvider extends ProviderIdentity {
  evaluateGoals(input: GoalJudgeInput): Promise<GoalJudgeResult>;
}

export type LlmProvider = LlmCorrectionProvider & LlmReportProvider & LlmGoalJudgeProvider;
