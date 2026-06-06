import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionReportPanel } from "@/components/session-report-panel";

describe("SessionReportPanel", () => {
  it("renders report sections including shadowing recommendations", () => {
    render(
      <SessionReportPanel
        status="ready"
        report={{
          id: "report-1",
          sessionId: "session-1",
          summary: "Nice work practicing coffee ordering.",
          taskCompletion: {
            completedGoalIds: ["choose_drink"],
            missingGoalIds: ["choose_size"],
          },
          keyCorrections: [],
          alternativeExpressions: [],
          shadowingRecommendations: [{ text: "Could I get a medium latte?" }],
          nextPracticeSuggestion: "Try customizing your drink next time.",
          createdAt: "2026-06-06T00:11:00.000Z",
        }}
      />,
    );

    expect(screen.getByTestId("session-report-panel")).toBeInTheDocument();
    expect(screen.getByText(/Nice work practicing coffee ordering/i)).toBeInTheDocument();
    expect(screen.getByText(/Could I get a medium latte/i)).toBeInTheDocument();
  });
});
