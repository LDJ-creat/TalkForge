import type { AudioCodec, AudioFormat } from "./enums";
import type { Scenario } from "./scenario";
import type { ReportShadowingRecommendation } from "./report";

export const SHADOWING_ITEM_SOURCES = [
  "scenario_target_expression",
  "report_recommendation",
  "corrected_expression",
  "manual",
] as const;

export type ShadowingItemSource = (typeof SHADOWING_ITEM_SOURCES)[number];

export const SHADOWING_STANDARD_AUDIO_STATUSES = [
  "pending",
  "ready",
  "failed",
] as const;

export type ShadowingStandardAudioStatus =
  (typeof SHADOWING_STANDARD_AUDIO_STATUSES)[number];

export type ShadowingStandardAudio = {
  provider: string;
  objectKey: string;
  format: AudioFormat;
  codec?: AudioCodec;
  sampleRate?: number;
  durationMs?: number;
  sizeBytes: number;
  voice: string;
  speed: number;
  language: "en";
  cacheKey: string;
};

export type ShadowingItem = {
  id: string;
  sessionId?: string;
  standardText: string;
  originalText?: string;
  reason?: string;
  source: ShadowingItemSource;
  turnId?: string;
  sortOrder?: number;
  standardAudio?: ShadowingStandardAudio;
  standardAudioStatus?: ShadowingStandardAudioStatus;
  createdAt?: string;
};

export class ShadowingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShadowingValidationError";
  }
}

export function assertShadowingStandardText(
  text: string,
): asserts text is string {
  if (!text.trim()) {
    throw new ShadowingValidationError("Shadowing requires non-empty standard text.");
  }
}

export function createShadowingItemId(
  standardText: string,
  index: number,
  source: ShadowingItemSource = "manual",
  sessionId?: string,
): string {
  const slug = standardText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const scope = sessionId ? `${sessionId}-` : "";

  return `shadowing-${scope}${source}-${index}-${slug || "item"}`;
}

export function createShadowingItemsFromScenario(scenario: Scenario): ShadowingItem[] {
  return scenario.targetExpressions
    .map((text, index) => ({
      id: createShadowingItemId(text, index, "scenario_target_expression"),
      standardText: text.trim(),
      source: "scenario_target_expression" as const,
      reason: `Target expression from ${scenario.title}`,
    }))
    .filter((item) => item.standardText.length > 0);
}

export function createShadowingItemsFromRecommendations(
  recommendations: ReportShadowingRecommendation[],
): ShadowingItem[] {
  return recommendations
    .map((recommendation, index) => ({
      id: createShadowingItemId(recommendation.text, index, "report_recommendation"),
      standardText: recommendation.text.trim(),
      source: "report_recommendation" as const,
      reason: recommendation.reason,
    }))
    .filter((item) => item.standardText.length > 0);
}

export function createShadowingItemFromText(
  standardText: string,
  options: {
    index?: number;
    reason?: string;
    source?: ShadowingItemSource;
  } = {},
): ShadowingItem {
  assertShadowingStandardText(standardText);

  return {
    id: createShadowingItemId(
      standardText,
      options.index ?? 0,
      options.source ?? "manual",
    ),
    standardText: standardText.trim(),
    source: options.source ?? "manual",
    reason: options.reason,
  };
}
