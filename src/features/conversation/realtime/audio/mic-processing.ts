export type MicProcessingConstraints = {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
};

/** Software gain applied before PCM16 encode when browser processing suppresses input. */
export const DEFAULT_MIC_INPUT_GAIN = 6;

export function resolveMicProcessingConstraints(): MicProcessingConstraints {
  const mode =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_REALTIME_MIC_PROCESSING
      : undefined;

  if (mode === "raw") {
    return {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
    };
  }

  if (mode === "standard") {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
  }

  // balanced (default): suppress ambient noise while uplink gating handles speaker echo.
  return {
    echoCancellation: false,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

export function resolveMicInputGain(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_REALTIME_MIC_GAIN
      : undefined;

  if (!raw?.trim()) {
    return DEFAULT_MIC_INPUT_GAIN;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MIC_INPUT_GAIN;
}

export function applyMicInputGain(samples: Float32Array, gain: number): Float32Array {
  if (gain === 1) {
    return samples;
  }

  const boosted = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const value = (samples[index] ?? 0) * gain;
    boosted[index] = Math.max(-1, Math.min(1, value));
  }

  return boosted;
}
