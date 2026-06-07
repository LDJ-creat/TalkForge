import { describe, expect, it } from "vitest";

import {
  computePcm16PeakLevel,
  passesNoiseGate,
} from "@/features/conversation/realtime/audio/noise-gate";

describe("noise gate", () => {
  it("drops near-silent frames", () => {
    const quiet = new Int16Array([10, -8, 4]);
    expect(passesNoiseGate(quiet, 0.012)).toBe(false);
  });

  it("allows speech-level frames", () => {
    const speech = new Int16Array([3000, -2500, 1800]);
    expect(computePcm16PeakLevel(speech)).toBeGreaterThan(0.05);
    expect(passesNoiseGate(speech, 0.012)).toBe(true);
  });
});
