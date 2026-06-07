import type { Correction } from "@/domain/correction";
import type { PronunciationEvaluation } from "@/domain/pronunciation-evaluation";
import type { CreateReportInput, Report } from "@/domain/report";
import type { Scenario } from "@/domain/scenario";
import type { ScenarioProgress } from "@/domain/scenario-progress";
import type { Session } from "@/domain/session";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import type { LlmReportProvider } from "@/providers/llm/contract";
import { isProviderError } from "@/providers/errors";
import { JobProcessingError } from "@/queue/errors";
import type { ReportGeneratePayload } from "@/queue/payloads";
import type { PrepareReportGenerationResult } from "@/server/db/repositories/report-repository";

import {
  buildDeterministicReportSections,
  type ReportAggregationInput,
} from "./build-report";

export type GenerateSessionReportResult = {
  report: Report;
  created: boolean;
};

export type GenerateSessionReportDeps = {
  llmProvider: LlmReportProvider;
  getSessionById: (sessionId: string) => Promise<Session | null>;
  getScenarioById: (scenarioId: string) => Promise<Scenario | null>;
  getScenarioProgressBySessionId: (
    sessionId: string,
  ) => Promise<ScenarioProgress | null>;
  listTurnsBySessionId: (sessionId: string) => Promise<Turn[]>;
  getTranscriptsByTurnIds: (turnIds: string[]) => Promise<Map<string, Transcript>>;
  getCorrectionsByTurnIds: (turnIds: string[]) => Promise<Map<string, Correction[]>>;
  getFreeSpeechEvaluationsByTurnIds: (
    turnIds: string[],
  ) => Promise<Map<string, PronunciationEvaluation>>;
  prepareReportGeneration: (
    sessionId: string,
  ) => Promise<PrepareReportGenerationResult>;
  finalizeReport: (sessionId: string, input: CreateReportInput) => Promise<Report>;
};

function toScenarioContext(scenario: Scenario) {
  return {
    id: scenario.id,
    title: scenario.title,
    level: scenario.level,
    goals: scenario.goals.map((goal) => ({
      id: goal.id,
      description: goal.description,
      required: goal.required,
    })),
    evaluationRubric: scenario.evaluationRubric,
  };
}

export async function generateSessionReport(
  payload: ReportGeneratePayload,
  deps: GenerateSessionReportDeps,
  context: { attempts: number },
): Promise<GenerateSessionReportResult> {
  const session = await deps.getSessionById(payload.sessionId);
  if (!session) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Session ${payload.sessionId} was not found.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  if (session.status !== "completed") {
    throw new JobProcessingError({
      code: "validation",
      message: "Reports can only be generated for completed sessions.",
      attempts: context.attempts,
      retryable: false,
    });
  }

  const preparation = await deps.prepareReportGeneration(payload.sessionId);
  if (preparation.status === "complete") {
    return {
      report: preparation.report,
      created: false,
    };
  }

  if (preparation.status === "in_progress") {
    throw new JobProcessingError({
      code: "report_in_progress",
      message: "Report generation is already in progress for this session.",
      attempts: context.attempts,
      retryable: true,
    });
  }

  const scenario = await deps.getScenarioById(session.scenarioId);
  if (!scenario) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Scenario ${session.scenarioId} was not found.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  const turns = await deps.listTurnsBySessionId(payload.sessionId);
  const turnIds = turns.map((turn) => turn.id);
  const [transcriptsByTurnId, correctionsByTurnId, evaluationsByTurnId, scenarioProgress] =
    await Promise.all([
      deps.getTranscriptsByTurnIds(turnIds),
      deps.getCorrectionsByTurnIds(turnIds),
      deps.getFreeSpeechEvaluationsByTurnIds(turnIds),
      deps.getScenarioProgressBySessionId(payload.sessionId),
    ]);

  const aggregationInput: ReportAggregationInput = {
    sessionId: payload.sessionId,
    scenario,
    scenarioProgress,
    turns,
    transcriptsByTurnId,
    correctionsByTurnId,
    evaluationsByTurnId,
  };

  const deterministic = buildDeterministicReportSections(aggregationInput);

  let summary = deterministic.summary;
  let nextPracticeSuggestion = deterministic.nextPracticeSuggestion;
  let alternativeExpressions = deterministic.alternativeExpressions;
  let shadowingRecommendations = deterministic.shadowingRecommendations;

  try {
    const llmResult = await deps.llmProvider.generateReport({
      sessionId: payload.sessionId,
      scenario: toScenarioContext(scenario),
      scenarioProgress: deterministic.scenarioProgress,
      turns: deterministic.turns,
    });

    if (llmResult.summary.trim()) {
      summary = llmResult.summary.trim();
    }

    if (llmResult.nextPracticeSuggestion.trim()) {
      nextPracticeSuggestion = llmResult.nextPracticeSuggestion.trim();
    }

    if (llmResult.alternativeExpressions.length > 0) {
      alternativeExpressions = llmResult.alternativeExpressions;
    }

    if (llmResult.shadowingRecommendations.length > 0) {
      shadowingRecommendations = llmResult.shadowingRecommendations;
    }
  } catch (error) {
    if (isProviderError(error)) {
      throw new JobProcessingError({
        code: "provider_error",
        message: error.message,
        attempts: context.attempts,
        retryable: true,
        cause: error,
      });
    }

    throw error;
  }

  const report = await deps.finalizeReport(payload.sessionId, {
    sessionId: payload.sessionId,
    summary,
    taskCompletion: deterministic.taskCompletion,
    keyCorrections: deterministic.keyCorrections,
    alternativeExpressions,
    shadowingRecommendations,
    nextPracticeSuggestion,
  });

  return {
    report,
    created: preparation.status === "claimed",
  };
}
