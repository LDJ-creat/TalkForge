import type { AiInvocationLog } from "@/domain/ai-invocation-log";
import type { StandardAudioAsset } from "@/domain/standard-audio-asset";
import type { AudioSegment } from "@/domain/audio-segment";
import type { Correction } from "@/domain/correction";
import type { PronunciationEvaluation } from "@/domain/pronunciation-evaluation";
import type { Report } from "@/domain/report";
import type {
  EvaluationRubric,
  ExitPolicy,
  Scenario,
  ScenarioGoal,
  ScenarioStage,
} from "@/domain/scenario";
import type { ScenarioProgress } from "@/domain/scenario-progress";
import type { Session } from "@/domain/session";
import type { Transcript, TranscriptSegment } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";

import type {
  DbAiInvocationLog,
  DbAudioSegment,
  DbCorrection,
  DbPronunciationEvaluation,
  DbReport,
  DbScenario,
  DbScenarioProgress,
  DbSession,
  DbStandardAudioAsset,
  DbTranscript,
  DbTurn,
  NewDbScenario,
} from "./schema";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asScenarioGoals(value: unknown): ScenarioGoal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "description" in item &&
      "required" in item &&
      "completedWhen" in item
    ) {
      const goal = item as ScenarioGoal;
      return [goal];
    }
    return [];
  });
}

function asScenarioStages(value: unknown): ScenarioStage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "name" in item &&
      "purpose" in item &&
      "aiBehavior" in item &&
      "expectedUserActions" in item
    ) {
      const stage = item as ScenarioStage;
      return [stage];
    }
    return [];
  });
}

function asExitPolicy(value: unknown): ExitPolicy {
  if (typeof value !== "object" || value === null) {
    throw new Error("Scenario exitPolicy is missing or invalid.");
  }

  return value as ExitPolicy;
}

function asEvaluationRubric(value: unknown): EvaluationRubric {
  if (typeof value !== "object" || value === null) {
    throw new Error("Scenario evaluationRubric is missing or invalid.");
  }

  return value as EvaluationRubric;
}

function asTranscriptSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as TranscriptSegment[];
}

export function toScenario(row: DbScenario): Scenario {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    level: row.level,
    userRole: row.userRole,
    aiRole: row.aiRole,
    situation: row.situation,
    mission: row.mission,
    goals: asScenarioGoals(row.goals),
    stages: asScenarioStages(row.stages),
    vocabulary: asStringArray(row.vocabulary),
    targetExpressions: asStringArray(row.targetExpressions),
    constraints: asStringArray(row.constraints),
    exitPolicy: asExitPolicy(row.exitPolicy),
    evaluationRubric: asEvaluationRubric(row.evaluationRubric),
  };
}

export function fromScenario(scenario: Scenario): NewDbScenario {
  return {
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    level: scenario.level,
    userRole: scenario.userRole,
    aiRole: scenario.aiRole,
    situation: scenario.situation,
    mission: scenario.mission,
    goals: scenario.goals,
    stages: scenario.stages,
    vocabulary: scenario.vocabulary,
    targetExpressions: scenario.targetExpressions,
    constraints: scenario.constraints,
    exitPolicy: scenario.exitPolicy,
    evaluationRubric: scenario.evaluationRubric,
  };
}

export function toSession(row: DbSession): Session {
  return {
    id: row.id,
    userId: row.userId,
    scenarioId: row.scenarioId,
    realtimeProvider: row.realtimeProvider,
    realtimeProviderSessionId: row.realtimeProviderSessionId ?? undefined,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt ?? undefined,
  };
}

export function toScenarioProgress(row: DbScenarioProgress): ScenarioProgress {
  return {
    sessionId: row.sessionId,
    currentStageId: row.currentStageId,
    completedGoalIds: asStringArray(row.completedGoalIds),
    missingGoalIds: asStringArray(row.missingGoalIds),
    shouldSuggestEnding: row.shouldSuggestEnding,
    offTopic: row.offTopic,
    updatedAt: row.updatedAt,
  };
}

export function toTurn(row: DbTurn): Turn {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    transcriptText: row.transcriptText ?? undefined,
    audioSegmentId: row.audioSegmentId ?? undefined,
    evaluationStatus: row.evaluationStatus,
  };
}

export function toAudioSegment(row: DbAudioSegment): AudioSegment {
  return {
    id: row.id,
    turnId: row.turnId,
    objectKey: row.objectKey,
    format: row.format,
    codec: row.codec ?? undefined,
    sampleRate: row.sampleRate ?? undefined,
    durationMs: row.durationMs,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}

export function toTranscript(row: DbTranscript): Transcript {
  return {
    id: row.id,
    turnId: row.turnId,
    provider: row.provider,
    text: row.text,
    confidence: row.confidence ?? undefined,
    segments: asTranscriptSegments(row.segments),
  };
}

export function toCorrection(row: DbCorrection): Correction {
  return {
    id: row.id,
    turnId: row.turnId,
    type: row.type,
    originalText: row.originalText,
    correctedText: row.correctedText ?? undefined,
    explanation: row.explanation,
    confidence: row.confidence,
  };
}

export function toPronunciationEvaluation(
  row: DbPronunciationEvaluation,
): PronunciationEvaluation {
  return {
    id: row.id,
    turnId: row.turnId,
    mode: row.mode,
    overallScore: row.overallScore ?? undefined,
    fluencyScore: row.fluencyScore ?? undefined,
    accuracyScore: row.accuracyScore ?? undefined,
    completenessScore: row.completenessScore ?? undefined,
    prosodyScore: row.prosodyScore ?? undefined,
    details: row.details ?? undefined,
  };
}

export function toReport(row: DbReport): Report {
  return {
    id: row.id,
    sessionId: row.sessionId,
    summary: row.summary,
    taskCompletion: row.taskCompletion as Report["taskCompletion"],
    keyCorrections: row.keyCorrections as Report["keyCorrections"],
    alternativeExpressions:
      row.alternativeExpressions as Report["alternativeExpressions"],
    shadowingRecommendations:
      row.shadowingRecommendations as Report["shadowingRecommendations"],
    nextPracticeSuggestion: row.nextPracticeSuggestion,
    createdAt: row.createdAt,
  };
}

export function toStandardAudioAsset(row: DbStandardAudioAsset): StandardAudioAsset {
  return {
    id: row.id,
    cacheKey: row.cacheKey,
    provider: row.provider,
    objectKey: row.objectKey,
    format: row.format,
    codec: row.codec ?? undefined,
    sampleRate: row.sampleRate ?? undefined,
    durationMs: row.durationMs ?? undefined,
    sizeBytes: row.sizeBytes,
    voice: row.voice,
    speed: row.speed,
    language: row.language as "en",
    createdAt: row.createdAt,
  };
}

export function toAiInvocationLog(row: DbAiInvocationLog): AiInvocationLog {
  return {
    id: row.id,
    sessionId: row.sessionId ?? undefined,
    turnId: row.turnId ?? undefined,
    jobId: row.jobId ?? undefined,
    provider: row.provider,
    model: row.model,
    operation: row.operation,
    promptVersion: row.promptVersion ?? undefined,
    inputObjectKey: row.inputObjectKey ?? undefined,
    outputObjectKey: row.outputObjectKey ?? undefined,
    requestSummary: row.requestSummary ?? undefined,
    responseSummary: row.responseSummary ?? undefined,
    rawRequestObjectKey: row.rawRequestObjectKey ?? undefined,
    rawResponseObjectKey: row.rawResponseObjectKey ?? undefined,
    status: row.status,
    latencyMs: row.latencyMs,
    retryCount: row.retryCount,
    inputTokens: row.inputTokens ?? undefined,
    outputTokens: row.outputTokens ?? undefined,
    audioDurationMs: row.audioDurationMs ?? undefined,
    costEstimate: row.costEstimate ?? undefined,
    errorCode: row.errorCode ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    createdAt: row.createdAt,
  };
}
