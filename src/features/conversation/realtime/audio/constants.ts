/** DashScope realtime input: 16-bit PCM mono at 16 kHz. */
export const INPUT_SAMPLE_RATE = 16_000;

/** DashScope realtime output: 16-bit PCM mono at 24 kHz. */
export const OUTPUT_SAMPLE_RATE = 24_000;

/** Target interval for batching mic PCM before input_audio_buffer.append. */
export const INPUT_APPEND_INTERVAL_MS = 100;

/** Extra mute after AI playback ends before resuming mic uplink (speaker echo tail). */
export const UPLINK_PLAYBACK_TAIL_MUTE_MS = 450;
