"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ScenarioHistoricalReport } from "@/domain/scenario-report-history";
import {
  formatHistoricalReportHeadline,
  formatHistoricalReportMeta,
  formatReportEvaluatedAt,
} from "@/features/conversation/fetch-scenario-reports-api";
import { retrySessionReportFromServer } from "@/features/conversation/retry-session-report-api";
import { reportCopy, scenarioEntryCopy } from "@/lib/ui-copy";

import { LoadingState } from "./loading-state";
import { SessionReportDetails } from "./session-report-panel";

type HistoricalReportCardProps = {
  item: ScenarioHistoricalReport;
  scenarioId: string;
  onReportUpdated?: (item: ScenarioHistoricalReport) => void;
};

export function HistoricalReportCard({
  item,
  scenarioId,
  onReportUpdated,
}: HistoricalReportCardProps) {
  const [currentItem, setCurrentItem] = useState(item);
  const [retryStatus, setRetryStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    setCurrentItem(item);
    setRetryStatus("idle");
  }, [item]);

  const summaryId = `historical-report-summary-${currentItem.sessionId}`;
  const detailsId = `historical-report-details-${currentItem.sessionId}`;
  const detailHref = `/practice/${scenarioId}/sessions/${currentItem.sessionId}`;
  const headline = formatHistoricalReportHeadline(currentItem);
  const canExpandDetails = currentItem.status === "ready" && Boolean(currentItem.report);
  const canRetry =
    currentItem.status === "failed" || currentItem.status === "generating";

  async function handleRetry() {
    if (!canRetry || retryStatus === "loading") {
      return;
    }

    setRetryStatus("loading");

    try {
      const report = await retrySessionReportFromServer(currentItem.sessionId);
      if (!report) {
        setRetryStatus("error");
        return;
      }

      const updatedItem: ScenarioHistoricalReport = {
        ...currentItem,
        status: "ready",
        report,
        evaluatedAt: report.createdAt,
      };
      setCurrentItem(updatedItem);
      setRetryStatus("idle");
      onReportUpdated?.(updatedItem);
    } catch {
      setRetryStatus("error");
    }
  }

  return (
    <article
      className={`historical-report-card${
        currentItem.status === "failed"
          ? " historical-report-card--failed"
          : currentItem.status === "generating"
            ? " historical-report-card--generating"
            : ""
      }`}
      data-testid={`historical-report-${currentItem.sessionId}`}
      data-report-status={currentItem.status}
    >
      <details className="historical-report-card__details" open={!canExpandDetails}>
        <summary
          className="historical-report-card__summary"
          aria-controls={detailsId}
          id={summaryId}
        >
          <div className="historical-report-card__summary-main">
            <time className="historical-report-card__date" dateTime={currentItem.evaluatedAt}>
              {formatReportEvaluatedAt(currentItem.evaluatedAt)}
            </time>
            <p className="historical-report-card__headline">{headline}</p>
          </div>
          <div className="historical-report-card__actions">
            <span className="historical-report-card__meta">
              {formatHistoricalReportMeta(currentItem.status, currentItem.report)}
            </span>
            <Link
              href={detailHref}
              className="button button--secondary historical-report-card__detail-link"
              data-testid={`historical-report-detail-link-${currentItem.sessionId}`}
              onClick={(event) => event.stopPropagation()}
            >
              {scenarioEntryCopy.viewSessionDetails}
            </Link>
            {canRetry ? (
              <button
                type="button"
                className="button button--primary historical-report-card__retry-button"
                data-testid={`historical-report-retry-${currentItem.sessionId}`}
                disabled={retryStatus === "loading"}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleRetry();
                }}
              >
                {retryStatus === "loading"
                  ? scenarioEntryCopy.historicalReportRetrying
                  : reportCopy.retry}
              </button>
            ) : null}
          </div>
        </summary>
        <div
          className="historical-report-card__body"
          id={detailsId}
          aria-labelledby={summaryId}
        >
          {retryStatus === "loading" ? (
            <LoadingState
              variant="inline"
              label={scenarioEntryCopy.historicalReportRetrying}
              testId={`historical-report-retry-loading-${currentItem.sessionId}`}
            />
          ) : null}
          {retryStatus === "error" ? (
            <p className="historical-report-card__error">{reportCopy.unavailable}</p>
          ) : null}
          {canExpandDetails && currentItem.report ? (
            <SessionReportDetails report={currentItem.report} />
          ) : null}
        </div>
      </details>
    </article>
  );
}
