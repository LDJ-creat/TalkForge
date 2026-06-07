"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Scenario } from "@/domain/scenario";
import type { ScenarioHistoricalReport } from "@/domain/scenario-report-history";
import { fetchScenarioReportsFromServer } from "@/features/conversation/fetch-scenario-reports-api";

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
            ← All scenarios
          </Link>
          <h1 className="scenario-entry__title">{scenario.title}</h1>
          <p className="scenario-entry__subtitle">
            {scenario.userRole} · {scenario.level} · {scenario.situation}
          </p>
          <p className="scenario-entry__description">{scenario.description}</p>
        </div>
        <button
          type="button"
          className="button button--primary scenario-entry__start"
          data-testid="start-practice-button"
          onClick={onStartPractice}
        >
          Start conversation
        </button>
      </header>

      <section className="scenario-entry__history" aria-labelledby="scenario-history-title">
        <h2 id="scenario-history-title" className="scenario-entry__history-title">
          Practice history
        </h2>

        {status === "loading" ? (
          <p className="scenario-entry__history-message" data-testid="scenario-history-loading">
            Loading past reports…
          </p>
        ) : null}

        {status === "error" ? (
          <p className="scenario-entry__history-message scenario-entry__history-message--error">
            Could not load practice history. You can still start a new conversation.
          </p>
        ) : null}

        {status === "ready" && reports.length === 0 ? (
          <p className="scenario-entry__history-message" data-testid="scenario-history-empty">
            No past reports yet. Start your first conversation below.
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
