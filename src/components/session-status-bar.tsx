import type { ConnectionStatus, TurnStatus } from "@/features/conversation";

const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  disconnecting: "Ending session…",
  disconnected: "Disconnected",
  error: "Connection error",
};

const TURN_LABELS: Record<TurnStatus, string> = {
  idle: "Ready to speak",
  user_speaking: "You are speaking",
  user_processing: "Processing your turn",
  assistant_speaking: "AI is speaking",
  assistant_processing: "AI is thinking",
};

type SessionStatusBarProps = {
  connectionStatus: ConnectionStatus;
  turnStatus: TurnStatus;
  sessionStatus?: "active" | "completed" | "failed";
  evaluationPlaceholder?: string;
};

function connectionPillClass(status: ConnectionStatus): string {
  if (status === "connected") {
    return "status-pill status-pill--connected";
  }

  if (status === "connecting" || status === "disconnecting") {
    return "status-pill status-pill--connecting";
  }

  if (status === "error") {
    return "status-pill status-pill--error";
  }

  return "status-pill";
}

export function SessionStatusBar({
  connectionStatus,
  turnStatus,
  sessionStatus = "active",
  evaluationPlaceholder = "Feedback will appear after each turn",
}: SessionStatusBarProps) {
  return (
    <div className="status-list" data-testid="session-status-bar">
      <div className="status-row">
        <span className="status-row__label">Connection</span>
        <span className={`status-row__value ${connectionPillClass(connectionStatus)}`}>
          {CONNECTION_LABELS[connectionStatus]}
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
    </div>
  );
}
