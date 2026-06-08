import { create } from "zustand";

import type { Scenario } from "@/domain/scenario";

import { completeSessionOnServer } from "./complete-session-api";
import { fetchSessionTurnsFromServer } from "./create-turn-api";
import { mapRealtimeCredentials } from "./credentials";
import { evaluateLocalScenarioProgress } from "./evaluate-local-progress";
import { refreshSessionReportAndShadowing } from "./refresh-session-results";
import {
  fetchSessionProgressFromServer,
  type ServerScenarioProgressSnapshot,
} from "./fetch-session-progress-api";
import { getNextMockUserTurnLine, submitMockUserTurn } from "./mock-user-turn";
import {
  createConversationSessionId,
  createOpeningTranscript,
  mockStartRealtimeSession,
} from "./mock-session";
import {
  deriveConnectionStatus,
  deriveTurnStatus,
  type RealtimeLifecycleStatus,
} from "./realtime/lifecycle";
import { isQwenOmniRealtimeProvider } from "./realtime/adapters/qwen-omni-connect";
import {
  configureRealtimeSessionController,
  connectRealtimeSession,
  disconnectRealtimeSession,
  enterRealtimeFallbackMode,
  getRealtimeSessionControllerLifecycle,
  interruptRealtimeAssistant as sendRealtimeInterrupt,
  retryRealtimeSession,
  type RealtimeSessionControllerEvent,
} from "./realtime/session-controller";
import { teardownRealtimeAudioCapture } from "./realtime/realtime-audio-bridge";
import { startSessionOnServer } from "./start-session-api";
import { pollTurnPronunciationFeedback } from "./poll-turn-pronunciation-feedback";
import { applyServerTurnUpdate, mergeTranscriptsWithServerTurns } from "./sync-transcripts";
import { resolveUsageLimitBannerMessage } from "@/shared/usage-limit-messages";
import { errorCopy } from "@/lib/ui-copy";

import type {
  ConnectionStatus,
  ConversationViewState,
  EndingState,
  TranscriptEntry,
  TurnStatus,
} from "./types";

type ConversationStore = ConversationViewState & {
  selectScenario: (scenario: Scenario) => void;
  startSession: (scenario: Scenario) => Promise<void>;
  submitMockPracticeTurn: () => Promise<void>;
  refreshScenarioProgress: () => void;
  syncSessionProgressFromServer: () => Promise<void>;
  handleRealtimeControllerEvent: (event: RealtimeSessionControllerEvent) => void;
  retryRealtimeConnection: () => Promise<void>;
  enterRealtimeFallback: () => void;
  interruptRealtimeAssistant: () => void;
  requestEndSession: (options?: { triggeredBy?: "user" | "model" }) => Promise<void>;
  retrySessionReport: () => Promise<void>;
  teardownSession: () => Promise<void>;
  reset: () => void;
};

const initialState: ConversationViewState = {
  selectedScenario: null,
  session: null,
  realtimeCredentials: null,
  sessionEpoch: 0,
  realtimeLifecycleStatus: "idle",
  realtimeDiagnostics: {},
  connectionStatus: "idle",
  turnStatus: "idle",
  transcripts: [],
  mockTurnCount: 0,
  scenarioProgress: null,
  progressSource: "unknown",
  endingState: "none",
  endingSuggestionReason: null,
  usageLimits: null,
  errorMessage: null,
  report: null,
  reportStatus: "idle",
  shadowingItems: [],
  shadowingStatus: "idle",
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
    endingState === "model_requested" ||
    endingState === "completed"
  );
}

function applyRealtimeLifecycle(
  set: StoreSet,
  lifecycle: RealtimeLifecycleStatus,
): void {
  set({
    realtimeLifecycleStatus: lifecycle,
    connectionStatus: deriveConnectionStatus(lifecycle),
    turnStatus: deriveTurnStatus(lifecycle),
  });
}

function setConnectionStatus(set: StoreSet, connectionStatus: ConnectionStatus) {
  set({ connectionStatus });
}

function setTurnStatus(set: StoreSet, turnStatus: TurnStatus) {
  set({ turnStatus });
}

function upsertTranscriptEntry(
  transcripts: TranscriptEntry[],
  entry: TranscriptEntry,
): TranscriptEntry[] {
  const existingIndex = transcripts.findIndex((item) => item.id === entry.id);
  if (existingIndex === -1) {
    return [...transcripts, entry];
  }

  const next = [...transcripts];
  next[existingIndex] = entry;
  return next;
}

function appendTranscriptDelta(
  transcripts: TranscriptEntry[],
  entryId: string,
  role: TranscriptEntry["role"],
  delta: string,
): TranscriptEntry[] {
  const existingIndex = transcripts.findIndex((item) => item.id === entryId);
  if (existingIndex === -1) {
    return [
      ...transcripts,
      {
        id: entryId,
        role,
        text: delta,
        status: "partial",
        timestamp: new Date().toISOString(),
      },
    ];
  }

  const next = [...transcripts];
  const existing = next[existingIndex]!;
  next[existingIndex] = {
    ...existing,
    text: `${existing.text}${delta}`,
    status: "partial",
  };
  return next;
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
  const usageLimitMessage = resolveUsageLimitBannerMessage(progress.usageLimits);

  set((state) => ({
    scenarioProgress: toLocalScenarioProgress(progress),
    endingSuggestionReason: progress.endingSuggestionReason,
    progressSource: "server",
    usageLimits: progress.usageLimits,
    ...(usageLimitMessage ? { errorMessage: usageLimitMessage } : {}),
  }));
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

function shouldDisconnectRealtime(lifecycle: RealtimeLifecycleStatus): boolean {
  return (
    lifecycle === "connecting" ||
    lifecycle === "connected" ||
    lifecycle === "listening" ||
    lifecycle === "user_speaking" ||
    lifecycle === "assistant_speaking" ||
    lifecycle === "interrupted" ||
    lifecycle === "reconnecting" ||
    lifecycle === "fallback" ||
    lifecycle === "failed"
  );
}

async function startRealtimeConnection(
  scenario: Scenario,
  credentials: ConversationViewState["realtimeCredentials"],
  epoch: number,
  set: StoreSet,
  get: StoreGet,
): Promise<void> {
  if (!credentials) {
    return;
  }

  if (!isSessionEpochCurrent(get, epoch) || isSessionEnding(get)) {
    return;
  }

  applyRealtimeLifecycle(set, "connecting");

  const useMockOpening =
    !credentials || !isQwenOmniRealtimeProvider(credentials.provider);

  await connectRealtimeSession({
    credentials,
    openingTranscript: useMockOpening ? createOpeningTranscript(scenario) : undefined,
    sessionEpoch: epoch,
  });

  if (!isSessionEpochCurrent(get, epoch) || isSessionEnding(get)) {
    return;
  }

  applyRealtimeLifecycle(set, getRealtimeSessionControllerLifecycle());
}

async function syncSessionTranscriptsFromServer(
  set: StoreSet,
  get: StoreGet,
): Promise<void> {
  const { session } = get();
  if (!session?.backendLinked) {
    return;
  }

  try {
    const result = await fetchSessionTurnsFromServer(session.id);
    if (!result?.turns.length) {
      return;
    }

    set((state) => ({
      transcripts: mergeTranscriptsWithServerTurns(state.transcripts, result.turns),
    }));
  } catch {
    // Best-effort sync after background jobs update turn transcripts.
  }
}

function scheduleTurnEvaluationPoll(
  set: StoreSet,
  get: StoreGet,
  turnId: string,
): void {
  const { session } = get();
  if (!session?.backendLinked || session.status !== "active") {
    return;
  }

  const sessionId = session.id;
  const sessionEpoch = get().sessionEpoch;

  set((state) => ({
    transcripts: state.transcripts.map((entry) =>
      entry.id === turnId
        ? {
            ...entry,
            pronunciationFeedback: {
              evaluationStatus: "processing",
            },
          }
        : entry,
    ),
  }));

  void (async () => {
    const serverTurn = await pollTurnPronunciationFeedback(sessionId, turnId);
    if (!isSessionEpochCurrent(get, sessionEpoch) || get().session?.id !== sessionId) {
      return;
    }

    if (!serverTurn) {
      return;
    }

    set((state) => ({
      transcripts: applyServerTurnUpdate(state.transcripts, serverTurn),
    }));
  })();
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
    const { session, realtimeLifecycleStatus } = get();

    if (
      session?.status === "active" &&
      session.scenarioId === scenario.id &&
      (realtimeLifecycleStatus === "connected" ||
        realtimeLifecycleStatus === "listening" ||
        realtimeLifecycleStatus === "user_speaking" ||
        realtimeLifecycleStatus === "assistant_speaking" ||
        realtimeLifecycleStatus === "fallback")
    ) {
      return;
    }

    const epoch = bumpSessionEpoch(set, get);
    const provisionalSessionId = createConversationSessionId();
    const startedAt = new Date().toISOString();

    set({
      selectedScenario: scenario,
      session: {
        id: provisionalSessionId,
        scenarioId: scenario.id,
        status: "active",
        startedAt,
      },
      realtimeCredentials: null,
      realtimeDiagnostics: {},
      transcripts: [],
      mockTurnCount: 0,
      scenarioProgress: null,
      progressSource: "unknown",
      endingState: "none",
      endingSuggestionReason: null,
      errorMessage: null,
      report: null,
      reportStatus: "idle",
      shadowingItems: [],
      shadowingStatus: "idle",
    });
    applyRealtimeLifecycle(set, "connecting");

    try {
      const serverStart = await startSessionOnServer(scenario.id);

      if (!isSessionEpochCurrent(get, epoch) || isSessionEnding(get)) {
        return;
      }

      if (serverStart) {
        set({
          session: serverStart.session,
          realtimeCredentials: serverStart.realtimeCredentials,
          progressSource: "server",
          realtimeDiagnostics: {
            provider: serverStart.realtimeCredentials.provider,
          },
        });

        if (!isSessionEpochCurrent(get, epoch) || isSessionEnding(get)) {
          return;
        }

        await startRealtimeConnection(
          scenario,
          serverStart.realtimeCredentials,
          epoch,
          set,
          get,
        );
        await get().syncSessionProgressFromServer();
        return;
      }

      const credentials = await mockStartRealtimeSession({
        sessionId: provisionalSessionId,
        scenario,
      });

      if (!isSessionEpochCurrent(get, epoch) || isSessionEnding(get)) {
        return;
      }

      const realtimeCredentials = mapRealtimeCredentials(credentials);

      set({
        session: {
          id: provisionalSessionId,
          scenarioId: scenario.id,
          status: "active",
          startedAt,
          realtimeProvider: realtimeCredentials.provider,
        },
        realtimeCredentials,
        realtimeDiagnostics: {
          provider: realtimeCredentials.provider,
        },
      });

      if (!isSessionEpochCurrent(get, epoch) || isSessionEnding(get)) {
        return;
      }

      await startRealtimeConnection(scenario, realtimeCredentials, epoch, set, get);
      applyLocalScenarioProgress(set, get);
      await get().syncSessionProgressFromServer();
    } catch (error) {
      if (!isSessionEpochCurrent(get, epoch) || isSessionEnding(get)) {
        return;
      }

      applyRealtimeLifecycle(set, "failed");
      set({
        realtimeCredentials: null,
        session: {
          id: createConversationSessionId(),
          scenarioId: scenario.id,
          status: "failed",
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
        },
        errorMessage:
          error instanceof Error
            ? error.message
            : errorCopy.startSessionFailed,
      });
    }
  },

  handleRealtimeControllerEvent(event) {
    if (event.sessionEpoch !== get().sessionEpoch) {
      return;
    }

    const { session } = get();

    switch (event.type) {
      case "lifecycle":
        if (!session || session.status !== "active") {
          return;
        }
        if (get().endingState === "user_requested" || get().endingState === "model_requested") {
          if (event.status === "ended") {
            return;
          }
          setConnectionStatus(set, "disconnecting");
          setTurnStatus(set, "idle");
          return;
        }
        applyRealtimeLifecycle(set, event.status);
        if (event.status === "failed") {
          set({
            errorMessage: errorCopy.realtimeFailed,
          });
        } else if (
          event.status === "connected" ||
          event.status === "listening" ||
          event.status === "user_speaking" ||
          event.status === "fallback"
        ) {
          set({ errorMessage: null });
        }
        break;
      case "transcript":
        set((state) => ({
          transcripts: upsertTranscriptEntry(state.transcripts, event.entry),
        }));
        break;
      case "transcript_delta":
        set((state) => ({
          transcripts: appendTranscriptDelta(
            state.transcripts,
            event.entryId,
            event.role,
            event.text,
          ),
        }));
        break;
      case "diagnostics":
        set({ realtimeDiagnostics: event.diagnostics });
        break;
      case "error":
        if (event.failed) {
          applyRealtimeLifecycle(set, "failed");
        }
        set({
          errorMessage: event.message,
        });
        break;
      case "turn_persisted":
        set((state) => ({
          transcripts: state.transcripts.map((entry) =>
            entry.id === event.clientEntryId
              ? {
                  ...entry,
                  id: event.serverTurnId,
                  pronunciationFeedback: {
                    evaluationStatus: "pending",
                  },
                }
              : entry,
          ),
        }));
        scheduleTurnEvaluationPoll(set, get, event.serverTurnId);
        break;
      case "session_end_requested":
        if (!session || session.status !== "active" || isSessionEnding(get)) {
          return;
        }
        void get().requestEndSession({ triggeredBy: "model" });
        break;
      default:
        break;
    }
  },

  async retryRealtimeConnection() {
    const { realtimeLifecycleStatus, session } = get();
    if (!session || session.status !== "active" || realtimeLifecycleStatus !== "failed") {
      return;
    }

    set({ errorMessage: null });
    applyRealtimeLifecycle(set, "reconnecting");
    await retryRealtimeSession();
  },

  enterRealtimeFallback() {
    const { session } = get();
    if (!session || session.status !== "active") {
      return;
    }

    enterRealtimeFallbackMode();
    set({ errorMessage: null });
  },

  interruptRealtimeAssistant() {
    const { session, realtimeLifecycleStatus } = get();
    if (!session || session.status !== "active") {
      return;
    }

    if (
      realtimeLifecycleStatus !== "assistant_speaking" &&
      realtimeLifecycleStatus !== "interrupted"
    ) {
      return;
    }

    sendRealtimeInterrupt();
  },

  async submitMockPracticeTurn() {
    const { session, realtimeLifecycleStatus, mockTurnCount, endingState } = get();

    if (
      !session ||
      session.status !== "active" ||
      session.backendLinked !== true ||
      realtimeLifecycleStatus !== "fallback" ||
      (endingState !== "none" && endingState !== "ai_suggested")
    ) {
      return;
    }

    const turnIndex = mockTurnCount;
    const transcriptText = getNextMockUserTurnLine(turnIndex);

    setTurnStatus(set, "user_speaking");
    set({ errorMessage: null });

    try {
      setTurnStatus(set, "user_processing");

      const result = await submitMockUserTurn({
        sessionId: session.id,
        transcriptText,
        turnIndex,
      });

      set((state) => ({
        mockTurnCount: state.mockTurnCount + 1,
        turnStatus: "assistant_speaking",
        transcripts: [
          ...state.transcripts,
          result.userTranscript,
          result.assistantTranscript,
        ],
      }));

      setTurnStatus(set, "idle");
      set({ progressSource: "server" });
      await syncSessionTranscriptsFromServer(set, get);
      await get().syncSessionProgressFromServer();
      scheduleTurnEvaluationPoll(set, get, result.turnId);
    } catch (error) {
      setTurnStatus(set, "idle");
      set({
        errorMessage:
          error instanceof Error
            ? error.message
            : errorCopy.submitTurnFailed,
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

  async requestEndSession(options?: { triggeredBy?: "user" | "model" }) {
    const { session, realtimeLifecycleStatus, endingState, selectedScenario } = get();
    const triggeredBy = options?.triggeredBy ?? "user";

    if (!session || session.status !== "active") {
      return;
    }

    if (
      realtimeLifecycleStatus === "ended" ||
      endingState === "completed" ||
      endingState === "user_requested" ||
      endingState === "model_requested"
    ) {
      return;
    }

    if (selectedScenario && selectedScenario.exitPolicy.allowUserManualEnd === false) {
      return;
    }

    bumpSessionEpoch(set, get);
    set({
      endingState: triggeredBy === "model" ? "model_requested" : "user_requested",
      endingSuggestionReason: null,
    });
    setConnectionStatus(set, "disconnecting");
    setTurnStatus(set, "idle");

    try {
      await teardownRealtimeAudioCapture();

      if (shouldDisconnectRealtime(realtimeLifecycleStatus)) {
        await disconnectRealtimeSession();
      }

      if (isSessionEnding(get) === false) {
        return;
      }

      const endedAt = new Date().toISOString();

      applyRealtimeLifecycle(set, "ended");
      set({
        session: {
          ...session,
          status: "completed",
          endedAt,
        },
        realtimeCredentials: null,
        endingState: "completed",
        reportStatus: session.backendLinked ? "loading" : "idle",
        shadowingStatus: session.backendLinked ? "loading" : "idle",
      });

      if (session.backendLinked) {
        try {
          const { report, shadowingItems } = await refreshSessionReportAndShadowing(
            session.id,
          );
          set({
            report,
            reportStatus: report ? "ready" : "unavailable",
            shadowingItems,
            shadowingStatus:
              shadowingItems.length > 0
                ? "ready"
                : report
                  ? "unavailable"
                  : "unavailable",
          });
        } catch {
          set({
            reportStatus: "unavailable",
            shadowingStatus: "unavailable",
          });
        }
      } else {
        try {
          await completeSessionOnServer(session.id);
        } catch {
          // Best-effort backend completion for client-only mock sessions.
        }
      }
    } catch {
      set({
        connectionStatus: "error",
        errorMessage: errorCopy.endSessionFailed,
      });
    }
  },

  async retrySessionReport() {
    const { session } = get();

    if (!session || session.status !== "completed" || !session.backendLinked) {
      return;
    }

    set({
      report: null,
      reportStatus: "loading",
      shadowingItems: [],
      shadowingStatus: "loading",
    });

    try {
      const { report, shadowingItems } = await refreshSessionReportAndShadowing(session.id);
      set({
        report,
        reportStatus: report ? "ready" : "unavailable",
        shadowingItems,
        shadowingStatus:
          shadowingItems.length > 0
            ? "ready"
            : report
              ? "unavailable"
              : "unavailable",
      });
    } catch {
      set({
        reportStatus: "unavailable",
        shadowingStatus: "unavailable",
      });
    }
  },

  async teardownSession() {
    const { session, realtimeLifecycleStatus, endingState } = get();
    const nextEpoch = bumpSessionEpoch(set, get);

    set({
      ...initialState,
      sessionEpoch: nextEpoch,
    });

    try {
      await teardownRealtimeAudioCapture();
    } catch {
      // Best-effort audio cleanup when navigating away from the shell.
    }

    if (
      session?.status === "active" &&
      endingState !== "completed" &&
      shouldDisconnectRealtime(realtimeLifecycleStatus)
    ) {
      try {
        await disconnectRealtimeSession();
      } catch {
        // Best-effort cleanup when navigating away from the shell.
      }
    }
  },

  reset() {
    set(initialState);
  },
}));

export function getConversationInitialState(): ConversationViewState {
  return { ...initialState };
}

configureRealtimeSessionController({
  onEvent: (event) => {
    useConversationStore.getState().handleRealtimeControllerEvent(event);
  },
});
