import { create } from "zustand";

import type { Scenario } from "@/domain/scenario";

import { completeSessionOnServer } from "./complete-session-api";
import { mapRealtimeCredentials } from "./credentials";
import { evaluateLocalScenarioProgress } from "./evaluate-local-progress";
import {
  fetchSessionProgressFromServer,
  type ServerScenarioProgressSnapshot,
} from "./fetch-session-progress-api";
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
  refreshScenarioProgress: () => void;
  syncSessionProgressFromServer: () => Promise<void>;
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
  scenarioProgress: null,
  progressSource: "unknown",
  endingState: "none",
  endingSuggestionReason: null,
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
  return (
    endingState === "user_requested" ||
    endingState === "completed"
  );
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

function maybeSuggestEnding(
  set: StoreSet,
  get: StoreGet,
  shouldSuggestEnding: boolean,
): void {
  if (shouldSuggestEnding && get().endingState === "none") {
    setEndingState(set, "ai_suggested");
  }
}

function toLocalScenarioProgress(
  progress: ServerScenarioProgressSnapshot,
): ConversationViewState["scenarioProgress"] {
  return {
    completedGoalIds: progress.completedGoalIds,
    missingGoalIds: progress.missingGoalIds,
    shouldSuggestEnding: progress.shouldSuggestEnding,
    endingSuggestionReason: progress.endingSuggestionReason,
    offTopic: progress.offTopic,
    currentStageId: progress.currentStageId,
  };
}

function applyServerScenarioProgress(
  set: StoreSet,
  get: StoreGet,
  progress: ServerScenarioProgressSnapshot,
): void {
  set({
    scenarioProgress: toLocalScenarioProgress(progress),
    endingSuggestionReason: progress.endingSuggestionReason,
    progressSource: "server",
  });
  maybeSuggestEnding(set, get, progress.shouldSuggestEnding);
}

function applyLocalScenarioProgress(set: StoreSet, get: StoreGet): void {
  const { selectedScenario, session, transcripts, progressSource } = get();
  if (!selectedScenario || !session || session.status !== "active") {
    return;
  }

  if (progressSource === "server") {
    return;
  }

  const progress = evaluateLocalScenarioProgress({
    scenario: selectedScenario,
    sessionId: session.id,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    transcripts,
    previousCompletedGoalIds: get().scenarioProgress?.completedGoalIds,
  });

  set({
    scenarioProgress: progress,
    endingSuggestionReason: progress.endingSuggestionReason,
    progressSource: progressSource === "unknown" ? "local" : progressSource,
  });
  maybeSuggestEnding(set, get, progress.shouldSuggestEnding);
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
      scenarioProgress: null,
      progressSource: "unknown",
      endingState: "none",
      endingSuggestionReason: null,
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
      applyLocalScenarioProgress(set, get);
      await get().syncSessionProgressFromServer();
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

  refreshScenarioProgress() {
    void get().syncSessionProgressFromServer();
  },

  async syncSessionProgressFromServer() {
    const { session, progressSource } = get();
    if (!session || session.status !== "active") {
      return;
    }

    if (progressSource === "local") {
      applyLocalScenarioProgress(set, get);
      return;
    }

    try {
      const serverProgress = await fetchSessionProgressFromServer(session.id);
      if (!serverProgress) {
        set({ progressSource: "local" });
        applyLocalScenarioProgress(set, get);
        return;
      }

      applyServerScenarioProgress(set, get, serverProgress);
    } catch {
      if (progressSource === "unknown") {
        set({ progressSource: "local" });
      }
      applyLocalScenarioProgress(set, get);
    }
  },

  async requestEndSession() {
    const { session, connectionStatus, endingState, selectedScenario } = get();

    if (!session || session.status !== "active") {
      return;
    }

    if (connectionStatus === "disconnecting" || endingState === "completed") {
      return;
    }

    if (selectedScenario && selectedScenario.exitPolicy.allowUserManualEnd === false) {
      return;
    }

    bumpSessionEpoch(set, get);
    set({
      endingState: "user_requested",
      endingSuggestionReason: null,
    });
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
