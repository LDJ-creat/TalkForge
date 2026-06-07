import { describe, expect, it } from "vitest";

import {
  base64ToPcm16,
  float32ToPcm16,
  mergePcm16Chunks,
  pcm16ToBase64,
  resampleLinear,
} from "@/features/conversation/realtime/audio/pcm-utils";

describe("pcm-utils", () => {
  it("converts float32 samples to pcm16", () => {
    const input = new Float32Array([0, 1, -1, 0.5]);
    const output = float32ToPcm16(input);

    expect(output[0]).toBe(0);
    expect(output[1]).toBe(0x7fff);
    expect(output[2]).toBe(-0x8000);
    expect(output[3]).toBe(16383);
  });

  it("resamples audio to a lower sample rate", () => {
    const input = new Float32Array([0, 1, 0, -1]);
    const output = resampleLinear(input, 16_000, 8_000);

    expect(output.length).toBe(2);
    expect(output[0]).toBe(0);
    expect(output[1]).toBe(0);
  });

  it("round-trips pcm16 through base64", () => {
    const original = new Int16Array([0, 1234, -5678, 32767]);
    const encoded = pcm16ToBase64(original);
    const decoded = base64ToPcm16(encoded);

    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it("merges pcm16 chunks in order", () => {
    const merged = mergePcm16Chunks([
      new Int16Array([1, 2]),
      new Int16Array([3]),
      new Int16Array([4, 5, 6]),
    ]);

    expect(Array.from(merged)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
