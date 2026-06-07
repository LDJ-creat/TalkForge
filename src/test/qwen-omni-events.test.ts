import { describe, expect, it } from "vitest";

import {
  isNonRecoverableQwenOmniError,
  mapQwenOmniServerEvent,
} from "@/features/conversation/realtime/adapters/qwen-omni-events";

describe("qwen omni event adapter extended", () => {
  it("emits session_ready once after session.updated", () => {
    const first = mapQwenOmniServerEvent(
      { type: "session.updated" },
      { lifecycle: "connecting" },
    );

    expect(first.events).toContainEqual({ type: "session_ready" });
    expect(first.nextState.sessionReady).toBe(true);

    const second = mapQwenOmniServerEvent(
      { type: "session.updated" },
      first.nextState,
    );

    expect(second.events.some((event) => event.type === "session_ready")).toBe(false);
  });

  it("maps response.audio.delta to provider_audio_delta", () => {
    const mapped = mapQwenOmniServerEvent(
      { type: "response.audio.delta", delta: "YWJj" },
      { lifecycle: "assistant_speaking", activeResponseId: "resp-1" },
    );

    expect(mapped.events).toContainEqual({
      type: "provider_audio_delta",
      base64Pcm: "YWJj",
    });
  });

  it("maps user transcription events using text and stash fields", () => {
    const delta = mapQwenOmniServerEvent(
      {
        type: "conversation.item.input_audio_transcription.delta",
        item_id: "item-1",
        text: "Hel",
        stash: "lo",
      },
      { lifecycle: "listening" },
    );

    expect(delta.events).toContainEqual({
      type: "transcript_delta",
      entryId: "item-1",
      text: "Hello",
      role: "user",
    });

    const completed = mapQwenOmniServerEvent(
      {
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "item-1",
        transcript: "Hello there",
      },
      delta.nextState,
    );

    expect(completed.events).toContainEqual({
      type: "transcript",
      entry: expect.objectContaining({
        id: "item-1",
        role: "user",
        text: "Hello there",
        status: "final",
      }),
    });
  });

  it("maps speech lifecycle and internal speech events", () => {
    const started = mapQwenOmniServerEvent(
      { type: "input_audio_buffer.speech_started", item_id: "item-2" },
      { lifecycle: "connected" },
    );

    expect(started.events).toContainEqual({ type: "user_speech_started" });
    expect(started.events).toContainEqual({ type: "lifecycle", status: "user_speaking" });

    const stopped = mapQwenOmniServerEvent(
      { type: "input_audio_buffer.speech_stopped" },
      started.nextState,
    );

    expect(stopped.events).toContainEqual({ type: "user_speech_stopped" });
    expect(stopped.events).toContainEqual({ type: "lifecycle", status: "connected" });
  });

  it("parses provider error messages", () => {
    const mapped = mapQwenOmniServerEvent(
      {
        type: "error",
        error: { message: "Invalid session configuration." },
      },
      { lifecycle: "connected" },
    );

    expect(mapped.events).toContainEqual({
      type: "error",
      message: "Invalid session configuration.",
      recoverable: true,
    });
  });

  it("marks unsupported voice errors as non-recoverable", () => {
    const message = "InternalError.Algo.InvalidParameter: Voice 'Cherry' is not supported.";

    expect(isNonRecoverableQwenOmniError(message, "InvalidParameter")).toBe(true);
  });

  it("marks missing-user-message errors as non-recoverable", () => {
    const message =
      "InternalError.Algo.InvalidParameter: The input messages do not contain elements with the role of user";

    expect(isNonRecoverableQwenOmniError(message, "InvalidParameter")).toBe(true);

    const mapped = mapQwenOmniServerEvent(
      {
        type: "error",
        error: { code: "InvalidParameter", message },
      },
      { lifecycle: "connected" },
    );

    expect(mapped.events).toContainEqual({
      type: "error",
      message,
      recoverable: false,
    });
  });
});
