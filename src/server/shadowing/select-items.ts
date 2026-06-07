import type { Correction } from "@/domain/correction";
import type { ReportShadowingRecommendation } from "@/domain/report";
import type { Scenario } from "@/domain/scenario";
import type { ShadowingItemSource } from "@/domain/shadowing";

export const DEFAULT_SHADOWING_ITEM_LIMIT = 5;

export type SelectedShadowingItem = {
  standardText: string;
  originalText?: string;
  reason?: string;
  source: ShadowingItemSource;
  turnId?: string;
};

export type SelectShadowingItemsInput = {
  scenario: Scenario;
  shadowingRecommendations: ReportShadowingRecommendation[];
  correctionsByTurnId: Map<string, Correction[]>;
  maxItems?: number;
};

function normalizePhrase(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function findCorrectionForStandardText(
  standardText: string,
  correctionsByTurnId: Map<string, Correction[]>,
): { correction: Correction; turnId: string } | null {
  const normalized = normalizePhrase(standardText);

  for (const [turnId, corrections] of correctionsByTurnId.entries()) {
    for (const correction of corrections) {
      if (
        correction.correctedText &&
        normalizePhrase(correction.correctedText) === normalized
      ) {
        return { correction, turnId };
      }
    }
  }

  return null;
}

export function selectShadowingItems(
  input: SelectShadowingItemsInput,
): SelectedShadowingItem[] {
  const maxItems = input.maxItems ?? DEFAULT_SHADOWING_ITEM_LIMIT;
  const seen = new Set<string>();
  const items: SelectedShadowingItem[] = [];

  const add = (item: SelectedShadowingItem) => {
    if (items.length >= maxItems) {
      return;
    }

    const normalized = normalizePhrase(item.standardText);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    items.push({
      ...item,
      standardText: item.standardText.trim(),
    });
  };

  for (const recommendation of input.shadowingRecommendations) {
    const match = findCorrectionForStandardText(
      recommendation.text,
      input.correctionsByTurnId,
    );

    add({
      standardText: recommendation.text,
      originalText: match?.correction.originalText,
      reason: recommendation.reason,
      source: "report_recommendation",
      turnId: match?.turnId,
    });
  }

  const rankedCorrections = [...input.correctionsByTurnId.entries()]
    .flatMap(([turnId, corrections]) =>
      corrections.map((correction) => ({ turnId, correction })),
    )
    .filter(
      ({ correction }) =>
        correction.type !== "asr_uncertain" &&
        typeof correction.correctedText === "string" &&
        correction.correctedText.trim().length > 0,
    )
    .sort(
      (left, right) => right.correction.confidence - left.correction.confidence,
    );

  for (const { turnId, correction } of rankedCorrections) {
    add({
      standardText: correction.correctedText!,
      originalText: correction.originalText,
      reason: correction.explanation,
      source: "corrected_expression",
      turnId,
    });
  }

  for (const targetExpression of input.scenario.targetExpressions) {
    add({
      standardText: targetExpression,
      reason: `Target expression from ${input.scenario.title}.`,
      source: "scenario_target_expression",
    });
  }

  return items;
}
