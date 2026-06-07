import { describe, expect, it, vi } from "vitest";

import type { Report } from "@/domain/report";
import type { Session } from "@/domain/session";
import { fetchSessionAnalysisForUser } from "@/server/session/fetch-session-analysis";

const USER_ID = "99999999-9999-4999-8999-999999999999";
const SESSION_ID = "session-1";

const session: Session = {
  id: SESSION_ID,
  userId: USER_ID,
  scenarioId: "coffee_ordering_a2",
  realtimeProvider: "mock-realtime",
  status: "completed",
  startedAt: "2026-06-07T10:00:00.000Z",
  endedAt: "2026-06-07T10:10:00.000Z",
};

const report: Report = {
  id: "report-1",
  sessionId: SESSION_ID,
  summary: "Good session.",
  taskCompletion: {
    completedGoalIds: ["choose_drink"],
    missingGoalIds: [],
    score: 100,
  },
  keyCorrections: [],
  alternativeExpressions: [],
  shadowingRecommendations: [],
  nextPracticeSuggestion: "Keep practicing.",
  createdAt: "2026-06-07T10:11:00.000Z",
};

describe("fetchSessionAnalysisForUser", () => {
  it("returns report, turns with corrections, and shadowing items", async () => {
    const analysis = await fetchSessionAnalysisForUser(SESSION_ID, USER_ID, {
      getSessionById: async () => session,
      getReportBySessionId: async () => report,
      listTurnsBySessionId: async () => [
        {
          id: "turn-user",
          sessionId: SESSION_ID,
          role: "user",
          startedAt: "2026-06-07T10:01:00.000Z",
          endedAt: "2026-06-07T10:01:05.000Z",
          transcriptText: "Could I get a latte?",
          evaluationStatus: "done",
        },
      ],
      getFreeSpeechEvaluationsByTurnIds: async () => new Map(),
      getCorrectionsByTurnIds: async () =>
        new Map([
          [
            "turn-user",
            [
              {
                id: "corr-1",
                turnId: "turn-user",
                type: "grammar",
                originalText: "Could I get a latte",
                correctedText: "Could I get a latte, please?",
                explanation: "Add please for politeness.",
                confidence: 0.9,
              },
            ],
          ],
        ]),
      listShadowingItemsBySessionId: async () => [
        {
          id: "shadow-1",
          sessionId: SESSION_ID,
          standardText: "Could I get a medium latte?",
          standardAudioStatus: "ready",
        },
      ],
    });

    expect(analysis.report.summary).toBe("Good session.");
    expect(analysis.turns).toHaveLength(1);
    expect(analysis.turns[0]?.corrections).toHaveLength(1);
    expect(analysis.shadowingItems).toHaveLength(1);
  });

  it("rejects access for another user", async () => {
    await expect(
      fetchSessionAnalysisForUser(SESSION_ID, "other-user", {
        getSessionById: async () => session,
        getReportBySessionId: vi.fn(),
        listTurnsBySessionId: vi.fn(),
        getFreeSpeechEvaluationsByTurnIds: vi.fn(),
        getCorrectionsByTurnIds: vi.fn(),
        listShadowingItemsBySessionId: vi.fn(),
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
