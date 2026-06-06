import type { ProviderIdentity } from "../types";
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

export type LlmProvider = LlmCorrectionProvider & LlmReportProvider;
