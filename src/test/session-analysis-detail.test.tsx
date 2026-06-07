import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";

import { SessionAnalysisDetail } from "@/components/session-analysis-detail";

const fetchSessionAnalysisFromServer = vi.fn();

vi.mock("@/features/conversation/fetch-session-analysis-api", () => ({
  fetchSessionAnalysisFromServer: (...args: unknown[]) => fetchSessionAnalysisFromServer(...args),
}));

describe("SessionAnalysisDetail", () => {
  beforeEach(() => {
    fetchSessionAnalysisFromServer.mockReset();
  });

  it("renders full analysis sections when data loads", async () => {
    fetchSessionAnalysisFromServer.mockResolvedValue({
      session: {
        id: "session-1",
        scenarioId: coffeeOrderingScenario.id,
        status: "completed",
        startedAt: "2026-06-07T10:00:00.000Z",
        endedAt: "2026-06-07T10:10:00.000Z",
      },
      report: {
        id: "report-1",
        sessionId: "session-1",
        summary: "You completed the coffee order goals.",
        taskCompletion: {
          completedGoalIds: ["choose_drink"],
          missingGoalIds: [],
          score: 100,
        },
        keyCorrections: [],
        alternativeExpressions: [],
        shadowingRecommendations: [{ text: "Could I get a medium latte?" }],
        nextPracticeSuggestion: "Practice payment phrases.",
        createdAt: "2026-06-07T10:11:00.000Z",
      },
      turns: [
        {
          id: "turn-user",
          sessionId: "session-1",
          role: "user",
          startedAt: "2026-06-07T10:01:00.000Z",
          endedAt: "2026-06-07T10:01:05.000Z",
          transcriptText: "Could I get a latte?",
          evaluationStatus: "done",
          pronunciationFeedback: {
            evaluationStatus: "done",
            overallScore: 82,
            accuracyScore: 80,
            fluencyScore: 84,
            words: [{ word: "latte", score: 45, status: "weak" }],
          },
          corrections: [
            {
              id: "corr-1",
              turnId: "turn-user",
              type: "expression",
              originalText: "Could I get a latte?",
              correctedText: "Could I get a latte, please?",
              explanation: "Adding please sounds more natural.",
              confidence: 0.9,
            },
          ],
        },
      ],
      shadowingItems: [
        {
          id: "shadow-1",
          sessionId: "session-1",
          standardText: "Could I get a medium latte?",
          standardAudioStatus: "ready",
        },
      ],
    });

    render(<SessionAnalysisDetail scenario={coffeeOrderingScenario} sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("session-analysis-detail")).toBeInTheDocument();
    });

    expect(screen.getByText(/You completed the coffee order goals/i)).toBeInTheDocument();
    expect(screen.getByText(/Could I get a latte, please/i)).toBeInTheDocument();
    expect(screen.getByTestId("turn-pronunciation-detail")).toHaveTextContent(/Overall 82/i);
    expect(screen.getByTestId("shadowing-practice-panel")).toBeInTheDocument();
  });
});
