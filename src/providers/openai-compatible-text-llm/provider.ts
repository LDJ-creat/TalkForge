import { createProviderError } from "@/providers/errors";
import type { LlmCorrectionProvider, LlmReportProvider } from "@/providers/llm/contract";
import { executeProviderCall, type ProviderCallContext } from "@/providers/runtime";
import type {
  CorrectionAnalysisResult,
  CorrectionAnalyzeInput,
  ReportGenerateInput,
  ReportGenerationResult,
} from "@/providers/llm/types";

import { createChatCompletion } from "./client";
import {
  buildOpenAiCompatibleTextLlmConfig,
  OPENAI_COMPATIBLE_PROVIDER_FAMILY,
  type OpenAiCompatibleTextLlmConfig,
} from "./config";
import {
  parseCorrectionItemsFromContent,
  parseReportSectionsFromContent,
} from "./parse";
import {
  CORRECTION_PROMPT_VERSION,
  REPORT_PROMPT_VERSION,
} from "./prompt-versions";
import { buildReportPrompt } from "./prompts/report";

export type CreateOpenAiCompatibleTextLlmProviderOptions = {
  providerName: string;
  apiKey: string;
  apiBaseUrl?: string;
  model?: string;
};

function requirePrompt(
  input: CorrectionAnalyzeInput,
  providerName: string,
): { system: string; user: string } {
  if (input.prompt?.system && input.prompt.user) {
    return input.prompt;
  }

  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: "Correction prompt is required for the text LLM provider.",
    retryable: false,
  });
}

function buildProviderDisplayName(providerName: string): string {
  return `${providerName}-${OPENAI_COMPATIBLE_PROVIDER_FAMILY}`;
}

export class OpenAiCompatibleTextLlmProvider
  implements LlmCorrectionProvider, LlmReportProvider
{
  readonly name: string;
  private readonly config: OpenAiCompatibleTextLlmConfig;

  constructor(options: CreateOpenAiCompatibleTextLlmProviderOptions) {
    if (!options.apiKey.trim()) {
      throw createProviderError({
        provider: options.providerName,
        code: "configuration",
        message: "LLM_API_KEY is required for the text LLM provider.",
        retryable: false,
      });
    }

    this.config = buildOpenAiCompatibleTextLlmConfig(options);
    this.name = buildProviderDisplayName(this.config.providerName);
  }

  async analyzeCorrections(input: CorrectionAnalyzeInput): Promise<CorrectionAnalysisResult> {
    const { result } = await executeProviderCall({
      provider: this.name,
      operation: "llm.correction",
      fn: (context) => this.invokeCorrectionAnalysis(input, context),
    });

    return result;
  }

  async generateReport(input: ReportGenerateInput): Promise<ReportGenerationResult> {
    const { result } = await executeProviderCall({
      provider: this.name,
      operation: "llm.report",
      fn: (context) => this.invokeReportGeneration(input, context),
    });

    return result;
  }

  async invokeCorrectionAnalysis(
    input: CorrectionAnalyzeInput,
    context: ProviderCallContext,
  ): Promise<CorrectionAnalysisResult> {
    const prompt = requirePrompt(input, this.config.providerName);

    const result = await createChatCompletion(
      this.config,
      {
        model: this.config.model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      },
      context,
    );

    const parsed = parseCorrectionItemsFromContent(result.content);
    const metadata = {
      turnId: input.turnId,
      model: result.model,
      promptVersion: CORRECTION_PROMPT_VERSION,
      finishReason: result.finishReason,
      inputTokens: result.usage?.prompt_tokens,
      outputTokens: result.usage?.completion_tokens,
      parseFallback: !parsed.ok || parsed.schemaFallback === true,
      parseError: parsed.ok ? undefined : parsed.error,
    };

    if (!parsed.ok) {
      return {
        provider: this.name,
        corrections: [],
        metadata,
      };
    }

    return {
      provider: this.name,
      corrections: parsed.value,
      metadata,
    };
  }

  async invokeReportGeneration(
    input: ReportGenerateInput,
    context: ProviderCallContext,
  ): Promise<ReportGenerationResult> {
    const prompt = buildReportPrompt(input);

    const result = await createChatCompletion(
      this.config,
      {
        model: this.config.model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      },
      context,
    );

    const parsed = parseReportSectionsFromContent(result.content);
    const metadata = {
      sessionId: input.sessionId,
      model: result.model,
      promptVersion: REPORT_PROMPT_VERSION,
      finishReason: result.finishReason,
      inputTokens: result.usage?.prompt_tokens,
      outputTokens: result.usage?.completion_tokens,
      parseFallback: !parsed.ok,
      parseError: parsed.ok ? undefined : parsed.error,
    };

    if (!parsed.ok) {
      return {
        provider: this.name,
        summary: "",
        taskCompletion: {
          completedGoalIds: input.scenarioProgress.completedGoalIds,
          missingGoalIds: input.scenarioProgress.missingGoalIds,
        },
        keyCorrections: [],
        alternativeExpressions: [],
        shadowingRecommendations: [],
        nextPracticeSuggestion: "",
        metadata,
      };
    }

    const sections = parsed.value;

    return {
      provider: this.name,
      summary: sections.summary,
      taskCompletion: sections.taskCompletion ?? {
        completedGoalIds: input.scenarioProgress.completedGoalIds,
        missingGoalIds: input.scenarioProgress.missingGoalIds,
      },
      keyCorrections: sections.keyCorrections ?? [],
      alternativeExpressions: sections.alternativeExpressions,
      shadowingRecommendations: sections.shadowingRecommendations,
      nextPracticeSuggestion: sections.nextPracticeSuggestion,
      metadata,
    };
  }
}

export function createOpenAiCompatibleTextLlmProvider(
  options: CreateOpenAiCompatibleTextLlmProviderOptions,
): OpenAiCompatibleTextLlmProvider {
  return new OpenAiCompatibleTextLlmProvider(options);
}

export function isOpenAiCompatibleTextLlmProvider(
  provider: LlmCorrectionProvider | LlmReportProvider,
): provider is OpenAiCompatibleTextLlmProvider {
  return provider instanceof OpenAiCompatibleTextLlmProvider;
}

export { isSupportedTextLlmProviderName } from "./config";
