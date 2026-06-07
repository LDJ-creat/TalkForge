import type { TurnPronunciationFeedback } from "@/domain/pronunciation-feedback";

import type { TranscriptEntry } from "./types";

export function formatPronunciationFeedbackSummary(
  feedback?: TurnPronunciationFeedback,
): string | null {
  if (!feedback) {
    return null;
  }

  if (feedback.evaluationStatus === "pending" || feedback.evaluationStatus === "processing") {
    return "Analyzing pronunciation…";
  }

  if (feedback.evaluationStatus === "failed") {
    return "Pronunciation evaluation unavailable";
  }

  if (feedback.evaluationStatus !== "done") {
    return null;
  }

  const parts: string[] = [];
  if (typeof feedback.overallScore === "number") {
    parts.push(`Overall ${Math.round(feedback.overallScore)}`);
  }
  if (typeof feedback.accuracyScore === "number") {
    parts.push(`Accuracy ${Math.round(feedback.accuracyScore)}`);
  }
  if (typeof feedback.fluencyScore === "number") {
    parts.push(`Fluency ${Math.round(feedback.fluencyScore)}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Pronunciation feedback ready";
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
  fallback = "Feedback will appear after each turn",
): string {
  const summary = formatPronunciationFeedbackSummary(
    findLatestUserPronunciationFeedback(transcripts),
  );
  return summary ?? fallback;
}
