import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShadowingPracticeRecorder } from "@/components/shadowing-practice-recorder";

const submitShadowingPracticeRecording = vi.fn();

vi.mock("@/features/conversation/submit-shadowing-practice-api", () => ({
  submitShadowingPracticeRecording: (...args: unknown[]) =>
    submitShadowingPracticeRecording(...args),
}));

describe("ShadowingPracticeRecorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(global.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
  });

  it("submits a recording and renders pronunciation feedback", async () => {
    class MockMediaRecorder {
      static isTypeSupported = () => true;
      mimeType = "audio/webm";
      state = "inactive";
      listeners = new Map<string, Array<(event?: Event) => void>>();

      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}

      addEventListener(type: string, listener: (event?: Event) => void) {
        const current = this.listeners.get(type) ?? [];
        current.push(listener);
        this.listeners.set(type, current);
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        for (const listener of this.listeners.get("dataavailable") ?? []) {
          listener({ data: new Blob(["audio"], { type: "audio/webm" }) } as BlobEvent);
        }
        for (const listener of this.listeners.get("stop") ?? []) {
          listener();
        }
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder as typeof MediaRecorder);

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_000).mockReturnValue(2_500);

    submitShadowingPracticeRecording.mockResolvedValue({
      turnId: "turn-1",
      feedback: {
        evaluationStatus: "done",
        overallScore: 88,
        words: [{ word: "latte", score: 70, status: "weak" }],
      },
    });

    render(
      <ShadowingPracticeRecorder
        sessionId="11111111-1111-4111-8111-111111111111"
        itemId="shadowing-item-0"
        standardText="Could I get a medium latte?"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "开始跟读录音" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "结束录音" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "结束录音" }));

    await waitFor(() => {
      expect(submitShadowingPracticeRecording).toHaveBeenCalled();
    });

    expect(await screen.findByTestId("shadowing-practice-pronunciation-feedback")).toBeInTheDocument();
    expect(screen.getByText(/综合 88/)).toBeInTheDocument();

    nowSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
