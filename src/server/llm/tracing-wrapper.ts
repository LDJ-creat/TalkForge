import type {
  LlmCorrectionProvider,
  LlmGoalJudgeProvider,
  LlmReportProvider,
  LlmScenarioGenerateProvider,
} from "@/providers/llm/contract";
import type { GoalJudgeInput, GoalJudgeResult } from "@/providers/llm/goal-judge-types";
import type {
  CorrectionAnalysisResult,
  CorrectionAnalyzeInput,
  ReportGenerateInput,
  ReportGenerationResult,
} from "@/providers/llm/types";
import type {
  ScenarioGenerateInput,
  ScenarioGenerationResult,
} from "@/providers/llm/scenario-generate-types";
import {
  buildGoalJudgePrompt,
  buildReportPrompt,
  CORRECTION_PROMPT_VERSION,
  GOAL_JUDGE_PROMPT_VERSION,
  isOpenAiCompatibleTextLlmProvider,
  REPORT_PROMPT_VERSION,
  SCENARIO_GENERATE_PROMPT_VERSION,
} from "@/providers/openai-compatible-text-llm";
import { buildScenarioGeneratePrompt } from "@/server/scenario-generation/prompt-builder";
import { logScenarioGenerate } from "@/server/scenario-generation/log";
import {
  SCENARIO_GENERATE_TIMEOUT_MS,
  TEXT_LLM_REPORT_TIMEOUT_MS,
} from "@/providers/openai-compatible-text-llm/timeouts";

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

export function createTracedLlmGoalJudgeProvider(
  provider: LlmGoalJudgeProvider,
  traceWriter: AiInvocationTraceWriter,
  options: TracedTextLlmProviderOptions,
): LlmGoalJudgeProvider {
  return {
    name: provider.name,
    async evaluateGoals(input: GoalJudgeInput): Promise<GoalJudgeResult> {
      const goalJudgePrompt = buildGoalJudgePrompt(input);

      const { result } = await executeTracedProviderCall({
        traceWriter,
        provider: provider.name,
        model: options.model,
        operation: "llm.scenarioJudge",
        sessionId: input.sessionId,
        promptVersion: GOAL_JUDGE_PROMPT_VERSION,
        requestSummary: {
          sessionId: input.sessionId,
          scenarioId: input.scenario.id,
          turnCount: input.turns.length,
          completedGoals: input.previousProgress?.completedGoalIds.length ?? 0,
          currentStageId: input.previousProgress?.currentStageId,
        },
        rawRequest: {
          system: goalJudgePrompt.system,
          user: goalJudgePrompt.user,
        },
        fn: (context) =>
          isOpenAiCompatibleTextLlmProvider(provider)
            ? provider.invokeGoalEvaluation(input, context)
            : provider.evaluateGoals(input),
        extractUsage: (judge) =>
          extractUsageFromMetadata(judge.metadata as Record<string, unknown> | undefined),
        extractResponseSummary: (judge) => ({
          completedGoalCount: judge.completedGoalIds.length,
          offTopic: judge.offTopic,
          parseFallback:
            (judge.metadata as { parseFallback?: boolean } | undefined)?.parseFallback ===
            true,
          ruleFallback:
            (judge.metadata as { ruleFallback?: boolean } | undefined)?.ruleFallback ===
            true,
        }),
        extractRawResponse: (judge) => judge,
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
        timeoutMs: TEXT_LLM_REPORT_TIMEOUT_MS,
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

export function createTracedLlmScenarioGenerateProvider(
  provider: LlmScenarioGenerateProvider,
  traceWriter: AiInvocationTraceWriter,
  options: TracedTextLlmProviderOptions,
): LlmScenarioGenerateProvider {
  return {
    name: provider.name,
    async generateScenario(
      input: ScenarioGenerateInput,
    ): Promise<ScenarioGenerationResult> {
      const scenarioPrompt = buildScenarioGeneratePrompt(input);

      logScenarioGenerate("provider_call_started", {
        provider: provider.name,
        model: options.model,
        descriptionLength: input.description.trim().length,
        timeoutMs: SCENARIO_GENERATE_TIMEOUT_MS,
      });

      const { result } = await executeTracedProviderCall({
        traceWriter,
        provider: provider.name,
        model: options.model,
        operation: "llm.scenarioGenerate",
        timeoutMs: SCENARIO_GENERATE_TIMEOUT_MS,
        retry: false,
        promptVersion: SCENARIO_GENERATE_PROMPT_VERSION,
        requestSummary: {
          descriptionLength: input.description.trim().length,
          referenceScenarioCount: input.referenceScenarios?.length ?? 0,
        },
        rawRequest: {
          system: scenarioPrompt.system,
          user: scenarioPrompt.user,
        },
        fn: (context) =>
          isOpenAiCompatibleTextLlmProvider(provider)
            ? provider.invokeScenarioGeneration(input, context)
            : provider.generateScenario(input),
        extractUsage: (generation) =>
          extractUsageFromMetadata(generation.metadata as Record<string, unknown> | undefined),
        extractResponseSummary: (generation) => ({
          title: generation.scenario.title,
          level: generation.scenario.level,
          goalCount: generation.scenario.goals.length,
          stageCount: generation.scenario.stages.length,
          parseFallback:
            (generation.metadata as { parseFallback?: boolean } | undefined)?.parseFallback ===
            true,
        }),
        extractRawResponse: (generation) => generation,
      });

      logScenarioGenerate("provider_call_succeeded", {
        provider: provider.name,
        model: options.model,
        title: result.scenario.title,
        goalCount: result.scenario.goals.length,
      });

      return result;
    },
  };
}
