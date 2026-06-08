import type { TurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
import { enrichTurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
import { pronunciationCopy, statusCopy } from "@/lib/ui-copy";

import type { TranscriptEntry } from "./types";

export function formatPronunciationFeedbackSummary(
  feedback?: TurnPronunciationFeedback,
): string | null {
  if (!feedback) {
    return null;
  }

  if (feedback.evaluationStatus === "pending" || feedback.evaluationStatus === "processing") {
    return pronunciationCopy.analyzing;
  }

  if (feedback.evaluationStatus === "skipped") {
    return pronunciationCopy.skipped;
  }

  if (feedback.evaluationStatus === "failed") {
    return pronunciationCopy.unavailable;
  }

  if (feedback.evaluationStatus !== "done") {
    return null;
  }

  const enriched = enrichTurnPronunciationFeedback(feedback);
  const parts: string[] = [];
  if (typeof enriched.overallScore === "number") {
    parts.push(pronunciationCopy.overall(enriched.overallScore));
  }
  if (typeof enriched.accuracyScore === "number") {
    parts.push(pronunciationCopy.accuracy(enriched.accuracyScore));
  }
  if (typeof enriched.fluencyScore === "number") {
    parts.push(pronunciationCopy.fluency(enriched.fluencyScore));
  }
  if (typeof enriched.completenessScore === "number") {
    parts.push(pronunciationCopy.completeness(enriched.completenessScore));
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function findLatestUserPronunciationFeedback(
  transcripts: TranscriptEntry[],
): TurnPronunciationFeedback | undefined {
  for (let index = transcripts.length - 1; index >= 0; index -= 1) {
    const entry = transcripts[index];
    if (entry.role === "user" && entry.pronunciationFeedback) {
      return entry.pronunciationFeedback;
    }
  }

  return undefined;
}

export function formatLatestEvaluationPlaceholder(
  transcripts: TranscriptEntry[],
  fallback = statusCopy.evaluationPlaceholder,
): string {
  const summary = formatPronunciationFeedbackSummary(
    findLatestUserPronunciationFeedback(transcripts),
  );
  return summary ?? fallback;
}
