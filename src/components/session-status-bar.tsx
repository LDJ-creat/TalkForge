import {
  REALTIME_LIFECYCLE_LABELS,
  type RealtimeConnectionDiagnostics,
  type RealtimeLifecycleStatus,
} from "@/features/conversation/realtime/lifecycle";
import type { ConnectionStatus, TurnStatus } from "@/features/conversation";

const TURN_LABELS: Record<TurnStatus, string> = {
  idle: "Ready to speak",
  user_speaking: "You are speaking",
  user_processing: "Processing your turn",
  assistant_speaking: "AI is speaking",
  assistant_processing: "AI is thinking",
};

type SessionStatusBarProps = {
  realtimeLifecycleStatus: RealtimeLifecycleStatus;
  connectionStatus: ConnectionStatus;
  turnStatus: TurnStatus;
  sessionStatus?: "active" | "completed" | "failed";
  diagnostics?: RealtimeConnectionDiagnostics;
  showDebugDetails?: boolean;
  evaluationPlaceholder?: string;
};

function connectionPillClass(
  lifecycle: RealtimeLifecycleStatus,
  connectionStatus: ConnectionStatus,
): string {
  if (
    lifecycle === "connected" ||
    lifecycle === "listening" ||
    lifecycle === "assistant_speaking" ||
    lifecycle === "fallback"
  ) {
    return "status-pill status-pill--connected";
  }

  if (
    lifecycle === "connecting" ||
    lifecycle === "reconnecting" ||
    connectionStatus === "disconnecting"
  ) {
    return "status-pill status-pill--connecting";
  }

  if (lifecycle === "failed" || connectionStatus === "error" || connectionStatus === "failed") {
    return "status-pill status-pill--failed";
  }

  if (lifecycle === "interrupted") {
    return "status-pill status-pill--connecting";
  }

  return "status-pill";
}

export function SessionStatusBar({
  realtimeLifecycleStatus,
  connectionStatus,
  turnStatus,
  sessionStatus = "active",
  diagnostics,
  showDebugDetails = false,
  evaluationPlaceholder = "Feedback will appear after each turn",
}: SessionStatusBarProps) {
  return (
    <div className="status-list" data-testid="session-status-bar">
      <div className="status-row">
        <span className="status-row__label">Realtime</span>
        <span
          className={`status-row__value ${connectionPillClass(realtimeLifecycleStatus, connectionStatus)}`}
        >
          {connectionStatus === "disconnecting"
            ? "Ending session…"
            : REALTIME_LIFECYCLE_LABELS[realtimeLifecycleStatus]}
        </span>
      </div>
      <div className="status-row">
        <span className="status-row__label">Turn</span>
        <span className="status-row__value">{TURN_LABELS[turnStatus]}</span>
      </div>
      <div className="status-row">
        <span className="status-row__label">Session</span>
        <span className="status-row__value">{sessionStatus}</span>
      </div>
      <div className="status-row">
        <span className="status-row__label">Evaluation</span>
        <span className="status-row__value">{evaluationPlaceholder}</span>
      </div>
      {showDebugDetails ? (
        <div className="status-row status-row--debug" data-testid="realtime-debug-details">
          <span className="status-row__label">Debug</span>
          <span className="status-row__value">
            {diagnostics?.provider ? `provider=${diagnostics.provider}` : "provider=unknown"}
            {typeof diagnostics?.connectLatencyMs === "number"
              ? ` · connect=${diagnostics.connectLatencyMs}ms`
              : ""}
            {typeof diagnostics?.reconnectAttempt === "number" && diagnostics.reconnectAttempt > 0
              ? ` · retry=${diagnostics.reconnectAttempt}`
              : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
