import type { Report } from "@/domain/report";

type SessionReportPanelProps = {
  report: Report | null;
  status: "idle" | "loading" | "ready" | "unavailable";
  onRetry?: () => void;
};

export function SessionReportPanel({ report, status, onRetry }: SessionReportPanelProps) {
  if (status === "idle") {
    return null;
  }

  if (status === "loading") {
    return (
      <section className="session-report" data-testid="session-report-loading">
        <h2 className="session-report__title">Session report</h2>
        <p className="session-report__summary">Generating your practice report…</p>
      </section>
    );
  }

  if (status === "unavailable" || !report) {
    return (
      <section className="session-report session-report--muted" data-testid="session-report-unavailable">
        <h2 className="session-report__title">Session report</h2>
        <p className="session-report__summary">
          Report is not available yet. Confirm the worker is running and provider configuration is
          valid, then retry generation.
        </p>
        {onRetry ? (
          <button
            type="button"
            className="button button--primary"
            data-testid="retry-report-button"
            onClick={onRetry}
          >
            Retry report generation
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="session-report" data-testid="session-report-panel">
      <h2 className="session-report__title">Session report</h2>
      <p className="session-report__summary">{report.summary}</p>

      <div className="session-report__section">
        <h3>Task completion</h3>
        <p>
          Completed: {report.taskCompletion.completedGoalIds.join(", ") || "none"}
        </p>
        {report.taskCompletion.missingGoalIds.length > 0 ? (
          <p>Still to practice: {report.taskCompletion.missingGoalIds.join(", ")}</p>
        ) : null}
      </div>

      {report.keyCorrections.length > 0 ? (
        <div className="session-report__section">
          <h3>Key corrections</h3>
          <ul className="session-report__list">
            {report.keyCorrections.map((correction) => (
              <li key={`${correction.turnId}-${correction.originalText}`}>
                <strong>{correction.originalText}</strong>
                {correction.correctedText ? ` → ${correction.correctedText}` : null}
                <span className="session-report__hint"> — {correction.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.alternativeExpressions.length > 0 ? (
        <div className="session-report__section">
          <h3>Alternative expressions</h3>
          <ul className="session-report__list">
            {report.alternativeExpressions.map((item) => (
              <li key={`${item.original}-${item.suggestion}`}>
                {item.original} → {item.suggestion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.shadowingRecommendations.length > 0 ? (
        <div className="session-report__section">
          <h3>Shadowing recommendations</h3>
          <ul className="session-report__list">
            {report.shadowingRecommendations.map((item) => (
              <li key={item.text}>
                {item.text}
                {item.reason ? (
                  <span className="session-report__hint"> — {item.reason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="session-report__section">
        <h3>Next practice</h3>
        <p>{report.nextPracticeSuggestion}</p>
      </div>
    </section>
  );
}
