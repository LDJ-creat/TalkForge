import type { ConnectionStatus, TurnStatus } from "../types";

export const REALTIME_LIFECYCLE_STATUSES = [
  "idle",
  "connecting",
  "connected",
  "listening",
  "assistant_speaking",
  "interrupted",
  "reconnecting",
  "failed",
  "fallback",
  "ended",
] as const;

export type RealtimeLifecycleStatus = (typeof REALTIME_LIFECYCLE_STATUSES)[number];

export type RealtimeConnectionDiagnostics = {
  connectLatencyMs?: number;
  lastEventLatencyMs?: number;
  reconnectAttempt?: number;
  provider?: string;
};

export const REALTIME_LIFECYCLE_LABELS: Record<RealtimeLifecycleStatus, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  listening: "Listening",
  assistant_speaking: "AI is speaking",
  interrupted: "Interrupted",
  reconnecting: "Reconnecting…",
  failed: "Connection failed",
  fallback: "Text practice mode",
  ended: "Session ended",
};

export function deriveConnectionStatus(
  lifecycle: RealtimeLifecycleStatus,
): ConnectionStatus {
  switch (lifecycle) {
    case "idle":
      return "idle";
    case "connecting":
      return "connecting";
    case "connected":
    case "listening":
    case "assistant_speaking":
    case "interrupted":
    case "fallback":
      return "connected";
    case "reconnecting":
      return "reconnecting";
    case "failed":
      return "failed";
    case "ended":
      return "disconnected";
  }
}

export function deriveTurnStatus(lifecycle: RealtimeLifecycleStatus): TurnStatus {
  switch (lifecycle) {
    case "listening":
      return "user_speaking";
    case "assistant_speaking":
      return "assistant_speaking";
    case "interrupted":
      return "idle";
    default:
      return "idle";
  }
}

export function isRealtimeSessionActive(lifecycle: RealtimeLifecycleStatus): boolean {
  return (
    lifecycle === "connected" ||
    lifecycle === "listening" ||
    lifecycle === "assistant_speaking" ||
    lifecycle === "interrupted" ||
    lifecycle === "fallback"
  );
}

export function isRealtimeEnding(lifecycle: RealtimeLifecycleStatus): boolean {
  return lifecycle === "ended";
}

export function canRetryRealtime(lifecycle: RealtimeLifecycleStatus): boolean {
  return lifecycle === "failed";
}

export function canEnterFallback(lifecycle: RealtimeLifecycleStatus): boolean {
  return lifecycle === "failed" || lifecycle === "reconnecting";
}
