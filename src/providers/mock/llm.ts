import { createProviderError } from "../errors";
import type { LlmCorrectionProvider, LlmReportProvider } from "../llm/contract";
import {
  ASR_UNCERTAIN_CONFIDENCE_THRESHOLD,
  isLowConfidenceTranscript,
} from "../llm/correction-policy";
import type {
  CorrectionAnalysisResult,
  CorrectionAnalyzeInput,
  ReportGenerateInput,
  ReportGenerationResult,
} from "../llm/types";

export type MockLlmProviderOptions = {
  name?: string;
  failOnCorrection?: boolean;
  failOnReport?: boolean;
};

export class MockLlmProvider implements LlmCorrectionProvider, LlmReportProvider {
  readonly name: string;
  private readonly failOnCorrection: boolean;
  private readonly failOnReport: boolean;

  constructor(options: MockLlmProviderOptions = {}) {
    this.name = options.name ?? "mock-llm";
    this.failOnCorrection = options.failOnCorrection ?? false;
    this.failOnReport = options.failOnReport ?? false;
  }

  async analyzeCorrections(input: CorrectionAnalyzeInput): Promise<CorrectionAnalysisResult> {
    if (this.failOnCorrection) {
      throw createProviderError({
        provider: this.name,
        code: "provider_unavailable",
        message: "Mock LLM provider is configured to fail correction analysis.",
      });
    }

    const confidence = input.transcriptConfidence ?? 1;
    if (isLowConfidenceTranscript(confidence)) {
      return {
        provider: this.name,
        corrections: [
          {
            type: "asr_uncertain",
            originalText: input.transcriptText,
            explanation: "Transcript confidence is too low for reliable correction.",
            confidence: 0.55,
          },
        ],
        metadata: {
          turnId: input.turnId,
          mock: true,
          lowConfidenceThreshold: ASR_UNCERTAIN_CONFIDENCE_THRESHOLD,
          promptAttached: Boolean(input.prompt),
        },
      };
    }

    const grammarMatch = input.transcriptText.match(/\bI (?:go|goes) to\b/i);
    if (grammarMatch) {
      return {
        provider: this.name,
        corrections: [
          {
            type: "grammar",
            originalText: grammarMatch[0],
            correctedText: "I went to",
            explanation: "Use past tense when describing a completed visit.",
            confidence: 0.88,
          },
        ],
        metadata: {
          turnId: input.turnId,
          mock: true,
          lowConfidenceThreshold: ASR_UNCERTAIN_CONFIDENCE_THRESHOLD,
          promptAttached: Boolean(input.prompt),
        },
      };
    }

    return {
      provider: this.name,
      corrections: [],
      metadata: {
        turnId: input.turnId,
        mock: true,
        promptAttached: Boolean(input.prompt),
      },
    };
  }

  async generateReport(input: ReportGenerateInput): Promise<ReportGenerationResult> {
    if (this.failOnReport) {
      throw createProviderError({
        provider: this.name,
        code: "provider_unavailable",
        message: "Mock LLM provider is configured to fail report generation.",
      });
    }

    const userTurns = input.turns.filter((turn) => turn.role === "user");
    const keyCorrections = input.turns.flatMap((turn) =>
      (turn.corrections ?? [])
        .filter((correction) => correction.type !== "asr_uncertain")
        .map((correction) => ({
          turnId: turn.turnId,
          type: correction.type,
          originalText: correction.originalText,
          correctedText: correction.correctedText,
          explanation: correction.explanation,
        })),
    );

    return {
      provider: this.name,
      summary: `Completed ${input.scenario.title} with ${userTurns.length} learner turns.`,
      taskCompletion: {
        completedGoalIds: input.scenarioProgress.completedGoalIds,
        missingGoalIds: input.scenarioProgress.missingGoalIds,
        score:
          input.scenarioProgress.missingGoalIds.length === 0
            ? 90
            : Math.max(55, 90 - input.scenarioProgress.missingGoalIds.length * 10),
      },
      keyCorrections,
      alternativeExpressions: [
        {
          original: "I want coffee.",
          suggestion: "Could I get a medium latte, please?",
          context: "Ordering at a cafe",
        },
      ],
      shadowingRecommendations: [
        {
          text: "Could I get a medium latte?",
          reason: "Natural ordering phrase for this scenario.",
        },
      ],
      nextPracticeSuggestion: `Review ${input.scenario.level} ordering phrases and retry ${input.scenario.title}.`,
      metadata: {
        sessionId: input.sessionId,
        mock: true,
      },
    };
  }
}

export function createMockLlmProvider(options?: MockLlmProviderOptions): MockLlmProvider {
  return new MockLlmProvider(options);
}
