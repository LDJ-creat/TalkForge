import type { TranscriptEntry } from "@/features/conversation";
import { formatPronunciationFeedbackSummary } from "@/features/conversation/format-pronunciation-feedback";

type TranscriptPanelProps = {
  entries: TranscriptEntry[];
};

function renderUserPronunciationFeedback(entry: TranscriptEntry) {
  const feedback = entry.pronunciationFeedback;
  if (!feedback || entry.role !== "user") {
    return null;
  }

  if (feedback.evaluationStatus === "pending" || feedback.evaluationStatus === "processing") {
    return (
      <p className="transcript-entry__pronunciation transcript-entry__pronunciation--pending">
        Analyzing pronunciation…
      </p>
    );
  }

  if (feedback.evaluationStatus === "failed") {
    return (
      <p className="transcript-entry__pronunciation transcript-entry__pronunciation--failed">
        Pronunciation evaluation unavailable for this turn.
      </p>
    );
  }

  if (feedback.evaluationStatus !== "done") {
    return null;
  }

  const summary = formatPronunciationFeedbackSummary(feedback);

  return (
    <div className="transcript-entry__pronunciation" data-testid="transcript-pronunciation-feedback">
      {summary ? (
        <p className="transcript-entry__pronunciation-summary">{summary}</p>
      ) : null}
      {feedback.words && feedback.words.length > 0 ? (
        <div className="transcript-entry__word-list">
          {feedback.words.map((word) => (
            <span
              key={`${entry.id}-${word.word}`}
              className={`transcript-entry__word${
                word.status === "weak" ? " transcript-entry__word--weak" : ""
              }`}
              title={
                typeof word.score === "number"
                  ? `${word.word}: ${Math.round(word.score)}`
                  : word.word
              }
            >
              {word.word}
            </span>
          ))}
        </div>
      ) : null}
      <p className="transcript-entry__pronunciation-note">
        Scores are based on the recognized transcript for this turn.
      </p>
    </div>
  );
}

export function TranscriptPanel({ entries }: TranscriptPanelProps) {
  if (entries.length === 0) {
    return (
      <div className="conversation-panel" data-testid="transcript-panel">
        <h2 className="conversation-panel__title">Transcript</h2>
        <p className="transcript-entry__text transcript-entry__text--pending">
          Transcript will appear here once the session starts.
        </p>
      </div>
    );
  }

  return (
    <div className="conversation-panel" data-testid="transcript-panel">
      <h2 className="conversation-panel__title">Transcript</h2>
      <div className="transcript-list">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className={`transcript-entry transcript-entry--${entry.role}`}
            data-testid={`transcript-entry-${entry.role}`}
          >
            <div className="transcript-entry__meta">
              <span>{entry.role === "assistant" ? "AI" : "You"}</span>
              <span>{entry.status}</span>
            </div>
            <p
              className={`transcript-entry__text${
                entry.status === "pending" ? " transcript-entry__text--pending" : ""
              }`}
            >
              {entry.text}
            </p>
            {renderUserPronunciationFeedback(entry)}
          </article>
        ))}
      </div>
    </div>
  );
}
