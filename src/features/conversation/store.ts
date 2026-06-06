import { create } from "zustand";

import type { Scenario } from "@/domain/scenario";

import { completeSessionOnServer } from "./complete-session-api";
import { mapRealtimeCredentials } from "./credentials";
import {
  createConversationSessionId,
  createOpeningTranscript,
  mockStartRealtimeSession,
  mockStopRealtimeSession,
} from "./mock-session";
import type {
  ConnectionStatus,
  ConversationViewState,
  EndingState,
  TurnStatus,
} from "./types";

type ConversationStore = ConversationViewState & {
  selectScenario: (scenario: Scenario) => void;
  startSession: (scenario: Scenario) => Promise<void>;
  requestEndSession: () => Promise<void>;
  teardownSession: () => Promise<void>;
  reset: () => void;
};

const initialState: ConversationViewState = {
  selectedScenario: null,
  session: null,
  realtimeCredentials: null,
  sessionEpoch: 0,
  connectionStatus: "idle",
  turnStatus: "idle",
  transcripts: [],
  endingState: "none",
  errorMessage: null,
};

type StoreSet = (
  partial:
    | Partial<ConversationViewState>
    | ((state: ConversationViewState) => Partial<ConversationViewState>),
) => void;
type StoreGet = () => ConversationViewState & ConversationStore;

function bumpSessionEpoch(set: StoreSet, get: StoreGet): number {
  const nextEpoch = get().sessionEpoch + 1;
  set({ sessionEpoch: nextEpoch });
  return nextEpoch;
}

function isSessionEpochCurrent(get: StoreGet, epoch: number): boolean {
  return get().sessionEpoch === epoch;
}

function isSessionEnding(get: StoreGet): boolean {
  const { endingState } = get();
  return endingState === "user_requested" || endingState === "completed";
}

function setConnectionStatus(set: StoreSet, connectionStatus: ConnectionStatus) {
  set({ connectionStatus });
}

function setTurnStatus(set: StoreSet, turnStatus: TurnStatus) {
  set({ turnStatus });
}

function setEndingState(set: StoreSet, endingState: EndingState) {
  set({ endingState });
}

function shouldStopMockSession(connectionStatus: ConnectionStatus): boolean {
  return (
    connectionStatus === "connecting" ||
    connectionStatus === "connected" ||
    connectionStatus === "disconnecting"
  );
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  ...initialState,

  selectScenario(scenario) {
    set({
      selectedScenario: scenario,
      errorMessage: null,
    });
  },

  async startSession(scenario) {
    const { session, connectionStatus } = get();

    if (
      session?.status === "active" &&
      session.scenarioId === scenario.id &&
      connectionStatus === "connected"
    ) {
      return;
    }

    if (connectionStatus === "connecting") {
      return;
    }

    const epoch = bumpSessionEpoch(set, get);
    const sessionId = createConversationSessionId();
    const startedAt = new Date().toISOString();

    set({
      selectedScenario: scenario,
      session: {
        id: sessionId,
        scenarioId: scenario.id,
        status: "active",
        startedAt,
      },
      realtimeCredentials: null,
      connectionStatus: "connecting",
      turnStatus: "idle",
      transcripts: [],
      endingState: "none",
      errorMessage: null,
    });

    try {
      const credentials = await mockStartRealtimeSession({
        sessionId,
        scenario,
      });

      if (!isSessionEpochCurrent(get, epoch) || isSessionEnding(get)) {
        return;
      }

      const openingTranscript = createOpeningTranscript(scenario);
      const realtimeCredentials = mapRealtimeCredentials(credentials);

      set({
        session: {
          id: sessionId,
          scenarioId: scenario.id,
          status: "active",
          startedAt,
          realtimeProvider: realtimeCredentials.provider,
        },
        realtimeCredentials,
        connectionStatus: "connected",
        turnStatus: "assistant_speaking",
        transcripts: [openingTranscript],
      });

      setTurnStatus(set, "idle");
    } catch {
      if (!isSessionEpochCurrent(get, epoch) || isSessionEnding(get)) {
        return;
      }

      set({
        connectionStatus: "error",
        turnStatus: "idle",
        realtimeCredentials: null,
        session: {
          id: sessionId,
          scenarioId: scenario.id,
          status: "failed",
          startedAt,
          endedAt: new Date().toISOString(),
        },
        errorMessage: "Could not start the practice session. Please try again.",
      });
    }
  },

  async requestEndSession() {
    const { session, connectionStatus, endingState } = get();

    if (!session || session.status !== "active") {
      return;
    }

    if (connectionStatus === "disconnecting" || endingState === "completed") {
      return;
    }

    bumpSessionEpoch(set, get);
    setEndingState(set, "user_requested");
    setConnectionStatus(set, "disconnecting");
    setTurnStatus(set, "idle");

    try {
      if (shouldStopMockSession(connectionStatus)) {
        await mockStopRealtimeSession();
      }

      if (isSessionEnding(get) === false) {
        return;
      }

      const endedAt = new Date().toISOString();

      set({
        session: {
          ...session,
          status: "completed",
          endedAt,
        },
        realtimeCredentials: null,
        connectionStatus: "disconnected",
        endingState: "completed",
      });

      try {
        await completeSessionOnServer(session.id);
      } catch {
        // Best-effort backend completion for client-only mock sessions.
      }
    } catch {
      set({
        connectionStatus: "error",
        errorMessage: "Could not end the session cleanly. Please refresh and try again.",
      });
    }
  },

  async teardownSession() {
    const { session, connectionStatus, endingState } = get();

    bumpSessionEpoch(set, get);

    if (
      session?.status === "active" &&
      endingState !== "completed" &&
      shouldStopMockSession(connectionStatus)
    ) {
      try {
        await mockStopRealtimeSession();
      } catch {
        // Best-effort cleanup when navigating away from the shell.
      }
    }

    set(initialState);
  },

  reset() {
    set(initialState);
  },
}));

export function getConversationInitialState(): ConversationViewState {
  return { ...initialState };
}
