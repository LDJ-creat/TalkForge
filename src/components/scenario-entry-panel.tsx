"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Scenario } from "@/domain/scenario";
import type { ScenarioHistoricalReport } from "@/domain/scenario-report-history";
import { fetchScenarioReportsFromServer } from "@/features/conversation/fetch-scenario-reports-api";
import { formatScenarioEntrySubtitle } from "@/lib/format-scenario-display";
import { navCopy, scenarioEntryCopy } from "@/lib/ui-copy";

import { HistoricalReportCard } from "./historical-report-card";

type ScenarioEntryPanelProps = {
  scenario: Scenario;
  onStartPractice: () => void;
};

export function ScenarioEntryPanel({ scenario, onStartPractice }: ScenarioEntryPanelProps) {
  const [reports, setReports] = useState<ScenarioHistoricalReport[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextReports = await fetchScenarioReportsFromServer(scenario.id);
        if (!cancelled) {
          setReports(nextReports);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scenario.id]);

  return (
    <main className="scenario-entry" data-testid="scenario-entry-panel">
      <header className="scenario-entry__header">
        <div className="scenario-entry__info">
          <Link href="/" className="scenario-entry__back">
            {navCopy.allScenarios}
          </Link>
          <h1 className="scenario-entry__title">{scenario.title}</h1>
          <p className="scenario-entry__subtitle">{formatScenarioEntrySubtitle(scenario)}</p>
          <p className="scenario-entry__description">{scenario.description}</p>
        </div>
        <button
          type="button"
          className="button button--primary scenario-entry__start"
          data-testid="start-practice-button"
          onClick={onStartPractice}
        >
          {scenarioEntryCopy.startConversation}
        </button>
      </header>

      <section className="scenario-entry__history" aria-labelledby="scenario-history-title">
        <h2 id="scenario-history-title" className="scenario-entry__history-title">
          {scenarioEntryCopy.practiceHistory}
        </h2>

        {status === "loading" ? (
          <p className="scenario-entry__history-message" data-testid="scenario-history-loading">
            {scenarioEntryCopy.loadingHistory}
          </p>
        ) : null}

        {status === "error" ? (
          <p className="scenario-entry__history-message scenario-entry__history-message--error">
            {scenarioEntryCopy.loadHistoryError}
          </p>
        ) : null}

        {status === "ready" && reports.length === 0 ? (
          <p className="scenario-entry__history-message" data-testid="scenario-history-empty">
            {scenarioEntryCopy.emptyHistory}
          </p>
        ) : null}

        {status === "ready" && reports.length > 0 ? (
          <div className="scenario-entry__history-list" data-testid="scenario-history-list">
            {reports.map((item) => (
              <HistoricalReportCard key={item.sessionId} item={item} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
