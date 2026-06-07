import { normalizeCorrectionAnalysisItems } from "@/providers/llm/correction-policy";
import type { CorrectionAnalysisItem } from "@/providers/llm/types";

import {
  parseCorrectionResponse,
  parseGoalJudgeResponse,
  parseReportResponse,
  type ParsedGoalJudgeSections,
  type ParsedReportSections,
  type RawCorrectionResponse,
} from "./schemas";

export type ParseJsonResult<T> =
  | { ok: true; value: T; schemaFallback?: boolean }
  | { ok: false; error: string };

export function extractJsonPayload(rawContent: string): string {
  const trimmed = rawContent.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch?.[1]?.trim() ?? trimmed;
}

export function parseJsonContent(rawContent: string): ParseJsonResult<unknown> {
  const payload = extractJsonPayload(rawContent);

  try {
    return { ok: true, value: JSON.parse(payload) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON response.",
    };
  }
}

function countRawCorrectionItems(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  const corrections = (payload as RawCorrectionResponse).corrections;
  return Array.isArray(corrections) ? corrections.length : 0;
}

export function parseCorrectionItemsFromContent(
  rawContent: string,
): ParseJsonResult<CorrectionAnalysisItem[]> {
  const parsed = parseJsonContent(rawContent);
  if (!parsed.ok) {
    return parsed;
  }

  const rawCount = countRawCorrectionItems(parsed.value);
  const items = parseCorrectionResponse(parsed.value);

  if (rawCount > 0 && items.length === 0) {
    return {
      ok: false,
      error: "All correction items were invalid.",
    };
  }

  try {
    const value = normalizeCorrectionAnalysisItems(items);

    return {
      ok: true,
      value,
      schemaFallback: rawCount > value.length,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid correction schema.",
    };
  }
}

export function parseGoalJudgeSectionsFromContent(
  rawContent: string,
  options?: { validGoalIds?: Set<string>; validStageIds?: Set<string> },
): ParseJsonResult<ParsedGoalJudgeSections> {
  const parsed = parseJsonContent(rawContent);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    value: parseGoalJudgeResponse(parsed.value, options),
  };
}

export function parseReportSectionsFromContent(
  rawContent: string,
): ParseJsonResult<ParsedReportSections> {
  const parsed = parseJsonContent(rawContent);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    value: parseReportResponse(parsed.value),
  };
}
