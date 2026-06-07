import { resolveQwenOmniVoice } from "./config";
import { resolveQwenOmniVadMode } from "./session-config";

type SessionUpdateEvent = {
  type: "session.update";
  session: {
    voice?: string;
    [key: string]: unknown;
  };
};

export function normalizeQwenOmniSessionUpdateEvent(
  model: string | undefined,
  configuredVoice: string | undefined,
  sessionUpdateEvent: unknown,
): SessionUpdateEvent | undefined {
  if (
    !sessionUpdateEvent ||
    typeof sessionUpdateEvent !== "object" ||
    (sessionUpdateEvent as { type?: string }).type !== "session.update"
  ) {
    return undefined;
  }

  const event = sessionUpdateEvent as SessionUpdateEvent;
  const resolvedModel = typeof model === "string" ? model : "";
  const voice = resolveQwenOmniVoice(
    resolvedModel,
    configuredVoice ?? (event.session.voice as string | undefined),
  );
  const vadMode = resolveQwenOmniVadMode(resolvedModel);
  const turnDetection = event.session.turn_detection as
    | {
        type?: string;
        threshold?: number;
        silence_duration_ms?: number;
        prefix_padding_ms?: number;
      }
    | undefined;

  return {
    ...event,
    session: {
      ...event.session,
      voice,
      turn_detection: {
        ...turnDetection,
        type: vadMode,
        threshold: vadMode === "server_vad" ? 0.35 : 0.5,
        silence_duration_ms: turnDetection?.silence_duration_ms ?? 800,
        prefix_padding_ms: turnDetection?.prefix_padding_ms ?? 300,
      },
    },
  };
}
