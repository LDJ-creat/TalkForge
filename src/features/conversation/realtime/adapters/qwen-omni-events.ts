import type { RealtimeClientEvent } from "../client-types";
import type { RealtimeLifecycleStatus } from "../lifecycle";

type QwenRealtimeServerEvent = {
  type?: string;
  event_id?: string;
  session?: { id?: string };
  response?: { id?: string };
  transcript?: string;
  delta?: string;
};

function createTranscriptId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function mapQwenOmniServerEvent(
  payload: unknown,
  state: {
    lifecycle: RealtimeLifecycleStatus;
    activeResponseId?: string;
  },
): { events: RealtimeClientEvent[]; nextState: typeof state } {
  const event = payload as QwenRealtimeServerEvent;
  const events: RealtimeClientEvent[] = [];
  let nextState = { ...state };

  if (!event?.type) {
    return { events, nextState };
  }

  switch (event.type) {
    case "session.created":
    case "session.updated":
      events.push({ type: "lifecycle", status: "connected" });
      nextState.lifecycle = "connected";
      break;
    case "input_audio_buffer.speech_started":
      events.push({ type: "lifecycle", status: "listening" });
      nextState.lifecycle = "listening";
      break;
    case "input_audio_buffer.speech_stopped":
      events.push({ type: "lifecycle", status: "connected" });
      nextState.lifecycle = "connected";
      break;
    case "response.created":
      nextState.activeResponseId = event.response?.id;
      events.push({ type: "lifecycle", status: "assistant_speaking" });
      nextState.lifecycle = "assistant_speaking";
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
      events.push({ type: "lifecycle", status: "connected" });
      nextState.lifecycle = "connected";
      nextState.activeResponseId = undefined;
      break;
    case "response.cancelled":
    case "response.interrupted":
      events.push({ type: "lifecycle", status: "interrupted" });
      nextState.lifecycle = "interrupted";
      break;
    case "error":
      events.push({
        type: "error",
        message: "Realtime connection reported an error.",
        recoverable: true,
      });
      break;
    default:
      break;
  }

  return { events, nextState };
}
