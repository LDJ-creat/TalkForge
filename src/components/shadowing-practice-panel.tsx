import type { ShadowingItem } from "@/domain/shadowing";

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
      ? `Standard audio ready (${durationSeconds}s)`
      : "Standard audio ready";
  }

  if (item.standardAudioStatus === "failed") {
    return "Standard audio unavailable";
  }

  return "Generating standard audio…";
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
        <h2 className="shadowing-practice__title">Shadowing practice</h2>
        <p>Preparing recommended sentences and standard audio…</p>
      </section>
    );
  }

  if (status === "unavailable" || items.length === 0) {
    return (
      <section
        className="shadowing-practice shadowing-practice--muted"
        data-testid="shadowing-practice-unavailable"
      >
        <h2 className="shadowing-practice__title">Shadowing practice</h2>
        <p>
          Shadowing items are not available yet. Finish your session report processing and
          try again shortly.
        </p>
      </section>
    );
  }

  return (
    <section className="shadowing-practice" data-testid="shadowing-practice-panel">
      <h2 className="shadowing-practice__title">Shadowing practice</h2>
      <p className="shadowing-practice__summary">
        Practice these sentences with standard audio. Pronunciation scoring can be added later.
      </p>
      <ol className="shadowing-practice__list">
        {items.map((item) => (
          <li key={item.id} className="shadowing-practice__item">
            <p className="shadowing-practice__standard">{item.standardText}</p>
            {item.originalText ? (
              <p className="shadowing-practice__original">
                Your phrase: {item.originalText}
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
