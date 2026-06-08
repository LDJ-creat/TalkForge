import type { ConversationRealtimeCredentials } from "../credentials";
import type { TranscriptEntry } from "../types";

import {
  getRealtimeAudioDiagnostics,
  resetRealtimeAudioDiagnostics,
  setRealtimeAudioDiagnosticsListener,
} from "./audio/audio-diagnostics";
import { QwenOmniAudioStream } from "./adapters/qwen-omni-audio-stream";
import { isQwenOmniRealtimeProvider } from "./adapters/qwen-omni-connect";
import { buildQwenOmniOpeningSpeechEvents } from "./adapters/qwen-omni-client-events";
import type { RealtimeClient, RealtimeClientEvent } from "./client-types";
import { createRealtimeClient } from "./create-client";
import type { RealtimeConnectionDiagnostics, RealtimeLifecycleStatus } from "./lifecycle";
import {
  bindSharedMediaStream,
  clearSharedMediaStream,
  teardownRealtimeAudioCapture,
} from "./realtime-audio-bridge";
import { RealtimeTurnSync } from "./realtime-turn-sync";
import { isBargeInEnabled } from "./audio/barge-in";
import { UPLINK_PLAYBACK_TAIL_MUTE_MS } from "./audio/constants";

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 800;

export type RealtimeSessionControllerOptions = {
  onEvent: (event: RealtimeSessionControllerEvent) => void;
};

export type RealtimeSessionControllerEventPayload =
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
  | { type: "turn_persisted"; clientEntryId: string; serverTurnId: string }
  | {
      type: "session_end_requested";
      reason: "goals_complete" | "user_requested" | "natural_closing";
    };

export type RealtimeSessionControllerEvent = {
  sessionEpoch: number;
} & RealtimeSessionControllerEventPayload;

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
  audioStream: QwenOmniAudioStream | null;
  turnSync: RealtimeTurnSync | null;
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
    audioStream: null,
    turnSync: null,
  };
}

let controllerState = createInitialState();
let options: RealtimeSessionControllerOptions | null = null;
let reconnectTask: Promise<void> | null = null;
let audioDiagnosticsIntervalId: ReturnType<typeof globalThis.setInterval> | null = null;
let uplinkResumeTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

function clearUplinkResumeTimer(): void {
  if (uplinkResumeTimer !== null) {
    globalThis.clearTimeout(uplinkResumeTimer);
    uplinkResumeTimer = null;
  }
}

function clearAudioDiagnosticsInterval(): void {
  if (audioDiagnosticsIntervalId !== null) {
    globalThis.clearInterval(audioDiagnosticsIntervalId);
    audioDiagnosticsIntervalId = null;
  }
}

function emit(event: RealtimeSessionControllerEventPayload): void {
  options?.onEvent({
    ...event,
    sessionEpoch: controllerState.sessionEpoch,
  });
}

function emitDiagnosticsPatch(patch: Partial<RealtimeConnectionDiagnostics> = {}): void {
  controllerState.diagnostics = {
    ...controllerState.diagnostics,
    ...patch,
    audio: getRealtimeAudioDiagnostics(),
  };
  emit({ type: "diagnostics", diagnostics: controllerState.diagnostics });
}

function scheduleUplinkResumeAfterPlayback(): void {
  clearUplinkResumeTimer();

  const attemptResume = () => {
    const stream = controllerState.audioStream;
    if (!stream) {
      return;
    }

    const delayMs = stream.getPlaybackIdleDelayMs() + UPLINK_PLAYBACK_TAIL_MUTE_MS;
    if (delayMs <= UPLINK_PLAYBACK_TAIL_MUTE_MS + 50) {
      stream.setUplinkEnabled(true);
      return;
    }

    uplinkResumeTimer = globalThis.setTimeout(attemptResume, Math.min(delayMs, 200));
  };

  attemptResume();
}

function syncAudioUplink(lifecycle: RealtimeLifecycleStatus): void {
  const stream = controllerState.audioStream;
  if (!stream) {
    return;
  }

  if (lifecycle === "assistant_speaking") {
    clearUplinkResumeTimer();
    stream.setUplinkEnabled(false);
    return;
  }

  if (
    lifecycle === "listening" ||
    lifecycle === "user_speaking" ||
    lifecycle === "interrupted"
  ) {
    scheduleUplinkResumeAfterPlayback();
  }
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

function isInternalClientEvent(event: RealtimeClientEvent): boolean {
  return (
    event.type === "session_ready" ||
    event.type === "provider_audio_delta" ||
    event.type === "provider_audio_done" ||
    event.type === "user_speech_started" ||
    event.type === "user_speech_stopped"
  );
}

function handleInternalClientEvent(event: RealtimeClientEvent): void {
  switch (event.type) {
    case "session_ready":
      for (const event of buildQwenOmniOpeningSpeechEvents()) {
        controllerState.client?.sendProviderMessage?.(event);
      }
      break;
    case "provider_audio_delta":
      void controllerState.audioStream?.handleAudioDelta(event.base64Pcm);
      break;
    case "provider_audio_done":
      break;
    case "user_speech_started":
      void controllerState.turnSync?.onUserSpeechStarted();
      emitDiagnosticsPatch();
      break;
    case "user_speech_stopped":
      void controllerState.turnSync?.onUserSpeechStopped();
      emitDiagnosticsPatch();
      break;
    default:
      break;
  }
}

function mapClientEvent(event: RealtimeClientEvent): void {
  if (isInternalClientEvent(event)) {
    handleInternalClientEvent(event);
    return;
  }

  switch (event.type) {
    case "lifecycle":
      controllerState.lifecycle = event.status;
      syncAudioUplink(event.status);
      emit({ type: "lifecycle", status: event.status });
      break;
    case "transcript":
      emit({ type: "transcript", entry: event.entry });
      void controllerState.turnSync?.onTranscriptFinal(event.entry);
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
      emitDiagnosticsPatch({
        ...event.diagnostics,
        reconnectAttempt: controllerState.reconnectAttempt,
      });
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
    case "session_end_requested":
      emit({
        type: "session_end_requested",
        reason: event.reason,
      });
      break;
    default:
      break;
  }
}

async function startQwenOmniAudioPipeline(
  credentials: ConversationRealtimeCredentials,
): Promise<void> {
  if (!controllerState.client || !isQwenOmniRealtimeProvider(credentials.provider)) {
    return;
  }

  resetRealtimeAudioDiagnostics();
  clearAudioDiagnosticsInterval();
  audioDiagnosticsIntervalId = globalThis.setInterval(() => {
    emitDiagnosticsPatch();
  }, 500);
  setRealtimeAudioDiagnosticsListener(() => {
    emitDiagnosticsPatch();
  });

  const sessionId =
    typeof credentials.metadata?.sessionId === "string"
      ? credentials.metadata.sessionId
      : null;

  if (!sessionId) {
    return;
  }

  const sendProviderMessage = (message: unknown) => {
    controllerState.client?.sendProviderMessage?.(message);
  };

  controllerState.audioStream = new QwenOmniAudioStream({
    sendProviderMessage,
    onBargeIn: isBargeInEnabled()
      ? () => {
          interruptRealtimeAssistant();
        }
      : undefined,
  });
  const stream = await controllerState.audioStream.start();
  bindSharedMediaStream(stream);

  controllerState.turnSync = new RealtimeTurnSync({
    onUserTurnPersisted: ({ clientEntryId, serverTurnId }) => {
      emit({
        type: "turn_persisted",
        clientEntryId,
        serverTurnId,
      });
    },
    sessionId,
    userId:
      typeof credentials.metadata?.userId === "string"
        ? credentials.metadata.userId
        : undefined,
  });

  emitDiagnosticsPatch();
}

async function stopQwenOmniAudioPipeline(): Promise<void> {
  setRealtimeAudioDiagnosticsListener(null);
  clearAudioDiagnosticsInterval();
  clearUplinkResumeTimer();

  if (controllerState.audioStream) {
    await controllerState.audioStream.stop();
    controllerState.audioStream = null;
  }

  controllerState.turnSync = null;
  clearSharedMediaStream();
  await teardownRealtimeAudioCapture();
}

async function openClientConnection(): Promise<void> {
  const { credentials, openingTranscript, abortController } = controllerState;
  if (!credentials) {
    return;
  }

  controllerState.client = createRealtimeClient(credentials);
  controllerState.unsubscribe = controllerState.client.onEvent(mapClientEvent);

  const sessionUpdateEvent = credentials.metadata?.sessionUpdateEvent;
  const skipOpeningTranscript = isQwenOmniRealtimeProvider(credentials.provider);

  await controllerState.client.connect(credentials, {
    openingTranscript: skipOpeningTranscript ? undefined : openingTranscript,
    sessionUpdateEvent,
    signal: abortController?.signal,
  });

  await startQwenOmniAudioPipeline(credentials);
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

  await stopQwenOmniAudioPipeline();

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
  clearUplinkResumeTimer();
  controllerState.client?.interrupt?.();
  void controllerState.audioStream?.interrupt();
}
