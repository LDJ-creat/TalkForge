import type { ConversationRealtimeCredentials } from "../credentials";
import type { TranscriptEntry } from "../types";

import type { RealtimeClient, RealtimeClientEvent } from "./client-types";
import { createRealtimeClient } from "./create-client";
import type { RealtimeConnectionDiagnostics, RealtimeLifecycleStatus } from "./lifecycle";

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 800;

export type RealtimeSessionControllerOptions = {
  onEvent: (event: RealtimeSessionControllerEvent) => void;
};

export type RealtimeSessionControllerEvent = {
  sessionEpoch: number;
} & (
  | { type: "lifecycle"; status: RealtimeLifecycleStatus }
  | { type: "transcript"; entry: TranscriptEntry }
  | {
      type: "transcript_delta";
      entryId: string;
      text: string;
      role: TranscriptEntry["role"];
    }
  | { type: "diagnostics"; diagnostics: RealtimeConnectionDiagnostics }
  | { type: "error"; message: string; recoverable: boolean; failed?: boolean }
);

export type RealtimeConnectInput = {
  credentials: ConversationRealtimeCredentials;
  openingTranscript?: TranscriptEntry;
  sessionEpoch: number;
};

type ControllerState = {
  credentials: ConversationRealtimeCredentials | null;
  openingTranscript?: TranscriptEntry;
  sessionEpoch: number;
  lifecycle: RealtimeLifecycleStatus;
  reconnectAttempt: number;
  fallbackActive: boolean;
  userEnded: boolean;
  diagnostics: RealtimeConnectionDiagnostics;
  abortController: AbortController | null;
  unsubscribe: (() => void) | null;
  client: RealtimeClient | null;
};

function createInitialState(): ControllerState {
  return {
    credentials: null,
    sessionEpoch: 0,
    lifecycle: "idle",
    reconnectAttempt: 0,
    fallbackActive: false,
    userEnded: false,
    diagnostics: {},
    abortController: null,
    unsubscribe: null,
    client: null,
  };
}

let controllerState = createInitialState();
let options: RealtimeSessionControllerOptions | null = null;
let reconnectTask: Promise<void> | null = null;

function emit(
  event: Omit<RealtimeSessionControllerEvent, "sessionEpoch">,
): void {
  options?.onEvent({
    ...event,
    sessionEpoch: controllerState.sessionEpoch,
  } as RealtimeSessionControllerEvent);
}

function shouldAttemptRecovery(): boolean {
  return (
    !controllerState.userEnded &&
    !controllerState.fallbackActive &&
    controllerState.credentials !== null
  );
}

function markFailed(message: string): void {
  controllerState.lifecycle = "failed";
  emit({ type: "lifecycle", status: "failed" });
  emit({
    type: "error",
    message,
    recoverable: false,
    failed: true,
  });
}

function mapClientEvent(event: RealtimeClientEvent): void {
  switch (event.type) {
    case "lifecycle":
      controllerState.lifecycle = event.status;
      emit({ type: "lifecycle", status: event.status });
      break;
    case "transcript":
      emit({ type: "transcript", entry: event.entry });
      break;
    case "transcript_delta":
      emit({
        type: "transcript_delta",
        entryId: event.entryId,
        text: event.text,
        role: event.role,
      });
      break;
    case "diagnostics":
      controllerState.diagnostics = {
        ...controllerState.diagnostics,
        ...event.diagnostics,
        reconnectAttempt: controllerState.reconnectAttempt,
      };
      emit({ type: "diagnostics", diagnostics: controllerState.diagnostics });
      break;
    case "error":
      emit({
        type: "error",
        message: event.message,
        recoverable: event.recoverable,
      });
      if (event.recoverable && shouldAttemptRecovery()) {
        requestRecoverableReconnect();
      } else if (!controllerState.fallbackActive && !controllerState.userEnded) {
        markFailed(event.message);
      }
      break;
    default:
      break;
  }
}

async function openClientConnection(): Promise<void> {
  const { credentials, openingTranscript, abortController } = controllerState;
  if (!credentials) {
    return;
  }

  controllerState.client = createRealtimeClient(credentials);
  controllerState.unsubscribe = controllerState.client.onEvent(mapClientEvent);

  const sessionUpdateEvent = credentials.metadata?.sessionUpdateEvent;

  await controllerState.client.connect(credentials, {
    openingTranscript,
    sessionUpdateEvent,
    signal: abortController?.signal,
  });
}

async function runReconnectLoop(): Promise<void> {
  while (shouldAttemptRecovery() && controllerState.reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
    controllerState.reconnectAttempt += 1;
    controllerState.lifecycle = "reconnecting";
    emit({ type: "lifecycle", status: "reconnecting" });
    emit({
      type: "diagnostics",
      diagnostics: {
        ...controllerState.diagnostics,
        reconnectAttempt: controllerState.reconnectAttempt,
      },
    });

    await cleanupClient({ preserveCredentials: true });

    const delayMs = RECONNECT_BASE_DELAY_MS * controllerState.reconnectAttempt;
    await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));

    if (!shouldAttemptRecovery() || controllerState.lifecycle !== "reconnecting") {
      return;
    }

    controllerState.abortController = new AbortController();

    try {
      await openClientConnection();
      controllerState.reconnectAttempt = 0;
      return;
    } catch (error) {
      if (!shouldAttemptRecovery()) {
        return;
      }

      emit({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Realtime reconnection failed.",
        recoverable: true,
      });
    }
  }

  if (shouldAttemptRecovery()) {
    markFailed(
      "Could not restore the realtime connection. Retry or continue in text practice mode.",
    );
  }
}

function requestRecoverableReconnect(): void {
  if (!shouldAttemptRecovery() || reconnectTask) {
    return;
  }

  reconnectTask = runReconnectLoop().finally(() => {
    reconnectTask = null;
  });
}

async function cleanupClient(input?: {
  preserveCredentials?: boolean;
  rethrowDisconnect?: boolean;
}): Promise<void> {
  controllerState.abortController?.abort();
  controllerState.abortController = null;

  if (controllerState.unsubscribe) {
    controllerState.unsubscribe();
    controllerState.unsubscribe = null;
  }

  if (controllerState.client) {
    try {
      await controllerState.client.disconnect();
    } catch (error) {
      controllerState.client = null;
      if (input?.rethrowDisconnect) {
        throw error;
      }
    }
    controllerState.client = null;
  }

  if (!input?.preserveCredentials) {
    controllerState.credentials = null;
    controllerState.openingTranscript = undefined;
  }
}

export function configureRealtimeSessionController(
  nextOptions: RealtimeSessionControllerOptions,
): void {
  options = nextOptions;
}

export function resetRealtimeSessionControllerForTests(): void {
  void cleanupClient();
  reconnectTask = null;
  const preservedOptions = options;
  controllerState = createInitialState();
  options = preservedOptions;
}

export function getRealtimeSessionControllerLifecycle(): RealtimeLifecycleStatus {
  return controllerState.lifecycle;
}

export function getActiveRealtimeClient(): RealtimeClient | null {
  return controllerState.client;
}

export async function connectRealtimeSession(input: RealtimeConnectInput): Promise<void> {
  await cleanupClient();
  reconnectTask = null;

  controllerState = {
    ...createInitialState(),
    credentials: input.credentials,
    openingTranscript: input.openingTranscript,
    sessionEpoch: input.sessionEpoch,
    lifecycle: "connecting",
    diagnostics: { provider: input.credentials.provider },
  };

  emit({ type: "lifecycle", status: "connecting" });
  emit({
    type: "diagnostics",
    diagnostics: controllerState.diagnostics,
  });

  controllerState.abortController = new AbortController();

  try {
    await openClientConnection();
  } catch (error) {
    if (controllerState.userEnded) {
      return;
    }

    emit({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not connect to the realtime session.",
      recoverable: true,
    });
    requestRecoverableReconnect();
  }
}

export async function disconnectRealtimeSession(): Promise<void> {
  controllerState.userEnded = true;
  reconnectTask = null;
  controllerState.lifecycle = "ended";
  emit({ type: "lifecycle", status: "ended" });
  await cleanupClient({ rethrowDisconnect: true });
  controllerState = createInitialState();
}

export async function retryRealtimeSession(): Promise<void> {
  if (!controllerState.credentials || controllerState.fallbackActive) {
    return;
  }

  reconnectTask = null;
  controllerState.reconnectAttempt = 0;
  controllerState.fallbackActive = false;
  controllerState.userEnded = false;
  controllerState.lifecycle = "connecting";
  emit({ type: "lifecycle", status: "connecting" });

  controllerState.abortController = new AbortController();

  try {
    await openClientConnection();
  } catch (error) {
    emit({
      type: "error",
      message:
        error instanceof Error ? error.message : "Realtime retry failed.",
      recoverable: true,
    });
    requestRecoverableReconnect();
  }
}

export function enterRealtimeFallbackMode(): void {
  if (controllerState.fallbackActive) {
    return;
  }

  reconnectTask = null;
  controllerState.fallbackActive = true;
  controllerState.reconnectAttempt = 0;
  controllerState.lifecycle = "fallback";
  void cleanupClient({ preserveCredentials: true });
  emit({ type: "lifecycle", status: "fallback" });
}

export function interruptRealtimeAssistant(): void {
  controllerState.client?.interrupt?.();
}
