import type { TranscriptEntry } from "@/features/conversation";

type TranscriptPanelProps = {
  entries: TranscriptEntry[];
};

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
          </article>
        ))}
      </div>
    </div>
  );
}
