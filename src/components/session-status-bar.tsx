import {
  REALTIME_LIFECYCLE_LABELS,
  type RealtimeConnectionDiagnostics,
  type RealtimeLifecycleStatus,
} from "@/features/conversation/realtime/lifecycle";
import type { ConnectionStatus, TurnStatus } from "@/features/conversation";
import { statusCopy } from "@/lib/ui-copy";

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
    lifecycle === "user_speaking" ||
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
  evaluationPlaceholder = statusCopy.evaluationPlaceholder,
}: SessionStatusBarProps) {
  return (
    <div className="status-list" data-testid="session-status-bar">
      <div className="status-row">
        <span className="status-row__label">{statusCopy.realtime}</span>
        <span
          className={`status-row__value ${connectionPillClass(realtimeLifecycleStatus, connectionStatus)}`}
        >
          {connectionStatus === "disconnecting"
            ? statusCopy.endingSession
            : REALTIME_LIFECYCLE_LABELS[realtimeLifecycleStatus]}
        </span>
      </div>
      <div className="status-row">
        <span className="status-row__label">{statusCopy.turnLabel}</span>
        <span className="status-row__value">{statusCopy.turnStatus[turnStatus]}</span>
      </div>
      <div className="status-row">
        <span className="status-row__label">{statusCopy.session}</span>
        <span className="status-row__value">{statusCopy.sessionStatus[sessionStatus]}</span>
      </div>
      <div className="status-row">
        <span className="status-row__label">{statusCopy.evaluation}</span>
        <span className="status-row__value">{evaluationPlaceholder}</span>
      </div>
      {showDebugDetails ? (
        <div className="status-row status-row--debug" data-testid="realtime-debug-details">
          <span className="status-row__label">{statusCopy.debug}</span>
          <span className="status-row__value">
            {diagnostics?.provider ? `provider=${diagnostics.provider}` : "provider=unknown"}
            {typeof diagnostics?.connectLatencyMs === "number"
              ? ` · connect=${diagnostics.connectLatencyMs}ms`
              : ""}
            {typeof diagnostics?.reconnectAttempt === "number" && diagnostics.reconnectAttempt > 0
              ? ` · retry=${diagnostics.reconnectAttempt}`
              : ""}
            {diagnostics?.audio
              ? ` · mic=${diagnostics.audio.micChunks} append=${diagnostics.audio.appendMessages} speech=${diagnostics.audio.speechStartedCount}${
                  typeof diagnostics.audio.micPeakLevel === "number"
                    ? ` peak=${diagnostics.audio.micPeakLevel.toFixed(4)}`
                    : ""
                }${
                  typeof diagnostics.audio.captureSampleRate === "number"
                    ? ` rate=${diagnostics.audio.captureSampleRate}`
                    : ""
                }`
              : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
