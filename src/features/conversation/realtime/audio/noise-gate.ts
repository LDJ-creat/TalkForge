export const DEFAULT_NOISE_GATE_PEAK = 0.012;

export function resolveNoiseGatePeak(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_REALTIME_NOISE_GATE
      : undefined;

  if (!raw?.trim()) {
    return DEFAULT_NOISE_GATE_PEAK;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_NOISE_GATE_PEAK;
}

export function computePcm16PeakLevel(pcm: Int16Array): number {
  if (pcm.length === 0) {
    return 0;
  }

  let peak = 0;
  for (let index = 0; index < pcm.length; index += 1) {
    peak = Math.max(peak, Math.abs(pcm[index] ?? 0) / 0x8000);
  }

  return peak;
}

export function passesNoiseGate(pcm: Int16Array, threshold: number): boolean {
  if (threshold <= 0) {
    return true;
  }

  return computePcm16PeakLevel(pcm) >= threshold;
}
