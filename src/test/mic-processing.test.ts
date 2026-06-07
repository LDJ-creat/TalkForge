import { describe, expect, it } from "vitest";

import {
  applyMicInputGain,
  DEFAULT_MIC_INPUT_GAIN,
} from "@/features/conversation/realtime/audio/mic-processing";

describe("mic processing", () => {
  it("amplifies quiet samples before pcm encoding", () => {
    const input = new Float32Array([0.001, -0.002, 0.0005]);
    const boosted = applyMicInputGain(input, DEFAULT_MIC_INPUT_GAIN);

    expect(boosted[0]).toBeCloseTo(0.006, 5);
    expect(boosted[1]).toBeCloseTo(-0.012, 5);
  });
});
