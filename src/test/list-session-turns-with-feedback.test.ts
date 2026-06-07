import { describe, expect, it } from "vitest";

import { listSessionTurnsWithFeedbackForUser } from "@/server/session/list-session-turns-with-feedback";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "99999999-9999-4999-8999-999999999999";
const TURN_ID = "22222222-2222-4222-8222-222222222222";

describe("listSessionTurnsWithFeedbackForUser", () => {
  it("returns pronunciation feedback for user turns", async () => {
    const turns = await listSessionTurnsWithFeedbackForUser(SESSION_ID, USER_ID, {
      getSessionById: async () => ({
        id: SESSION_ID,
        userId: USER_ID,
        scenarioId: "coffee_ordering_a2",
        realtimeProvider: "qwen-omni",
        status: "active",
        startedAt: "2026-06-06T00:00:00.000Z",
      }),
      listTurnsBySessionId: async () => [
        {
          id: TURN_ID,
          sessionId: SESSION_ID,
          role: "user",
          startedAt: "2026-06-06T00:00:00.000Z",
          endedAt: "2026-06-06T00:00:05.000Z",
          transcriptText: "Could I get a medium latte?",
          evaluationStatus: "done",
        },
      ],
      getFreeSpeechEvaluationsByTurnIds: async () =>
        new Map([
          [
            TURN_ID,
            {
              id: "eval-1",
              turnId: TURN_ID,
              mode: "free_speech",
              overallScore: 82,
              accuracyScore: 79,
              fluencyScore: 85,
              details: {
                words: [{ word: "latte", score: 45 }],
              },
            },
          ],
        ]),
    });

    expect(turns[0]?.pronunciationFeedback).toMatchObject({
      evaluationStatus: "done",
      overallScore: 82,
      words: [{ word: "latte", score: 45, status: "weak" }],
    });
  });
});
