import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShadowingPracticePanel } from "@/components/shadowing-practice-panel";

describe("ShadowingPracticePanel", () => {
  it("renders shadowing items with original text and audio status", () => {
    render(
      <ShadowingPracticePanel
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
    expect(screen.getByText(/Your phrase: I want coffee/)).toBeInTheDocument();
    expect(screen.getByText(/Standard audio ready/)).toBeInTheDocument();
  });
});
