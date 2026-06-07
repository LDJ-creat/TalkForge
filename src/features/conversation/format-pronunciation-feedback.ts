import type { TurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
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

  if (feedback.evaluationStatus === "failed") {
    return pronunciationCopy.unavailable;
  }

  if (feedback.evaluationStatus !== "done") {
    return null;
  }

  const parts: string[] = [];
  if (typeof feedback.overallScore === "number") {
    parts.push(pronunciationCopy.overall(feedback.overallScore));
  }
  if (typeof feedback.accuracyScore === "number") {
    parts.push(pronunciationCopy.accuracy(feedback.accuracyScore));
  }
  if (typeof feedback.fluencyScore === "number") {
    parts.push(pronunciationCopy.fluency(feedback.fluencyScore));
  }

  return parts.length > 0 ? parts.join(" · ") : pronunciationCopy.ready;
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
