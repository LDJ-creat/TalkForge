"use client";

import { useEffect, useMemo, useState } from "react";

import type { Correction } from "@/domain/correction";
import type { Scenario } from "@/domain/scenario";
import type { SessionAnalysis, SessionAnalysisTurn } from "@/domain/session-analysis";
import { fetchSessionAnalysisFromServer } from "@/features/conversation/fetch-session-analysis-api";
import { formatReportEvaluatedAt } from "@/features/conversation/fetch-scenario-reports-api";
import { pollSessionShadowingFromServer } from "@/features/conversation/fetch-shadowing-api";
import { loadingCopy, pronunciationCopy } from "@/lib/ui-copy";
import type { ShadowingItem } from "@/domain/shadowing";
import type { TranscriptEntry } from "@/features/conversation/types";

import { BackLink } from "./back-link";
import { LoadingState } from "./loading-state";
import { PronunciationFeedbackView } from "./pronunciation-feedback-view";
import { ShadowingPracticePanel } from "./shadowing-practice-panel";
import { SessionReportDetails } from "./session-report-panel";
import { TranscriptPanel } from "./transcript-panel";

type SessionAnalysisDetailProps = {
  scenario: Scenario;
  sessionId: string;
};

function toTranscriptEntries(turns: SessionAnalysisTurn[]): TranscriptEntry[] {
  return turns
    .filter((turn) => turn.transcriptText?.trim())
    .map((turn) => ({
      id: turn.id,
      role: turn.role,
      text: turn.transcriptText!.trim(),
      status: "final" as const,
      timestamp: turn.startedAt,
      pronunciationFeedback: turn.pronunciationFeedback,
    }));
}

function formatCorrectionType(type: Correction["type"]): string {
  switch (type) {
    case "grammar":
      return "Grammar";
    case "expression":
      return "Expression";
    case "vocabulary":
      return "Vocabulary";
    case "clarity":
      return "Clarity";
    case "asr_uncertain":
      return "ASR uncertain";
    default:
      return type;
  }
}

function TurnCorrections({ corrections }: { corrections: Correction[] }) {
  if (corrections.length === 0) {
    return (
      <p className="turn-analysis__empty">No grammar or expression corrections for this turn.</p>
    );
  }

  return (
    <ul className="turn-analysis__corrections">
      {corrections.map((correction) => (
        <li key={correction.id} className="turn-analysis__correction">
          <span className="turn-analysis__correction-type">
            {formatCorrectionType(correction.type)}
          </span>
          <p className="turn-analysis__correction-text">
            <strong>{correction.originalText}</strong>
            {correction.correctedText ? ` → ${correction.correctedText}` : null}
          </p>
          <p className="turn-analysis__correction-explanation">{correction.explanation}</p>
        </li>
      ))}
    </ul>
  );
}

function UserTurnPronunciation({ turn }: { turn: SessionAnalysisTurn }) {
  const feedback = turn.pronunciationFeedback;

  if (!feedback || turn.role !== "user") {
    return (
      <p className="turn-analysis__empty">Pronunciation evaluation not available for this turn.</p>
    );
  }

  if (feedback.evaluationStatus === "skipped") {
    return (
      <p className="turn-analysis__pronunciation turn-analysis__pronunciation--failed">
        {pronunciationCopy.skipped}
      </p>
    );
  }

  if (feedback.evaluationStatus === "failed") {
    return (
      <p className="turn-analysis__pronunciation turn-analysis__pronunciation--failed">
        {pronunciationCopy.unavailable}
      </p>
    );
  }

  if (feedback.evaluationStatus !== "done") {
    return (
      <p className="turn-analysis__pronunciation turn-analysis__pronunciation--pending">
        {pronunciationCopy.analyzing}
      </p>
    );
  }

  return (
    <PronunciationFeedbackView
      feedback={feedback}
      idPrefix={turn.id}
      className="turn-analysis__pronunciation"
      testId="turn-pronunciation-detail"
    />
  );
}

function TurnAnalysisList({ turns }: { turns: SessionAnalysisTurn[] }) {
  const userTurns = turns.filter((turn) => turn.role === "user" && turn.transcriptText?.trim());

  if (userTurns.length === 0) {
    return <p className="session-analysis__empty">No user turns with transcript text yet.</p>;
  }

  return (
    <ol className="turn-analysis-list">
      {userTurns.map((turn, index) => (
        <li key={turn.id} className="turn-analysis" data-testid={`turn-analysis-${turn.id}`}>
          <h3 className="turn-analysis__title">Your turn {index + 1}</h3>
          <blockquote className="turn-analysis__quote">{turn.transcriptText}</blockquote>

          <section className="turn-analysis__section">
            <h4>Grammar & expression</h4>
            <TurnCorrections corrections={turn.corrections} />
          </section>

          <section className="turn-analysis__section">
            <h4>Pronunciation</h4>
            <UserTurnPronunciation turn={turn} />
          </section>
        </li>
      ))}
    </ol>
  );
}

export function SessionAnalysisDetail({ scenario, sessionId }: SessionAnalysisDetailProps) {
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const [shadowingItems, setShadowingItems] = useState<ShadowingItem[]>([]);
  const [shadowingStatus, setShadowingStatus] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "mismatch">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchSessionAnalysisFromServer(sessionId);
        if (cancelled) {
          return;
        }

        if (result.session.scenarioId !== scenario.id) {
          setStatus("mismatch");
          return;
        }

        setAnalysis(result);
        setStatus("ready");

        if (result.shadowingItems.length > 0) {
          setShadowingItems(result.shadowingItems);
          setShadowingStatus("ready");
          return;
        }

        if (result.report.shadowingRecommendations.length === 0) {
          setShadowingStatus("unavailable");
          return;
        }

        setShadowingStatus("loading");
        const items = await pollSessionShadowingFromServer(sessionId, {
          attempts: 40,
          intervalMs: 1500,
        });

        if (cancelled) {
          return;
        }

        setShadowingItems(items);
        setShadowingStatus(items.length > 0 ? "ready" : "unavailable");
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load session analysis.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scenario.id, sessionId]);

  const transcriptEntries = useMemo(
    () => (analysis ? toTranscriptEntries(analysis.turns) : []),
    [analysis],
  );

  const practiceHref = `/practice/${scenario.id}`;

  if (status === "loading") {
    return (
      <main className="session-analysis session-analysis--loading" data-testid="session-analysis-loading">
        <LoadingState variant="page" label={loadingCopy.sessionAnalysis} />
      </main>
    );
  }

  if (status === "mismatch") {
    return (
      <main className="session-analysis session-analysis--error" data-testid="session-analysis-mismatch">
        <p>This session does not belong to the selected scenario.</p>
        <BackLink href={practiceHref}>Back to {scenario.title}</BackLink>
      </main>
    );
  }

  if (status === "error" || !analysis) {
    return (
      <main className="session-analysis session-analysis--error" data-testid="session-analysis-error">
        <p>{errorMessage ?? "Could not load session analysis."}</p>
        <BackLink href={practiceHref}>Back to {scenario.title}</BackLink>
      </main>
    );
  }

  const evaluatedAt = analysis.report.createdAt;

  return (
    <main className="session-analysis" data-testid="session-analysis-detail">
      <header className="session-analysis__header">
        <BackLink href={practiceHref}>Back to {scenario.title}</BackLink>
        <div className="session-analysis__heading">
          <h1 className="session-analysis__title">Session analysis</h1>
          <p className="session-analysis__meta">
            <time dateTime={evaluatedAt}>{formatReportEvaluatedAt(evaluatedAt)}</time>
            <span aria-hidden="true"> · </span>
            {scenario.title}
          </p>
        </div>
      </header>

      <section className="session-analysis__section-card">
        <h2 className="session-analysis__section-title">Session report</h2>
        <p className="session-report__summary">{analysis.report.summary}</p>
        <SessionReportDetails report={analysis.report} />
      </section>

      <section className="session-analysis__section-card">
        <h2 className="session-analysis__section-title">Full transcript</h2>
        <TranscriptPanel entries={transcriptEntries} />
      </section>

      <section className="session-analysis__section-card">
        <h2 className="session-analysis__section-title">Grammar, expression & pronunciation</h2>
        <p className="session-analysis__section-intro">
          Turn-by-turn feedback from correction and pronunciation workers.
        </p>
        <TurnAnalysisList turns={analysis.turns} />
      </section>

      <section className="session-analysis__section-card">
        <ShadowingPracticePanel
          sessionId={sessionId}
          items={shadowingItems}
          status={shadowingStatus}
        />
      </section>
    </main>
  );
}
