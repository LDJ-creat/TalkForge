import type { ShadowingItem } from "@/domain/shadowing";
import { shadowingCopy } from "@/lib/ui-copy";

type ShadowingPracticePanelProps = {
  items: ShadowingItem[];
  status: "idle" | "loading" | "ready" | "unavailable";
};

function formatAudioStatus(item: ShadowingItem): string {
  if (item.standardAudioStatus === "ready" && item.standardAudio) {
    const durationSeconds = item.standardAudio.durationMs
      ? Math.round(item.standardAudio.durationMs / 1000)
      : null;
    return durationSeconds
      ? shadowingCopy.audioReadyDuration(durationSeconds)
      : shadowingCopy.audioReady;
  }

  if (item.standardAudioStatus === "failed") {
    return shadowingCopy.audioUnavailable;
  }

  return shadowingCopy.generatingAudio;
}

export function ShadowingPracticePanel({
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
        <p>{shadowingCopy.loading}</p>
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
            <p className="shadowing-practice__audio-status">{formatAudioStatus(item)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
