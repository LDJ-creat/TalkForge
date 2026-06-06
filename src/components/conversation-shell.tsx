"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import type { Scenario } from "@/domain/scenario";
import { useConversationStore } from "@/features/conversation";

import { SessionStatusBar } from "./session-status-bar";
import { TranscriptPanel } from "./transcript-panel";
import { VoiceVisualizer } from "./voice-visualizer";

type ConversationShellProps = {
  scenario: Scenario;
};

export function ConversationShell({ scenario }: ConversationShellProps) {
  const {
    session,
    connectionStatus,
    turnStatus,
    transcripts,
    endingState,
    errorMessage,
  } = useConversationStore(
    useShallow((state) => ({
      session: state.session,
      connectionStatus: state.connectionStatus,
      turnStatus: state.turnStatus,
      transcripts: state.transcripts,
      endingState: state.endingState,
      errorMessage: state.errorMessage,
    })),
  );

  const startSession = useConversationStore((state) => state.startSession);
  const requestEndSession = useConversationStore((state) => state.requestEndSession);

  useEffect(() => {
    void startSession(scenario);

    return () => {
      void useConversationStore.getState().teardownSession();
    };
  }, [scenario, startSession]);

  const isSessionActive = session?.status === "active";
  const isEnding =
    connectionStatus === "disconnecting" || endingState === "user_requested";
  const isCompleted = session?.status === "completed" || endingState === "completed";

  return (
    <div className="conversation-page" data-testid="conversation-shell">
      <header className="conversation-header">
        <div className="conversation-header__info">
          <h1 className="conversation-header__title">{scenario.title}</h1>
          <p className="conversation-header__subtitle">
            {scenario.userRole} · {scenario.level} · {scenario.situation}
          </p>
        </div>
        <div className="conversation-header__actions">
          <Link href="/" className="button button--ghost">
            Change scenario
          </Link>
          <button
            type="button"
            className="button button--end"
            data-testid="end-practice-button"
            onClick={() => void requestEndSession()}
            disabled={!isSessionActive || isEnding || isCompleted}
          >
            End practice
          </button>
        </div>
      </header>

      <div className="conversation-main">
        <section className="conversation-panel">
          <h2 className="conversation-panel__title">Voice practice</h2>
          <VoiceVisualizer turnStatus={turnStatus} />
          <SessionStatusBar
            connectionStatus={connectionStatus}
            turnStatus={turnStatus}
            sessionStatus={session?.status}
          />
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
          {isCompleted ? (
            <p className="ending-banner" data-testid="session-ended-banner">
              Practice ended. Your session feedback will be ready after async processing in a
              later milestone.
            </p>
          ) : null}
        </section>

        <TranscriptPanel entries={transcripts} />
      </div>
    </div>
  );
}
