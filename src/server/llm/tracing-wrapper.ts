import type { LlmCorrectionProvider, LlmReportProvider } from "@/providers/llm/contract";
import type {
  CorrectionAnalysisResult,
  CorrectionAnalyzeInput,
  ReportGenerateInput,
  ReportGenerationResult,
} from "@/providers/llm/types";
import {
  buildReportPrompt,
  CORRECTION_PROMPT_VERSION,
  isOpenAiCompatibleTextLlmProvider,
  REPORT_PROMPT_VERSION,
} from "@/providers/openai-compatible-text-llm";

import type { AiInvocationTraceWriter } from "@/server/ai-tracing";
import { executeTracedProviderCall } from "@/server/ai-tracing";

export type TracedTextLlmProviderOptions = {
  model: string;
};

function extractUsageFromMetadata(metadata: Record<string, unknown> | undefined) {
  const inputTokens =
    typeof metadata?.inputTokens === "number" ? metadata.inputTokens : undefined;
  const outputTokens =
    typeof metadata?.outputTokens === "number" ? metadata.outputTokens : undefined;

  if (inputTokens === undefined && outputTokens === undefined) {
    return undefined;
  }

  return { inputTokens, outputTokens };
}

export function createTracedLlmCorrectionProvider(
  provider: LlmCorrectionProvider,
  traceWriter: AiInvocationTraceWriter,
  options: TracedTextLlmProviderOptions,
): LlmCorrectionProvider {
  return {
    name: provider.name,
    async analyzeCorrections(
      input: CorrectionAnalyzeInput,
    ): Promise<CorrectionAnalysisResult> {
      const { result } = await executeTracedProviderCall({
        traceWriter,
        provider: provider.name,
        model: options.model,
        operation: "llm.correction",
        turnId: input.turnId,
        promptVersion: CORRECTION_PROMPT_VERSION,
        requestSummary: {
          turnId: input.turnId,
          transcriptLength: input.transcriptText.length,
          transcriptConfidence: input.transcriptConfidence,
          recentContextTurns: input.recentContext.length,
          scenarioLevel: input.scenarioLevel,
        },
        rawRequest: input.prompt,
        fn: (context) =>
          isOpenAiCompatibleTextLlmProvider(provider)
            ? provider.invokeCorrectionAnalysis(input, context)
            : provider.analyzeCorrections(input),
        extractUsage: (analysis) =>
          extractUsageFromMetadata(analysis.metadata as Record<string, unknown> | undefined),
        extractResponseSummary: (analysis) => ({
          correctionCount: analysis.corrections.length,
          parseFallback:
            (analysis.metadata as { parseFallback?: boolean } | undefined)?.parseFallback ===
            true,
        }),
        extractRawResponse: (analysis) => analysis,
      });

      return result;
    },
  };
}

export function createTracedLlmReportProvider(
  provider: LlmReportProvider,
  traceWriter: AiInvocationTraceWriter,
  options: TracedTextLlmProviderOptions,
): LlmReportProvider {
  return {
    name: provider.name,
    async generateReport(input: ReportGenerateInput): Promise<ReportGenerationResult> {
      const reportPrompt = buildReportPrompt(input);

      const { result } = await executeTracedProviderCall({
        traceWriter,
        provider: provider.name,
        model: options.model,
        operation: "llm.report",
        sessionId: input.sessionId,
        promptVersion: REPORT_PROMPT_VERSION,
        requestSummary: {
          sessionId: input.sessionId,
          scenarioId: input.scenario.id,
          turnCount: input.turns.length,
          completedGoals: input.scenarioProgress.completedGoalIds.length,
          missingGoals: input.scenarioProgress.missingGoalIds.length,
        },
        rawRequest: {
          system: reportPrompt.system,
          user: reportPrompt.user,
        },
        fn: (context) =>
          isOpenAiCompatibleTextLlmProvider(provider)
            ? provider.invokeReportGeneration(input, context)
            : provider.generateReport(input),
        extractUsage: (report) =>
          extractUsageFromMetadata(report.metadata as Record<string, unknown> | undefined),
        extractResponseSummary: (report) => ({
          summaryLength: report.summary.length,
          alternativeExpressionCount: report.alternativeExpressions.length,
          parseFallback:
            (report.metadata as { parseFallback?: boolean } | undefined)?.parseFallback ===
            true,
        }),
        extractRawResponse: (report) => report,
      });

      return result;
    },
  };
}
