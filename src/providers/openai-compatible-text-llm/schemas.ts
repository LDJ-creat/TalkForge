import type { CorrectionType } from "@/domain/enums";
import type { CorrectionAnalysisItem } from "@/providers/llm/types";
import type {
  ReportAlternativeExpression,
  ReportKeyCorrection,
  ReportShadowingRecommendation,
  ReportTaskCompletion,
} from "@/domain/report";

const CORRECTION_TYPES = new Set<CorrectionType>([
  "grammar",
  "expression",
  "vocabulary",
  "clarity",
  "asr_uncertain",
]);

export type RawCorrectionResponse = {
  corrections?: unknown;
};

export type RawReportResponse = {
  summary?: unknown;
  nextPracticeSuggestion?: unknown;
  alternativeExpressions?: unknown;
  shadowingRecommendations?: unknown;
  taskCompletion?: unknown;
};

export type ParsedReportSections = {
  summary: string;
  nextPracticeSuggestion: string;
  alternativeExpressions: ReportAlternativeExpression[];
  shadowingRecommendations: ReportShadowingRecommendation[];
  taskCompletion?: ReportTaskCompletion;
  keyCorrections?: ReportKeyCorrection[];
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function readConfidence(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(1, Math.max(0, value));
}

export function parseCorrectionResponseItem(
  value: unknown,
): CorrectionAnalysisItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== "string" || !CORRECTION_TYPES.has(type as CorrectionType)) {
    return null;
  }

  const originalText = readString(record.originalText);
  const explanation = readString(record.explanation);
  const confidence = readConfidence(record.confidence);

  if (!originalText || !explanation || confidence === undefined) {
    return null;
  }

  const correctedText = readString(record.correctedText);

  return {
    type: type as CorrectionType,
    originalText,
    correctedText,
    explanation,
    confidence,
  };
}

export function parseCorrectionResponse(payload: unknown): CorrectionAnalysisItem[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const corrections = (payload as RawCorrectionResponse).corrections;
  if (!Array.isArray(corrections)) {
    return [];
  }

  return corrections.flatMap((item) => {
    const parsed = parseCorrectionResponseItem(item);
    return parsed ? [parsed] : [];
  });
}

function parseAlternativeExpression(value: unknown): ReportAlternativeExpression | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const original = readString(record.original);
  const suggestion = readString(record.suggestion);
  if (!original || !suggestion) {
    return null;
  }

  return {
    original,
    suggestion,
    context: readString(record.context),
  };
}

function parseShadowingRecommendation(
  value: unknown,
): ReportShadowingRecommendation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const text = readString(record.text);
  if (!text) {
    return null;
  }

  return {
    text,
    reason: readString(record.reason),
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const parsed = readString(item);
    return parsed ? [parsed] : [];
  });
}

function parseTaskCompletion(value: unknown): ReportTaskCompletion | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return {
    completedGoalIds: parseStringArray(record.completedGoalIds),
    missingGoalIds: parseStringArray(record.missingGoalIds),
    score:
      typeof record.score === "number" && Number.isFinite(record.score)
        ? Math.round(record.score)
        : undefined,
  };
}

export function parseReportResponse(payload: unknown): ParsedReportSections {
  const record =
    payload && typeof payload === "object"
      ? (payload as RawReportResponse)
      : ({} satisfies RawReportResponse);

  const alternativeExpressions = Array.isArray(record.alternativeExpressions)
    ? record.alternativeExpressions.flatMap((item) => {
        const parsed = parseAlternativeExpression(item);
        return parsed ? [parsed] : [];
      })
    : [];

  const shadowingRecommendations = Array.isArray(record.shadowingRecommendations)
    ? record.shadowingRecommendations.flatMap((item) => {
        const parsed = parseShadowingRecommendation(item);
        return parsed ? [parsed] : [];
      })
    : [];

  return {
    summary: readString(record.summary) ?? "",
    nextPracticeSuggestion: readString(record.nextPracticeSuggestion) ?? "",
    alternativeExpressions,
    shadowingRecommendations,
    taskCompletion: parseTaskCompletion(record.taskCompletion),
  };
}
