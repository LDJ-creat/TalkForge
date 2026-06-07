"use client";

import type { ScenarioHistoricalReport } from "@/domain/scenario-report-history";
import {
  formatReportEvaluatedAt,
  formatTaskCompletionSummary,
} from "@/features/conversation/fetch-scenario-reports-api";

import { SessionReportDetails } from "./session-report-panel";

type HistoricalReportCardProps = {
  item: ScenarioHistoricalReport;
};

export function HistoricalReportCard({ item }: HistoricalReportCardProps) {
  const summaryId = `historical-report-summary-${item.sessionId}`;
  const detailsId = `historical-report-details-${item.sessionId}`;

  return (
    <article className="historical-report-card" data-testid={`historical-report-${item.sessionId}`}>
      <details className="historical-report-card__details">
        <summary
          className="historical-report-card__summary"
          aria-controls={detailsId}
          id={summaryId}
        >
          <div className="historical-report-card__summary-main">
            <time className="historical-report-card__date" dateTime={item.evaluatedAt}>
              {formatReportEvaluatedAt(item.evaluatedAt)}
            </time>
            <p className="historical-report-card__headline">{item.report.summary}</p>
          </div>
          <span className="historical-report-card__meta">
            {formatTaskCompletionSummary(item.report)}
          </span>
        </summary>
        <div
          className="historical-report-card__body"
          id={detailsId}
          aria-labelledby={summaryId}
        >
          <SessionReportDetails report={item.report} />
        </div>
      </details>
    </article>
  );
}
