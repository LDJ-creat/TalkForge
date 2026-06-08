import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { useConversationStore } from "@/features/conversation";

import { ScenarioEntryPanel } from "@/components/scenario-entry-panel";

const fetchScenarioReportsFromServer = vi.fn();

vi.mock("@/features/conversation/fetch-scenario-reports-api", () => ({
  fetchScenarioReportsFromServer: (...args: unknown[]) => fetchScenarioReportsFromServer(...args),
  formatReportEvaluatedAt: (value: string) => value,
  formatHistoricalReportHeadline: (item: { report?: { summary?: string } }) =>
    item.report?.summary ?? "报告生成失败",
  formatHistoricalReportMeta: () => "1/2 goals completed",
  formatTaskCompletionSummary: () => "1/2 goals completed",
}));

describe("ScenarioEntryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConversationStore.getState().reset();
  });

  it("loads historical reports and calls onStartPractice when the button is clicked", async () => {
    fetchScenarioReportsFromServer.mockResolvedValue([
      {
        sessionId: "session-1",
        sessionStartedAt: "2026-06-05T10:00:00.000Z",
        sessionEndedAt: "2026-06-05T10:15:00.000Z",
        evaluatedAt: "2026-06-06T00:11:00.000Z",
        status: "ready",
        report: {
          id: "report-1",
          sessionId: "session-1",
          summary: "Earlier practice summary.",
          taskCompletion: {
            completedGoalIds: ["choose_drink"],
            missingGoalIds: ["choose_size"],
          },
          keyCorrections: [],
          alternativeExpressions: [],
          shadowingRecommendations: [],
          nextPracticeSuggestion: "Keep practicing.",
          createdAt: "2026-06-06T00:11:00.000Z",
        },
      },
    ]);

    const onStartPractice = vi.fn();

    render(
      <ScenarioEntryPanel scenario={coffeeOrderingScenario} onStartPractice={onStartPractice} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("scenario-history-list")).toBeInTheDocument();
    });

    expect(screen.getByText(/Earlier practice summary/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("start-practice-button"));
    expect(onStartPractice).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when there are no historical reports", async () => {
    fetchScenarioReportsFromServer.mockResolvedValue([]);
    const onStartPractice = vi.fn();

    render(
      <ScenarioEntryPanel scenario={coffeeOrderingScenario} onStartPractice={onStartPractice} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("scenario-history-empty")).toBeInTheDocument();
    });
  });
});
