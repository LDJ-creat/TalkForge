import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QwenOmniAudioStream } from "@/features/conversation/realtime/adapters/qwen-omni-audio-stream";

vi.mock("@/features/conversation/realtime/audio/mic-capture", () => ({
  startMicCapture: vi.fn(async () => ({
    stream: { getTracks: () => [] } as unknown as MediaStream,
    stop: vi.fn(async () => undefined),
  })),
}));

vi.mock("@/features/conversation/realtime/audio/pcm-player", () => ({
  PcmPlayer: vi.fn().mockImplementation(() => ({
    init: vi.fn(async () => undefined),
    enqueue: vi.fn(),
    interrupt: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
  })),
}));

describe("QwenOmniAudioStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("sends batched input_audio_buffer.append messages", async () => {
    const sendProviderMessage = vi.fn();
    const stream = new QwenOmniAudioStream({ sendProviderMessage });

    const { startMicCapture } = await import(
      "@/features/conversation/realtime/audio/mic-capture"
    );
    const micMock = vi.mocked(startMicCapture);
    let onPcmChunk: ((pcm16: Int16Array) => void) | undefined;

    micMock.mockImplementation(async (options) => {
      onPcmChunk = options.onPcmChunk;
      return {
        stream: { getTracks: () => [] } as unknown as MediaStream,
        stop: vi.fn(async () => undefined),
      };
    });

    await stream.start();
    onPcmChunk?.(new Int16Array([3000, 2500, 2800]));

    vi.advanceTimersByTime(100);

    expect(sendProviderMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "input_audio_buffer.append",
        audio: expect.any(String),
      }),
    );

    await stream.stop();
  });

  it("does not uplink mic audio while assistant playback is gated", async () => {
    const sendProviderMessage = vi.fn();
    const stream = new QwenOmniAudioStream({ sendProviderMessage });

    const { startMicCapture } = await import(
      "@/features/conversation/realtime/audio/mic-capture"
    );
    const micMock = vi.mocked(startMicCapture);
    let onPcmChunk: ((pcm16: Int16Array) => void) | undefined;

    micMock.mockImplementation(async (options) => {
      onPcmChunk = options.onPcmChunk;
      return {
        stream: { getTracks: () => [] } as unknown as MediaStream,
        stop: vi.fn(async () => undefined),
      };
    });

    await stream.start();
    stream.setUplinkEnabled(false);
    onPcmChunk?.(new Int16Array([4, 5, 6]));

    vi.advanceTimersByTime(100);

    expect(sendProviderMessage).not.toHaveBeenCalled();

    stream.setUplinkEnabled(true);
    onPcmChunk?.(new Int16Array([3200, 3100, 2900]));
    vi.advanceTimersByTime(100);

    expect(sendProviderMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "input_audio_buffer.append",
      }),
    );

    await stream.stop();
  });

  it("forwards response audio deltas to the player", async () => {
    const sendProviderMessage = vi.fn();
    const stream = new QwenOmniAudioStream({ sendProviderMessage });
    const { PcmPlayer } = await import("@/features/conversation/realtime/audio/pcm-player");
    const playerInstance = vi.mocked(PcmPlayer).mock.results[0]?.value as {
      enqueue: ReturnType<typeof vi.fn>;
    };

    stream.handleAudioDelta("AAEC");

    expect(playerInstance.enqueue).toHaveBeenCalled();
  });
});
