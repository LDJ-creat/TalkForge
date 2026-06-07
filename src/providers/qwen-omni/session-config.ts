export type QwenOmniSessionConfig = {
  modalities: Array<"text" | "audio">;
  voice: string;
  /** DashScope docs: literal value `pcm` (16 kHz 16-bit mono PCM stream). */
  input_audio_format: "pcm";
  /** DashScope docs: literal value `pcm` (24 kHz PCM output stream). */
  output_audio_format: "pcm";
  instructions: string;
  input_audio_transcription: {
    model: string;
  };
  turn_detection: {
    type: "server_vad" | "semantic_vad";
    threshold: number;
    silence_duration_ms: number;
    prefix_padding_ms?: number;
  };
};

export type QwenOmniVadMode = "server_vad" | "semantic_vad";

export function resolveQwenOmniVadMode(model: string): QwenOmniVadMode {
  const configured =
    typeof process !== "undefined" ? process.env.REALTIME_VAD_MODE?.trim() : undefined;

  if (configured === "server_vad" || configured === "semantic_vad") {
    return configured;
  }

  // server_vad is more reliable for quiet mics and speaker playback setups.
  return "server_vad";
}

export function shouldUseSemanticVad(model: string): boolean {
  return resolveQwenOmniVadMode(model) === "semantic_vad";
}

export function buildQwenOmniSessionConfig(input: {
  instructions: string;
  voice: string;
  model?: string;
}): QwenOmniSessionConfig {
  const vadMode = resolveQwenOmniVadMode(input.model ?? "");

  return {
    modalities: ["text", "audio"],
    voice: input.voice,
    input_audio_format: "pcm",
    output_audio_format: "pcm",
    instructions: input.instructions,
    input_audio_transcription: {
      model: "qwen3-asr-flash-realtime",
    },
    turn_detection: {
      type: vadMode,
      threshold: vadMode === "server_vad" ? 0.35 : 0.5,
      silence_duration_ms: 800,
      prefix_padding_ms: 300,
    },
  };
}

export function buildQwenOmniSessionUpdateEvent(session: QwenOmniSessionConfig) {
  return {
    type: "session.update",
    session,
  };
}

/** Synthetic user turn that satisfies DashScope before the first response.create. */
export const QWEN_OMNI_OPENING_USER_TEXT =
  "I'm ready. Please greet me and start the role-play with your opening line.";

export function buildQwenOmniOpeningUserItemEvent() {
  return {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [
        {
          type: "input_text",
          text: QWEN_OMNI_OPENING_USER_TEXT,
        },
      ],
    },
  };
}

export function buildQwenOmniResponseCreateEvent() {
  return {
    type: "response.create",
    response: {
      modalities: ["text", "audio"],
    },
  };
}

/** VAD mode still requires a user item before response.create for AI opening speech. */
export function buildQwenOmniOpeningSpeechEvents() {
  return [buildQwenOmniOpeningUserItemEvent(), buildQwenOmniResponseCreateEvent()];
}
