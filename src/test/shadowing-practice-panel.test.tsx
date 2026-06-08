import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShadowingPracticePanel } from "@/components/shadowing-practice-panel";
import { formatShadowingAudioDuration } from "@/components/shadowing-standard-audio-player";

const fetchShadowingItemAudioBlob = vi.fn();

vi.mock("@/features/conversation/fetch-shadowing-audio-api", () => ({
  fetchShadowingItemAudioBlob: (...args: unknown[]) => fetchShadowingItemAudioBlob(...args),
  buildShadowingItemAudioUrl: (sessionId: string, itemId: string) =>
    `/api/sessions/${sessionId}/shadowing/${itemId}/audio`,
}));

vi.mock("@/features/conversation/submit-shadowing-practice-api", () => ({
  submitShadowingPracticeRecording: vi.fn(),
}));

vi.mock("@/components/shadowing-practice-recorder", () => ({
  ShadowingPracticeRecorder: () => <div data-testid="shadowing-practice-recorder" />,
}));

describe("formatShadowingAudioDuration", () => {
  it("formats reasonable durations and hides corrupted metadata", () => {
    expect(
      formatShadowingAudioDuration({
        provider: "cosyvoice",
        objectKey: "tts/a.wav",
        format: "wav",
        sizeBytes: 44739,
        voice: "longxiaochun_v3",
        speed: 1,
        language: "en",
        cacheKey: "cache",
        durationMs: 2800,
      }),
    ).toBe("2.8 秒");

    expect(
      formatShadowingAudioDuration({
        provider: "cosyvoice",
        objectKey: "tts/a.wav",
        format: "wav",
        sizeBytes: 44739,
        voice: "longxiaochun_v3",
        speed: 1,
        language: "en",
        cacheKey: "cache",
        durationMs: 44739,
      }),
    ).toBeNull();
  });
});

describe("ShadowingPracticePanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders shadowing items with original text and a play button", async () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "Audio").mockImplementation(function MockAudio() {
      return {
        play: playMock,
        pause: vi.fn(),
        addEventListener: vi.fn(),
      } as unknown as HTMLAudioElement;
    });

    URL.createObjectURL = vi.fn(() => "blob:shadowing-audio");
    URL.revokeObjectURL = vi.fn();

    fetchShadowingItemAudioBlob.mockResolvedValue(
      new Blob(["RIFF"], { type: "audio/wav" }),
    );

    render(
      <ShadowingPracticePanel
        sessionId="11111111-1111-4111-8111-111111111111"
        status="ready"
        items={[
          {
            id: "shadowing-item-0",
            sessionId: "11111111-1111-4111-8111-111111111111",
            standardText: "Could I get a medium latte?",
            originalText: "I want coffee",
            source: "report_recommendation",
            standardAudioStatus: "ready",
            standardAudio: {
              provider: "mock-tts",
              objectKey: "tts/abc123.wav",
              format: "wav",
              sizeBytes: 4096,
              voice: "en-us-neutral",
              speed: 1,
              language: "en",
              cacheKey: "cache-key",
              durationMs: 2000,
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId("shadowing-practice-panel")).toBeInTheDocument();
    expect(screen.getByText("Could I get a medium latte?")).toBeInTheDocument();
    expect(screen.getByText(/你的表达：I want coffee/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放标准音频" })).toBeInTheDocument();
    expect(screen.getByTestId("shadowing-practice-recorder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "播放标准音频" }));

    await waitFor(() => {
      expect(fetchShadowingItemAudioBlob).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        "shadowing-item-0",
      );
    });

    await waitFor(() => {
      expect(playMock).toHaveBeenCalled();
    });
  });
});
