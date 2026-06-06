import type { CorrectionType } from "@/domain/enums";
import type { CorrectionAnalysisItem } from "./types";

/** Below this overall transcript confidence, corrections skew toward ASR uncertainty. */
export const ASR_UNCERTAIN_CONFIDENCE_THRESHOLD = 0.6;

/** Recent turns included as conversational context for correction analysis. */
export const RECENT_CONTEXT_TURN_LIMIT = 5;

const CORRECTION_TYPE_SET = new Set<CorrectionType>([
  "grammar",
  "expression",
  "vocabulary",
  "clarity",
  "asr_uncertain",
]);

const CORRECTED_TEXT_REQUIRED_TYPES = new Set<CorrectionType>([
  "grammar",
  "expression",
  "vocabulary",
  "clarity",
]);

export function isLowConfidenceTranscript(confidence: number | undefined): boolean {
  return confidence !== undefined && confidence < ASR_UNCERTAIN_CONFIDENCE_THRESHOLD;
}

export function normalizeCorrectionAnalysisItems(
  items: CorrectionAnalysisItem[],
): CorrectionAnalysisItem[] {
  return items.map((item, index) => {
    if (!CORRECTION_TYPE_SET.has(item.type)) {
      throw new Error(`Correction item ${index} has unsupported type "${item.type}".`);
    }

    const originalText = item.originalText.trim();
    if (!originalText) {
      throw new Error(`Correction item ${index} is missing originalText.`);
    }

    const explanation = item.explanation.trim();
    if (!explanation) {
      throw new Error(`Correction item ${index} is missing explanation.`);
    }

    if (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) {
      throw new Error(`Correction item ${index} has invalid confidence.`);
    }

    const correctedText = item.correctedText?.trim() || undefined;

    if (item.type === "asr_uncertain" && correctedText !== undefined) {
      throw new Error(`Correction item ${index} must not include correctedText for asr_uncertain.`);
    }

    if (CORRECTED_TEXT_REQUIRED_TYPES.has(item.type) && !correctedText) {
      throw new Error(`Correction item ${index} must include correctedText for type "${item.type}".`);
    }

    return {
      ...item,
      originalText,
      explanation,
      correctedText,
    };
  });
}
