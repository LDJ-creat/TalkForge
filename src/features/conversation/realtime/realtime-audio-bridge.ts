"use client";

import { getClientTurnAudioCacheAdapter } from "@/lib/audio-cache/client-adapter";

import type { RealtimeLifecycleStatus } from "./lifecycle";
import { isQwenOmniRealtimeProvider } from "./adapters/qwen-omni-connect";
import { isMockRealtimeProvider } from "./websocket-client";

const MIN_TURN_DURATION_MS = 300;

type ActiveCapture = {
  turnId: string;
  sessionId: string;
  startedAt: number;
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: BlobPart[];
  ownsStream: boolean;
};

let sharedStream: MediaStream | null = null;
let activeCapture: ActiveCapture | null = null;

export function bindSharedMediaStream(stream: MediaStream): void {
  sharedStream = stream;
}

export function getBoundSharedMediaStream(): MediaStream | null {
  return sharedStream;
}

export function clearSharedMediaStream(): void {
  sharedStream = null;
}

function canCaptureAudio(
  lifecycle: RealtimeLifecycleStatus,
  provider: string | null | undefined,
  sessionId: string | null | undefined,
): boolean {
  return (
    (lifecycle === "listening" ||
      lifecycle === "user_speaking" ||
      lifecycle === "connected" ||
      lifecycle === "assistant_speaking") &&
    Boolean(sessionId) &&
    Boolean(provider) &&
    !isMockRealtimeProvider(provider ?? "")
  );
}

async function resolveCaptureStream(): Promise<MediaStream> {
  if (sharedStream) {
    return sharedStream;
  }

  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    throw new Error("Microphone access is not available in this browser.");
  }

  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export async function startSharedTurnCapture(
  sessionId: string,
  turnId: string,
): Promise<void> {
  if (activeCapture) {
    return;
  }

  const stream = await resolveCaptureStream();
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  activeCapture = {
    turnId,
    sessionId,
    startedAt: Date.now(),
    recorder,
    stream,
    chunks,
    ownsStream: !sharedStream,
  };

  recorder.start(250);
}

export async function stopSharedTurnCapture(): Promise<void> {
  const capture = activeCapture;
  if (!capture) {
    return;
  }

  activeCapture = null;

  await new Promise<void>((resolve) => {
    capture.recorder.addEventListener("stop", () => resolve(), { once: true });
    if (capture.recorder.state !== "inactive") {
      capture.recorder.stop();
    } else {
      resolve();
    }
  });

  if (capture.ownsStream) {
    for (const track of capture.stream.getTracks()) {
      track.stop();
    }
  }

  const durationMs = Math.max(Date.now() - capture.startedAt, MIN_TURN_DURATION_MS);
  if (capture.chunks.length === 0) {
    return;
  }

  const blob = new Blob(capture.chunks, {
    type: capture.recorder.mimeType || "audio/webm",
  });

  const adapter = getClientTurnAudioCacheAdapter();
  await adapter.save({
    turnId: capture.turnId,
    sessionId: capture.sessionId,
    blob,
    durationMs,
  });
}

export async function syncRealtimeAudioCapture(input: {
  lifecycle: RealtimeLifecycleStatus;
  provider: string | null | undefined;
  sessionId: string | null | undefined;
}): Promise<string | null> {
  if (!canCaptureAudio(input.lifecycle, input.provider, input.sessionId)) {
    return null;
  }

  if (isQwenOmniRealtimeProvider(input.provider ?? "")) {
    if (!sharedStream) {
      return null;
    }
    return null;
  }

  if (!sharedStream) {
    try {
      const stream = await resolveCaptureStream();
      bindSharedMediaStream(stream);
      return null;
    } catch {
      return "Microphone access is required for realtime voice practice.";
    }
  }

  return null;
}

export async function teardownRealtimeAudioCapture(): Promise<void> {
  if (activeCapture) {
    await stopSharedTurnCapture();
  }

  clearSharedMediaStream();
}
