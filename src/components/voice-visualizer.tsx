import type { TurnStatus } from "@/features/conversation";
import { voiceVisualizerCopy } from "@/lib/ui-copy";

type VoiceVisualizerProps = {
  turnStatus: TurnStatus;
  label?: string;
};

function getVisualizerLabel(turnStatus: TurnStatus): string {
  switch (turnStatus) {
    case "user_speaking":
      return voiceVisualizerCopy.listening;
    case "assistant_speaking":
      return voiceVisualizerCopy.aiResponding;
    case "user_processing":
    case "assistant_processing":
      return voiceVisualizerCopy.processing;
    default:
      return voiceVisualizerCopy.ready;
  }
}

export function VoiceVisualizer({ turnStatus, label }: VoiceVisualizerProps) {
  const isActive =
    turnStatus === "user_speaking" ||
    turnStatus === "assistant_speaking" ||
    turnStatus === "user_processing" ||
    turnStatus === "assistant_processing";

  return (
    <div
      className={`voice-visualizer${isActive ? " voice-visualizer--active" : ""}`}
      data-testid="voice-visualizer"
      aria-hidden="true"
    >
      <span className="voice-visualizer__orb voice-visualizer__orb--one" />
      <span className="voice-visualizer__orb voice-visualizer__orb--two" />
      <span className="voice-visualizer__orb voice-visualizer__orb--three" />
      <p className="voice-visualizer__label">{label ?? getVisualizerLabel(turnStatus)}</p>
    </div>
  );
}
