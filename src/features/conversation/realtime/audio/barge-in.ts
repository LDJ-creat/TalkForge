import { computePcm16PeakLevel } from "./noise-gate";

/** Off by default — speaker bleed easily false-triggers barge-in without headphones. */
export function isBargeInEnabled(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_REALTIME_BARGE_IN === "true"
  );
}

/** Peak level that suggests deliberate user speech over speaker bleed. */
export const DEFAULT_BARGE_IN_PEAK = 0.14;

/** Consecutive loud frames required before voice barge-in fires. */
export const DEFAULT_BARGE_IN_HIT_COUNT = 6;

/** Ignore mic during the first stretch of AI playback (speaker attack). */
export const DEFAULT_BARGE_IN_ARM_DELAY_MS = 1200;

export function resolveBargeInPeak(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_REALTIME_BARGE_IN_PEAK
      : undefined;

  if (!raw?.trim()) {
    return DEFAULT_BARGE_IN_PEAK;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BARGE_IN_PEAK;
}

export function resolveBargeInHitCount(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_REALTIME_BARGE_IN_HITS
      : undefined;

  if (!raw?.trim()) {
    return DEFAULT_BARGE_IN_HIT_COUNT;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_BARGE_IN_HIT_COUNT;
}

export function resolveBargeInArmDelayMs(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_REALTIME_BARGE_IN_ARM_MS
      : undefined;

  if (!raw?.trim()) {
    return DEFAULT_BARGE_IN_ARM_DELAY_MS;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_BARGE_IN_ARM_DELAY_MS;
}

export class BargeInDetector {
  private consecutiveHits = 0;
  private armedAt = 0;
  private bleedPeak = 0;
  private readonly peakThreshold: number;
  private readonly hitCount: number;
  private readonly armDelayMs: number;
  private readonly onTrigger: () => void;

  constructor(onTrigger: () => void) {
    this.peakThreshold = resolveBargeInPeak();
    this.hitCount = resolveBargeInHitCount();
    this.armDelayMs = resolveBargeInArmDelayMs();
    this.onTrigger = onTrigger;
  }

  observePcm16(pcm: Int16Array): void {
    if (this.armedAt === 0 || Date.now() - this.armedAt < this.armDelayMs) {
      return;
    }

    const peak = computePcm16PeakLevel(pcm);

    if (peak <= this.bleedPeak + 0.08) {
      this.bleedPeak = Math.max(this.bleedPeak * 0.98, peak);
      this.consecutiveHits = 0;
      return;
    }

    if (peak >= this.peakThreshold) {
      this.consecutiveHits += 1;
      if (this.consecutiveHits >= this.hitCount) {
        this.consecutiveHits = 0;
        this.onTrigger();
      }
      return;
    }

    this.consecutiveHits = 0;
  }

  reset(): void {
    this.consecutiveHits = 0;
    this.bleedPeak = 0;
    this.armedAt = Date.now();
  }
}
