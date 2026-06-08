"use client";

import { useEffect, useRef } from "react";

import type { TranscriptEntry } from "@/features/conversation";
import { pronunciationCopy, transcriptCopy } from "@/lib/ui-copy";

import { PronunciationFeedbackView } from "./pronunciation-feedback-view";

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
        {transcriptCopy.analyzing}
      </p>
    );
  }

  if (feedback.evaluationStatus === "skipped") {
    return (
      <p className="transcript-entry__pronunciation transcript-entry__pronunciation--failed">
        {transcriptCopy.evaluationSkipped}
      </p>
    );
  }

  if (feedback.evaluationStatus === "failed") {
    return (
      <p className="transcript-entry__pronunciation transcript-entry__pronunciation--failed">
        {transcriptCopy.evaluationFailed}
      </p>
    );
  }

  if (feedback.evaluationStatus !== "done") {
    return null;
  }

  return (
    <PronunciationFeedbackView
      feedback={feedback}
      idPrefix={entry.id}
      testId="transcript-pronunciation-feedback"
    />
  );
}

export function TranscriptPanel({ entries }: TranscriptPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    if (typeof list.scrollTo === "function") {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
      return;
    }

    list.scrollTop = list.scrollHeight;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="conversation-panel" data-testid="transcript-panel">
        <h2 className="conversation-panel__title">{transcriptCopy.title}</h2>
        <p className="transcript-entry__text transcript-entry__text--pending">
          {transcriptCopy.empty}
        </p>
      </div>
    );
  }

  return (
    <div className="conversation-panel" data-testid="transcript-panel">
      <h2 className="conversation-panel__title">{transcriptCopy.title}</h2>
      <div className="transcript-list" ref={listRef}>
        {entries.map((entry) => (
          <article
            key={entry.id}
            className={`transcript-entry transcript-entry--${entry.role}`}
            data-testid={`transcript-entry-${entry.role}`}
          >
            <div className="transcript-entry__meta">
              <span>
                {entry.role === "assistant" ? transcriptCopy.roleAssistant : transcriptCopy.roleUser}
              </span>
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
