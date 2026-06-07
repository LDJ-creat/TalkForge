"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";

import type { Scenario } from "@/domain/scenario";
import { useConversationStore } from "@/features/conversation";
import { formatLatestEvaluationPlaceholder } from "@/features/conversation/format-pronunciation-feedback";
import { isSessionUsageBlocked } from "@/shared/usage-limit-messages";
import { formatScenarioEntrySubtitle } from "@/lib/format-scenario-display";
import { conversationCopy, navCopy } from "@/lib/ui-copy";
import {
  canEnterFallback,
  canRetryRealtime,
} from "@/features/conversation/realtime/lifecycle";
import { syncRealtimeAudioCapture } from "@/features/conversation/realtime/realtime-audio-bridge";
import { SCENARIO_PROGRESS_REFRESH_INTERVAL_MS } from "@/features/conversation/types";

import { SessionReportPanel } from "./session-report-panel";
import { ShadowingPracticePanel } from "./shadowing-practice-panel";
import { SessionStatusBar } from "./session-status-bar";
import { TranscriptPanel } from "./transcript-panel";
import { VoiceVisualizer } from "./voice-visualizer";

type ConversationShellProps = {
  scenario: Scenario;
};

const SHOW_REALTIME_DEBUG =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

let conversationShellMountSeq = 0;

export function ConversationShell({ scenario }: ConversationShellProps) {
  const {
    session,
    realtimeCredentials,
    realtimeLifecycleStatus,
    realtimeDiagnostics,
    connectionStatus,
    turnStatus,
    transcripts,
    endingState,
    endingSuggestionReason,
    scenarioProgress,
    usageLimits,
    errorMessage,
    report,
    reportStatus,
    shadowingItems,
    shadowingStatus,
  } = useConversationStore(
    useShallow((state) => ({
      session: state.session,
      realtimeCredentials: state.realtimeCredentials,
      realtimeLifecycleStatus: state.realtimeLifecycleStatus,
      realtimeDiagnostics: state.realtimeDiagnostics,
      connectionStatus: state.connectionStatus,
      turnStatus: state.turnStatus,
      transcripts: state.transcripts,
      endingState: state.endingState,
      endingSuggestionReason: state.endingSuggestionReason,
      scenarioProgress: state.scenarioProgress,
      usageLimits: state.usageLimits,
      errorMessage: state.errorMessage,
      report: state.report,
      reportStatus: state.reportStatus,
      shadowingItems: state.shadowingItems,
      shadowingStatus: state.shadowingStatus,
    })),
  );

  const startSession = useConversationStore((state) => state.startSession);
  const submitMockPracticeTurn = useConversationStore((state) => state.submitMockPracticeTurn);
  const requestEndSession = useConversationStore((state) => state.requestEndSession);
  const refreshScenarioProgress = useConversationStore((state) => state.refreshScenarioProgress);
  const retryRealtimeConnection = useConversationStore((state) => state.retryRealtimeConnection);
  const enterRealtimeFallback = useConversationStore((state) => state.enterRealtimeFallback);
  const interruptRealtimeAssistant = useConversationStore(
    (state) => state.interruptRealtimeAssistant,
  );
  const retrySessionReport = useConversationStore((state) => state.retrySessionReport);

  useEffect(() => {
    const mountId = ++conversationShellMountSeq;

    void startSession(scenario);

    return () => {
      const teardownMountId = mountId;
      window.setTimeout(() => {
        if (conversationShellMountSeq === teardownMountId) {
          void useConversationStore.getState().teardownSession();
        }
      }, 50);
    };
  }, [scenario.id, startSession]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const micError = await syncRealtimeAudioCapture({
        lifecycle: realtimeLifecycleStatus,
        provider: realtimeCredentials?.provider ?? session?.realtimeProvider,
        sessionId: session?.id ?? null,
      });

      if (!cancelled && micError) {
        useConversationStore.setState({ errorMessage: micError });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    realtimeLifecycleStatus,
    realtimeCredentials?.provider,
    session?.id,
    session?.realtimeProvider,
  ]);

  useEffect(() => {
    if (connectionStatus !== "connected" || session?.status !== "active") {
      return;
    }

    refreshScenarioProgress();
    const intervalId = window.setInterval(() => {
      refreshScenarioProgress();
    }, SCENARIO_PROGRESS_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [connectionStatus, refreshScenarioProgress, session?.id, session?.status]);

  const isSessionActive = session?.status === "active";
  const isEnding =
    connectionStatus === "disconnecting" ||
    endingState === "user_requested" ||
    realtimeLifecycleStatus === "ended";
  const isCompleted = session?.status === "completed" || endingState === "completed";
  const usageBlocked = usageLimits ? isSessionUsageBlocked(usageLimits) : false;
  const showMockPracticeButton =
    isSessionActive &&
    session?.backendLinked === true &&
    realtimeLifecycleStatus === "fallback" &&
    !isEnding &&
    !usageBlocked;
  const showEndingSuggestion =
    endingState === "ai_suggested" && scenarioProgress?.shouldSuggestEnding === true;
  const showRetryRealtime = isSessionActive && canRetryRealtime(realtimeLifecycleStatus);
  const showFallbackOption =
    isSessionActive && canEnterFallback(realtimeLifecycleStatus);
  const showInterruptButton =
    isSessionActive &&
    (realtimeLifecycleStatus === "assistant_speaking" ||
      realtimeLifecycleStatus === "interrupted");
  const micSignalTooLow =
    isSessionActive &&
    realtimeLifecycleStatus === "listening" &&
    (realtimeDiagnostics.audio?.micChunks ?? 0) > 40 &&
    (realtimeDiagnostics.audio?.micPeakLevel ?? 0) < 0.01;

  const endingSuggestionMessage =
    endingSuggestionReason === "required_goals_complete"
      ? conversationCopy.endingSuggestions.goalsComplete
      : endingSuggestionReason === "max_turns_reached"
        ? conversationCopy.endingSuggestions.maxTurns
        : endingSuggestionReason === "max_duration_reached"
          ? conversationCopy.endingSuggestions.maxDuration
          : conversationCopy.endingSuggestions.default;

  return (
    <div className="conversation-page" data-testid="conversation-shell">
      <header className="conversation-header">
        <div className="conversation-header__info">
          <h1 className="conversation-header__title">{scenario.title}</h1>
          <p className="conversation-header__subtitle">{formatScenarioEntrySubtitle(scenario)}</p>
        </div>
        <div className="conversation-header__actions">
          <Link href="/" className="button button--ghost">
            {navCopy.changeScenario}
          </Link>
          <button
            type="button"
            className="button button--end"
            data-testid="end-practice-button"
            onClick={() => void requestEndSession()}
            disabled={!isSessionActive || isCompleted}
          >
            {conversationCopy.endPractice}
          </button>
        </div>
      </header>

      <div className="conversation-main">
        <section className="conversation-panel">
          <h2 className="conversation-panel__title">{conversationCopy.voicePractice}</h2>
          <VoiceVisualizer turnStatus={turnStatus} />
          {micSignalTooLow ? (
            <p className="conversation-panel__hint conversation-panel__hint--warning">
              {conversationCopy.micLowHint}
            </p>
          ) : null}
          {isSessionActive &&
          realtimeLifecycleStatus === "assistant_speaking" &&
          process.env.NEXT_PUBLIC_REALTIME_BARGE_IN === "true" ? (
            <p className="conversation-panel__hint">{conversationCopy.bargeInHint}</p>
          ) : null}
          {showInterruptButton ? (
            <button
              type="button"
              className="button button--ghost conversation-practice-button"
              data-testid="interrupt-assistant-button"
              onClick={() => interruptRealtimeAssistant()}
            >
              {conversationCopy.interruptAi}
            </button>
          ) : null}
          {showMockPracticeButton ? (
            <button
              type="button"
              className="button button--primary conversation-practice-button"
              data-testid="mock-practice-turn-button"
              onClick={() => void submitMockPracticeTurn()}
              disabled={
                turnStatus === "user_speaking" ||
                turnStatus === "user_processing" ||
                turnStatus === "assistant_processing"
              }
            >
              {conversationCopy.sendPracticeResponse}
            </button>
          ) : null}
          {showRetryRealtime ? (
            <div className="conversation-recovery-actions">
              <button
                type="button"
                className="button button--primary"
                data-testid="retry-realtime-button"
                onClick={() => void retryRealtimeConnection()}
              >
                {conversationCopy.retryVoiceConnection}
              </button>
              {showFallbackOption ? (
                <button
                  type="button"
                  className="button button--ghost"
                  data-testid="fallback-practice-button"
                  onClick={() => enterRealtimeFallback()}
                >
                  {conversationCopy.continueTextPractice}
                </button>
              ) : null}
            </div>
          ) : null}
          <SessionStatusBar
            realtimeLifecycleStatus={realtimeLifecycleStatus}
            connectionStatus={connectionStatus}
            turnStatus={turnStatus}
            sessionStatus={session?.status}
            diagnostics={realtimeDiagnostics}
            showDebugDetails={SHOW_REALTIME_DEBUG}
            evaluationPlaceholder={formatLatestEvaluationPlaceholder(transcripts)}
          />
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
          {showEndingSuggestion ? (
            <p className="ending-banner ending-banner--suggestion" data-testid="ending-suggestion-banner">
              {endingSuggestionMessage}
            </p>
          ) : null}
          {isCompleted ? (
            <p className="ending-banner" data-testid="session-ended-banner">
              {conversationCopy.sessionEnded}
            </p>
          ) : null}
          {isCompleted ? (
            <SessionReportPanel
              report={report}
              status={reportStatus}
              onRetry={
                reportStatus === "unavailable" && session?.backendLinked
                  ? () => void retrySessionReport()
                  : undefined
              }
            />
          ) : null}
          {isCompleted ? (
            <ShadowingPracticePanel items={shadowingItems} status={shadowingStatus} />
          ) : null}
        </section>

        <TranscriptPanel entries={transcripts} />
      </div>
    </div>
  );
}
