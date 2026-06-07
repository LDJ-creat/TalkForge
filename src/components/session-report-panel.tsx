import type { Report } from "@/domain/report";
import { reportCopy } from "@/lib/ui-copy";

import { LoadingState } from "./loading-state";

type SessionReportDetailsProps = {
  report: Report;
};

export function SessionReportDetails({ report }: SessionReportDetailsProps) {
  return (
    <>
      <div className="session-report__section">
        <h3>{reportCopy.taskCompletion}</h3>
        <p>
          {reportCopy.completed}：{report.taskCompletion.completedGoalIds.join(", ") || reportCopy.none}
        </p>
        {report.taskCompletion.missingGoalIds.length > 0 ? (
          <p>
            {reportCopy.stillToPractice}：{report.taskCompletion.missingGoalIds.join(", ")}
          </p>
        ) : null}
      </div>

      {report.keyCorrections.length > 0 ? (
        <div className="session-report__section">
          <h3>{reportCopy.keyCorrections}</h3>
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
          <h3>{reportCopy.alternativeExpressions}</h3>
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
          <h3>{reportCopy.shadowingRecommendations}</h3>
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
        <h3>{reportCopy.nextPractice}</h3>
        <p>{report.nextPracticeSuggestion}</p>
      </div>
    </>
  );
}

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
        <h2 className="session-report__title">{reportCopy.title}</h2>
        <LoadingState variant="inline" label={reportCopy.generating} />
      </section>
    );
  }

  if (status === "unavailable" || !report) {
    return (
      <section className="session-report session-report--muted" data-testid="session-report-unavailable">
        <h2 className="session-report__title">{reportCopy.title}</h2>
        <p className="session-report__summary">{reportCopy.unavailable}</p>
        {onRetry ? (
          <button
            type="button"
            className="button button--primary"
            data-testid="retry-report-button"
            onClick={onRetry}
          >
            {reportCopy.retry}
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="session-report" data-testid="session-report-panel">
      <h2 className="session-report__title">{reportCopy.title}</h2>
      <p className="session-report__summary">{report.summary}</p>
      <SessionReportDetails report={report} />
    </section>
  );
}
