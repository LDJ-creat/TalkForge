import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ScenarioHistoricalReport } from "@/domain/scenario-report-history";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";

import { HistoricalReportCard } from "@/components/historical-report-card";

const historicalReport: ScenarioHistoricalReport = {
  sessionId: "session-1",
  sessionStartedAt: "2026-06-05T10:00:00.000Z",
  sessionEndedAt: "2026-06-05T10:15:00.000Z",
  evaluatedAt: "2026-06-06T00:11:00.000Z",
  report: {
    id: "report-1",
    sessionId: "session-1",
    summary: "Nice work practicing coffee ordering.",
    taskCompletion: {
      completedGoalIds: ["choose_drink"],
      missingGoalIds: ["choose_size"],
      score: 70,
    },
    keyCorrections: [],
    alternativeExpressions: [],
    shadowingRecommendations: [{ text: "Could I get a medium latte?" }],
    nextPracticeSuggestion: "Try customizing your drink next time.",
    createdAt: "2026-06-06T00:11:00.000Z",
  },
};

describe("HistoricalReportCard", () => {
  it("shows collapsed summary by default and expands to reveal details", async () => {
    const user = userEvent.setup();

    render(<HistoricalReportCard item={historicalReport} />);

    expect(screen.getByTestId("historical-report-session-1")).toBeInTheDocument();
    expect(screen.getByText(/Nice work practicing coffee ordering/i)).toBeInTheDocument();
    expect(screen.getByText(/Could I get a medium latte/i)).not.toBeVisible();

    await user.click(screen.getByText(/Nice work practicing coffee ordering/i));

    await waitFor(() => {
      expect(screen.getByText(/Could I get a medium latte/i)).toBeVisible();
    });
  });
});
