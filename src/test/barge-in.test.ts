import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BargeInDetector,
  isBargeInEnabled,
} from "@/features/conversation/realtime/audio/barge-in";

describe("barge-in", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("is disabled unless explicitly enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_BARGE_IN", undefined);
    expect(isBargeInEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_REALTIME_BARGE_IN", "true");
    expect(isBargeInEnabled()).toBe(true);
  });

  it("triggers after arm delay when speech is louder than speaker bleed", () => {
    const onTrigger = vi.fn();
    const detector = new BargeInDetector(onTrigger);
    const bleed = new Int16Array(128).fill(1200);
    const speech = new Int16Array(128).fill(12000);

    detector.reset();
    vi.advanceTimersByTime(1300);

    for (let index = 0; index < 8; index += 1) {
      detector.observePcm16(bleed);
    }

    for (let index = 0; index < 5; index += 1) {
      detector.observePcm16(speech);
    }
    expect(onTrigger).not.toHaveBeenCalled();

    detector.observePcm16(speech);
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});
