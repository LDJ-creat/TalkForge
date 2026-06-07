import type { RealtimeAudioDiagnostics } from "./audio/audio-diagnostics";
import type { ConnectionStatus, TurnStatus } from "../types";

export const REALTIME_LIFECYCLE_STATUSES = [
  "idle",
  "connecting",
  "connected",
  "listening",
  "user_speaking",
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
  audio?: RealtimeAudioDiagnostics;
};

export const REALTIME_LIFECYCLE_LABELS: Record<RealtimeLifecycleStatus, string> = {
  idle: "未连接",
  connecting: "连接中…",
  connected: "已连接",
  listening: "聆听中",
  user_speaking: "你正在说话",
  assistant_speaking: "AI 正在说话",
  interrupted: "已打断",
  reconnecting: "重新连接中…",
  failed: "连接失败",
  fallback: "文字练习模式",
  ended: "会话已结束",
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
    case "user_speaking":
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
      return "idle";
    case "user_speaking":
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
    lifecycle === "user_speaking" ||
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
