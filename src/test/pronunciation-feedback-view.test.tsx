import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PronunciationFeedbackView } from "@/components/pronunciation-feedback-view";

describe("PronunciationFeedbackView", () => {
  it("uses unique keys when duplicate silence markers appear", () => {
    render(
      <PronunciationFeedbackView
        idPrefix="turn-1"
        feedback={{
          evaluationStatus: "done",
          overallScore: 55,
          words: [
            { word: "i", score: 43, status: "weak" },
            { word: "sil", score: undefined, status: "ok" },
            { word: "an", score: 46, status: "weak" },
            { word: "sil", score: undefined, status: "ok" },
            { word: "one", score: 99, status: "ok" },
          ],
        }}
      />,
    );

    expect(screen.queryByText("sil")).not.toBeInTheDocument();
    expect(screen.getByText("i")).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText(/综合 55/)).toBeInTheDocument();
  });
});
