"use client";

import { getClientTurnAudioCacheAdapter } from "@/lib/audio-cache/client-adapter";

import type { RealtimeLifecycleStatus } from "./lifecycle";
import { isMockRealtimeProvider } from "./websocket-client";

const MIN_TURN_DURATION_MS = 300;

type ActiveCapture = {
  turnId: string;
  sessionId: string;
  startedAt: number;
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: BlobPart[];
};

let activeCapture: ActiveCapture | null = null;

function createTurnId(): string {
  return crypto.randomUUID();
}

function canCaptureAudio(
  lifecycle: RealtimeLifecycleStatus,
  provider: string | null | undefined,
  sessionId: string | null | undefined,
): boolean {
  return (
    lifecycle === "listening" &&
    Boolean(sessionId) &&
    Boolean(provider) &&
    !isMockRealtimeProvider(provider ?? "")
  );
}

async function startCapture(sessionId: string): Promise<void> {
  if (activeCapture || typeof navigator === "undefined" || !navigator.mediaDevices) {
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const turnId = createTurnId();
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
  };

  recorder.start(250);
}

async function stopCapture(): Promise<void> {
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

  for (const track of capture.stream.getTracks()) {
    track.stop();
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
    if (activeCapture) {
      await stopCapture();
    }
    return null;
  }

  if (!activeCapture) {
    try {
      await startCapture(input.sessionId!);
      return null;
    } catch {
      return "Microphone access is required for realtime voice practice.";
    }
  }

  return null;
}

export async function teardownRealtimeAudioCapture(): Promise<void> {
  if (activeCapture) {
    await stopCapture();
  }
}
