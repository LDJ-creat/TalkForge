export type RealtimeAudioDiagnostics = {
  micChunks: number;
  appendMessages: number;
  appendBytes: number;
  lastAppendAt: string | null;
  speechStartedCount: number;
  speechStoppedCount: number;
  lastSpeechStartedAt: string | null;
  micContextState: string | null;
  captureSampleRate: number | null;
  micPeakLevel: number | null;
  micTrackLabel: string | null;
  micTrackMuted: boolean | null;
  micTrackEnabled: boolean | null;
  micInputGain: number | null;
};

const initial: RealtimeAudioDiagnostics = {
  micChunks: 0,
  appendMessages: 0,
  appendBytes: 0,
  lastAppendAt: null,
  speechStartedCount: 0,
  speechStoppedCount: 0,
  lastSpeechStartedAt: null,
  micContextState: null,
  captureSampleRate: null,
  micPeakLevel: null,
  micTrackLabel: null,
  micTrackMuted: null,
  micTrackEnabled: null,
  micInputGain: null,
};

let snapshot = { ...initial };
let onChange: (() => void) | null = null;

function logDev(message: string, data?: Record<string, unknown>): void {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    console.info(
      `[talkforge:realtime-audio] ${message}`,
      data ? JSON.stringify(data) : "",
    );
  }
}

function notifyChange(): void {
  onChange?.();
}

export function setRealtimeAudioDiagnosticsListener(listener: (() => void) | null): void {
  onChange = listener;
}

export function resetRealtimeAudioDiagnostics(): void {
  snapshot = { ...initial };
  notifyChange();
}

export function recordCaptureSampleRate(sampleRate: number): void {
  snapshot = { ...snapshot, captureSampleRate: sampleRate };
  logDev("capture sample rate", { sampleRate });
  notifyChange();
}

export function recordMicTrack(
  track: MediaStreamTrack,
  inputGain: number,
): void {
  snapshot = {
    ...snapshot,
    micTrackLabel: track.label || "unknown",
    micTrackMuted: track.muted,
    micTrackEnabled: track.enabled,
    micInputGain: inputGain,
  };
  logDev("mic track", {
    label: track.label,
    muted: track.muted,
    enabled: track.enabled,
    inputGain,
  });
  notifyChange();
}

export function recordMicChunk(peakLevel?: number): void {
  snapshot = {
    ...snapshot,
    micChunks: snapshot.micChunks + 1,
    micPeakLevel:
      typeof peakLevel === "number"
        ? Math.max(snapshot.micPeakLevel ?? 0, peakLevel)
        : snapshot.micPeakLevel,
  };
}

export function recordMicContextState(state: string): void {
  snapshot = { ...snapshot, micContextState: state };
  logDev("mic context state", { state });
  notifyChange();
}

export function recordAudioAppend(byteLength: number): void {
  snapshot = {
    ...snapshot,
    appendMessages: snapshot.appendMessages + 1,
    appendBytes: snapshot.appendBytes + byteLength,
    lastAppendAt: new Date().toISOString(),
  };

  if (snapshot.appendMessages === 1 || snapshot.appendMessages % 50 === 0) {
    logDev("upstream append", {
      count: snapshot.appendMessages,
      bytes: snapshot.appendBytes,
      micChunks: snapshot.micChunks,
      micPeakLevel: snapshot.micPeakLevel,
    });
  }

  notifyChange();
}

export function recordSpeechStarted(): void {
  snapshot = {
    ...snapshot,
    speechStartedCount: snapshot.speechStartedCount + 1,
    lastSpeechStartedAt: new Date().toISOString(),
  };
  logDev("server detected speech start", {
    count: snapshot.speechStartedCount,
  });
  notifyChange();
}

export function recordSpeechStopped(): void {
  snapshot = {
    ...snapshot,
    speechStoppedCount: snapshot.speechStoppedCount + 1,
  };
  logDev("server detected speech stop", {
    count: snapshot.speechStoppedCount,
  });
  notifyChange();
}

export function getRealtimeAudioDiagnostics(): RealtimeAudioDiagnostics {
  return { ...snapshot };
}

export function computePeakLevel(samples: Float32Array): number {
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const level = Math.abs(samples[index] ?? 0);
    if (level > peak) {
      peak = level;
    }
  }
  return peak;
}
