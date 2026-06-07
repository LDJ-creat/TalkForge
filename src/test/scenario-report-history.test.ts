import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Report } from "@/domain/report";
import type { ScenarioHistoricalReport } from "@/domain/scenario-report-history";
import type { Scenario } from "@/domain/scenario";
import { GET as getScenarioReportsRoute } from "@/app/api/scenarios/[scenarioId]/reports/route";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import {
  listScenarioReportsForUser,
  REPORT_GENERATING_MARKER,
} from "@/server/report";

const getScenarioById = vi.fn();
const listCompletedReportsByScenarioForUser = vi.fn();

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/server/db/repositories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db/repositories")>();
  return {
    ...actual,
    getScenarioById: (...args: Parameters<typeof getScenarioById>) => getScenarioById(...args),
    listCompletedReportsByScenarioForUser: (
      ...args: Parameters<typeof listCompletedReportsByScenarioForUser>
    ) => listCompletedReportsByScenarioForUser(...args),
  };
});

const USER_ID = "11111111-1111-1111-1111-111111111111";
const SCENARIO_ID = coffeeOrderingScenario.id;

function buildReport(sessionId: string, createdAt: string, summary: string): Report {
  return {
    id: `report-${sessionId}`,
    sessionId,
    summary,
    taskCompletion: {
      completedGoalIds: ["choose_drink"],
      missingGoalIds: ["choose_size"],
      score: 70,
    },
    keyCorrections: [],
    alternativeExpressions: [],
    shadowingRecommendations: [],
    nextPracticeSuggestion: "Keep practicing.",
    createdAt,
  };
}

function buildHistoricalReport(
  sessionId: string,
  createdAt: string,
  summary: string,
): ScenarioHistoricalReport {
  return {
    sessionId,
    sessionStartedAt: "2026-06-05T10:00:00.000Z",
    sessionEndedAt: "2026-06-05T10:15:00.000Z",
    evaluatedAt: createdAt,
    report: buildReport(sessionId, createdAt, summary),
  };
}

describe("listScenarioReportsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns reports sorted by evaluation time from the repository", async () => {
    getScenarioById.mockResolvedValue(coffeeOrderingScenario as Scenario);
    listCompletedReportsByScenarioForUser.mockResolvedValue([
      buildHistoricalReport("session-2", "2026-06-06T00:11:00.000Z", "Latest report."),
      buildHistoricalReport("session-1", "2026-06-05T00:11:00.000Z", "Earlier report."),
    ]);

    const result = await listScenarioReportsForUser(SCENARIO_ID, USER_ID, {
      getScenarioById,
      listCompletedReportsByScenarioForUser,
    });

    expect(listCompletedReportsByScenarioForUser).toHaveBeenCalledWith(USER_ID, SCENARIO_ID);
    expect(result.reports).toHaveLength(2);
    expect(result.reports[0]?.evaluatedAt).toBe("2026-06-06T00:11:00.000Z");
    expect(result.reports[1]?.evaluatedAt).toBe("2026-06-05T00:11:00.000Z");
  });

  it("throws when the scenario does not exist", async () => {
    getScenarioById.mockResolvedValue(null);

    await expect(
      listScenarioReportsForUser(SCENARIO_ID, USER_ID, {
        getScenarioById,
        listCompletedReportsByScenarioForUser,
      }),
    ).rejects.toMatchObject({
      code: "scenario_not_found",
    });
  });
});

describe("scenario reports API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the request user header is missing", async () => {
    const response = await getScenarioReportsRoute(
      new Request(`http://localhost/api/scenarios/${SCENARIO_ID}/reports`),
      { params: Promise.resolve({ scenarioId: SCENARIO_ID }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns historical reports for an authorized user", async () => {
    getScenarioById.mockResolvedValue(coffeeOrderingScenario as Scenario);
    listCompletedReportsByScenarioForUser.mockResolvedValue([
      buildHistoricalReport("session-1", "2026-06-06T00:11:00.000Z", "Great practice session."),
    ]);

    const response = await getScenarioReportsRoute(
      new Request(`http://localhost/api/scenarios/${SCENARIO_ID}/reports`, {
        headers: {
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
      }),
      { params: Promise.resolve({ scenarioId: SCENARIO_ID }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]?.report.summary).toBe("Great practice session.");
  });

  it("returns 404 when the scenario does not exist", async () => {
    getScenarioById.mockResolvedValue(null);

    const response = await getScenarioReportsRoute(
      new Request(`http://localhost/api/scenarios/${SCENARIO_ID}/reports`, {
        headers: {
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
      }),
      { params: Promise.resolve({ scenarioId: SCENARIO_ID }) },
    );

    expect(response.status).toBe(404);
  });
});

describe("report repository generating marker", () => {
  it("documents the generating marker used to filter incomplete reports", () => {
    expect(REPORT_GENERATING_MARKER).toBe("__talkforge_report_generating__");
  });
});
