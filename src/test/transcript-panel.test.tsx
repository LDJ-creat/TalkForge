import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TranscriptPanel } from "@/components/transcript-panel";

describe("TranscriptPanel", () => {
  it("renders pronunciation scores and weak words for user turns", () => {
    render(
      <TranscriptPanel
        entries={[
          {
            id: "turn-user",
            role: "user",
            text: "Could I get a medium latte?",
            status: "final",
            timestamp: "2026-06-06T00:00:00.000Z",
            pronunciationFeedback: {
              evaluationStatus: "done",
              overallScore: 82,
              accuracyScore: 79,
              fluencyScore: 85,
              words: [
                { word: "latte", score: 45, status: "weak" },
                { word: "medium", score: 88, status: "ok" },
              ],
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId("transcript-pronunciation-feedback")).toBeInTheDocument();
    expect(screen.getByText(/综合 82/)).toBeInTheDocument();
    expect(screen.getByText("latte")).toHaveClass("transcript-entry__word--weak");
    expect(screen.getByText("medium")).toHaveClass("transcript-entry__word");
    expect(screen.getByText(/识别出的文本/)).toBeInTheDocument();
  });

  it("shows failed pronunciation evaluation state", () => {
    render(
      <TranscriptPanel
        entries={[
          {
            id: "turn-user",
            role: "user",
            text: "Hi",
            status: "final",
            timestamp: "2026-06-06T00:00:00.000Z",
            pronunciationFeedback: {
              evaluationStatus: "failed",
            },
          },
        ]}
      />,
    );

    expect(screen.getByText(/发音评估暂不可用/)).toBeInTheDocument();
  });
});
