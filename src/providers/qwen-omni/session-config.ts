export type QwenOmniSessionConfig = {
  modalities: Array<"text" | "audio">;
  voice: string;
  input_audio_format: "pcm16" | "pcm";
  output_audio_format: "pcm24" | "pcm";
  instructions: string;
  turn_detection: {
    type: "server_vad" | "semantic_vad";
    threshold: number;
    silence_duration_ms: number;
    prefix_padding_ms?: number;
  };
};

export function buildQwenOmniSessionConfig(input: {
  instructions: string;
  voice: string;
}): QwenOmniSessionConfig {
  return {
    modalities: ["text", "audio"],
    voice: input.voice,
    input_audio_format: "pcm16",
    output_audio_format: "pcm24",
    instructions: input.instructions,
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
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
