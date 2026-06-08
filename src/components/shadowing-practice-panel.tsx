import type { ShadowingItem } from "@/domain/shadowing";
import { shadowingCopy } from "@/lib/ui-copy";

import { LoadingState } from "./loading-state";
import { ShadowingPracticeRecorder } from "./shadowing-practice-recorder";
import { ShadowingStandardAudioPlayer } from "./shadowing-standard-audio-player";

type ShadowingPracticePanelProps = {
  sessionId?: string;
  items: ShadowingItem[];
  status: "idle" | "loading" | "ready" | "unavailable";
};

function renderAudioControls(sessionId: string | undefined, item: ShadowingItem) {
  if (item.standardAudioStatus === "ready" && item.standardAudio && sessionId) {
    return (
      <ShadowingStandardAudioPlayer
        sessionId={sessionId}
        itemId={item.id}
        standardAudio={item.standardAudio}
      />
    );
  }

  if (item.standardAudioStatus === "failed") {
    return <p className="shadowing-practice__audio-status">{shadowingCopy.audioUnavailable}</p>;
  }

  return <p className="shadowing-practice__audio-status">{shadowingCopy.generatingAudio}</p>;
}

export function ShadowingPracticePanel({
  sessionId,
  items,
  status,
}: ShadowingPracticePanelProps) {
  if (status === "idle") {
    return null;
  }

  if (status === "loading") {
    return (
      <section className="shadowing-practice" data-testid="shadowing-practice-loading">
        <h2 className="shadowing-practice__title">{shadowingCopy.title}</h2>
        <LoadingState variant="inline" label={shadowingCopy.loading} />
      </section>
    );
  }

  if (status === "unavailable" || items.length === 0) {
    return (
      <section
        className="shadowing-practice shadowing-practice--muted"
        data-testid="shadowing-practice-unavailable"
      >
        <h2 className="shadowing-practice__title">{shadowingCopy.title}</h2>
        <p>{shadowingCopy.unavailable}</p>
      </section>
    );
  }

  return (
    <section className="shadowing-practice" data-testid="shadowing-practice-panel">
      <h2 className="shadowing-practice__title">{shadowingCopy.title}</h2>
      <p className="shadowing-practice__summary">{shadowingCopy.summary}</p>
      <ol className="shadowing-practice__list">
        {items.map((item) => (
          <li key={item.id} className="shadowing-practice__item">
            <p className="shadowing-practice__standard">{item.standardText}</p>
            {item.originalText ? (
              <p className="shadowing-practice__original">
                {shadowingCopy.yourPhrase}：{item.originalText}
              </p>
            ) : null}
            {item.reason ? (
              <p className="shadowing-practice__hint">{item.reason}</p>
            ) : null}
            {renderAudioControls(sessionId, item)}
            {sessionId ? (
              <ShadowingPracticeRecorder
                sessionId={sessionId}
                itemId={item.id}
                standardText={item.standardText}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

