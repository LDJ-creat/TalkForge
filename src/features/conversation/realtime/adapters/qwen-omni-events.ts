import {
  recordSpeechStarted,
  recordSpeechStopped,
} from "../audio/audio-diagnostics";
import type { RealtimeClientEvent } from "../client-types";
import type { RealtimeLifecycleStatus } from "../lifecycle";

type QwenRealtimeServerEvent = {
  type?: string;
  event_id?: string;
  session?: { id?: string };
  response?: { id?: string };
  item_id?: string;
  transcript?: string;
  delta?: string;
  text?: string;
  stash?: string;
  error?: {
    message?: string;
    code?: string;
  };
};

function createTranscriptId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isNonRecoverableQwenOmniError(message: string, code?: string): boolean {
  const normalized = message.toLowerCase();
  return (
    code === "InvalidParameter" ||
    normalized.includes("invalidparameter") ||
    normalized.includes("role of user") ||
    normalized.includes("do not contain elements with the role of user") ||
    normalized.includes("is not supported")
  );
}

export function mapQwenOmniServerEvent(
  payload: unknown,
  state: {
    lifecycle: RealtimeLifecycleStatus;
    activeResponseId?: string;
    activeUserItemId?: string;
    sessionReady?: boolean;
  },
): { events: RealtimeClientEvent[]; nextState: typeof state } {
  const event = payload as QwenRealtimeServerEvent;
  const events: RealtimeClientEvent[] = [];
  const nextState = { ...state };

  if (!event?.type) {
    return { events, nextState };
  }

  switch (event.type) {
    case "session.created":
      events.push({ type: "lifecycle", status: "connected" });
      nextState.lifecycle = "connected";
      break;
    case "session.updated":
      events.push({ type: "lifecycle", status: "connected" });
      nextState.lifecycle = "connected";
      if (!nextState.sessionReady) {
        events.push({ type: "session_ready" });
        nextState.sessionReady = true;
      }
      break;
    case "input_audio_buffer.speech_started":
      nextState.activeUserItemId = event.item_id;
      recordSpeechStarted();
      events.push({ type: "user_speech_started" });
      events.push({ type: "lifecycle", status: "user_speaking" });
      nextState.lifecycle = "user_speaking";
      break;
    case "input_audio_buffer.speech_stopped":
      recordSpeechStopped();
      events.push({ type: "user_speech_stopped" });
      events.push({ type: "lifecycle", status: "connected" });
      nextState.lifecycle = "connected";
      break;
    case "response.created":
      nextState.activeResponseId = event.response?.id;
      events.push({ type: "lifecycle", status: "assistant_speaking" });
      nextState.lifecycle = "assistant_speaking";
      break;
    case "response.audio.delta": {
      const delta = event.delta ?? "";
      if (delta) {
        events.push({ type: "provider_audio_delta", base64Pcm: delta });
      }
      break;
    }
    case "response.audio.done":
      events.push({ type: "provider_audio_done" });
      break;
    case "response.audio_transcript.delta":
    case "response.text.delta": {
      const delta = event.delta ?? "";
      if (delta && nextState.activeResponseId) {
        events.push({
          type: "transcript_delta",
          entryId: nextState.activeResponseId,
          text: delta,
          role: "assistant",
        });
      }
      break;
    }
    case "conversation.item.input_audio_transcription.delta": {
      const delta = `${event.text ?? ""}${event.stash ?? event.delta ?? ""}`;
      const entryId = event.item_id ?? nextState.activeUserItemId ?? createTranscriptId("user");
      if (delta) {
        events.push({
          type: "transcript_delta",
          entryId,
          text: delta,
          role: "user",
        });
      }
      break;
    }
    case "conversation.item.input_audio_transcription.completed": {
      const text = event.transcript ?? "";
      const entryId = event.item_id ?? nextState.activeUserItemId ?? createTranscriptId("user");
      if (text) {
        events.push({
          type: "transcript",
          entry: {
            id: entryId,
            role: "user",
            text,
            status: "final",
            timestamp: new Date().toISOString(),
          },
        });
      }
      nextState.activeUserItemId = undefined;
      break;
    }
    case "response.audio_transcript.done":
    case "response.text.done": {
      const text = event.transcript ?? event.delta ?? "";
      if (text) {
        events.push({
          type: "transcript",
          entry: {
            id: nextState.activeResponseId ?? createTranscriptId("assistant"),
            role: "assistant",
            text,
            status: "final",
            timestamp: new Date().toISOString(),
          },
        });
      }
      break;
    }
    case "response.done":
      events.push({ type: "lifecycle", status: "listening" });
      nextState.lifecycle = "listening";
      nextState.activeResponseId = undefined;
      break;
    case "response.cancelled":
    case "response.interrupted":
      events.push({ type: "provider_audio_done" });
      events.push({ type: "lifecycle", status: "interrupted" });
      nextState.lifecycle = "interrupted";
      break;
    case "error": {
      const message = event.error?.message ?? "Realtime connection reported an error.";
      events.push({
        type: "error",
        message,
        recoverable: !isNonRecoverableQwenOmniError(message, event.error?.code),
      });
      break;
    }
    default:
      break;
  }

  return { events, nextState };
}
