import type { TurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
import {
  enrichTurnPronunciationFeedback,
  filterPronunciationDisplayWords,
} from "@/domain/pronunciation-feedback";
import { formatPronunciationFeedbackSummary } from "@/features/conversation/format-pronunciation-feedback";
import { pronunciationCopy } from "@/lib/ui-copy";

type PronunciationFeedbackViewProps = {
  feedback: TurnPronunciationFeedback;
  idPrefix: string;
  className?: string;
  testId?: string;
};

function formatWordScore(score: number | undefined): string | null {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }

  return Math.round(score).toString();
}

export function PronunciationFeedbackView({
  feedback,
  idPrefix,
  className = "transcript-entry__pronunciation",
  testId = "pronunciation-feedback-view",
}: PronunciationFeedbackViewProps) {
  const enriched = enrichTurnPronunciationFeedback(feedback);
  const summary = formatPronunciationFeedbackSummary(enriched);
  const displayWords = filterPronunciationDisplayWords(enriched.words ?? []);

  return (
    <div className={className} data-testid={testId}>
      {summary ? (
        <p className="transcript-entry__pronunciation-summary">{summary}</p>
      ) : null}
      {displayWords.length > 0 ? (
        <>
          <p className="transcript-entry__pronunciation-legend">{pronunciationCopy.weakLegend}</p>
          <div className="transcript-entry__word-list">
            {displayWords.map((word, index) => {
              const scoreLabel = formatWordScore(word.score);

              return (
                <span
                  key={`${idPrefix}-word-${index}`}
                  className={`transcript-entry__word${
                    word.status === "weak" ? " transcript-entry__word--weak" : ""
                  }`}
                  title={
                    scoreLabel
                      ? pronunciationCopy.wordScore(word.word, Number(scoreLabel))
                      : word.word
                  }
                >
                  <span className="transcript-entry__word-text">{word.word}</span>
                  {scoreLabel ? (
                    <span className="transcript-entry__word-score">{scoreLabel}</span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </>
      ) : null}
      <p className="transcript-entry__pronunciation-note">{pronunciationCopy.scoreNote}</p>
    </div>
  );
}
