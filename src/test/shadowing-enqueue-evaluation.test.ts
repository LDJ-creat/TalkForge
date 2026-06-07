import { describe, expect, it, vi } from "vitest";

import { enqueueShadowingEvaluation } from "@/server/shadowing/enqueue-evaluation";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_TURN_ID = "44444444-4444-4444-8444-444444444444";
const AUDIO_SEGMENT_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "99999999-9999-4999-8999-999999999999";

const baseSession = {
  id: SESSION_ID,
  userId: USER_ID,
  scenarioId: "coffee_ordering_a2",
  status: "completed" as const,
  startedAt: "2026-06-06T00:00:00.000Z",
  endedAt: "2026-06-06T00:10:00.000Z",
};

const baseTurn = {
  id: TURN_ID,
  sessionId: SESSION_ID,
  role: "user" as const,
  startedAt: "2026-06-06T00:00:00.000Z",
  endedAt: "2026-06-06T00:00:05.000Z",
  audioSegmentId: AUDIO_SEGMENT_ID,
  evaluationStatus: "none" as const,
};

const baseAudioSegment = {
  id: AUDIO_SEGMENT_ID,
  turnId: TURN_ID,
  objectKey: `audio/${SESSION_ID}/${TURN_ID}.webm`,
  format: "webm" as const,
  durationMs: 5000,
  sizeBytes: 4096,
  createdAt: "2026-06-06T00:00:05.000Z",
};

describe("enqueueShadowingEvaluation", () => {
  it("rejects turns that do not belong to the session", async () => {
    await expect(
      enqueueShadowingEvaluation(
        {
          sessionId: SESSION_ID,
          turnId: TURN_ID,
          audioSegmentId: AUDIO_SEGMENT_ID,
          standardText: "Could I get a medium latte?",
          userId: USER_ID,
        },
        {
          db: {} as never,
          queueAdapter: { enqueue: vi.fn() },
          getSessionById: async () => baseSession,
          getTurnById: async () => ({
            ...baseTurn,
            sessionId: "other-session",
          }),
          getAudioSegmentById: async () => baseAudioSegment,
        },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "turn_not_found",
    });
  });

  it("rejects audio segments that do not belong to the turn", async () => {
    await expect(
      enqueueShadowingEvaluation(
        {
          sessionId: SESSION_ID,
          turnId: TURN_ID,
          audioSegmentId: AUDIO_SEGMENT_ID,
          standardText: "Could I get a medium latte?",
          userId: USER_ID,
        },
        {
          db: {} as never,
          queueAdapter: { enqueue: vi.fn() },
          getSessionById: async () => baseSession,
          getTurnById: async () => baseTurn,
          getAudioSegmentById: async () => ({
            ...baseAudioSegment,
            turnId: OTHER_TURN_ID,
          }),
        },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "audio_segment_not_found",
    });
  });

  it("enqueues a job when session, turn, and audio segment ownership match", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      id: "job-shadowing-1",
      name: "evaluation.shadowing",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      payload: {},
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    });

    const job = await enqueueShadowingEvaluation(
      {
        sessionId: SESSION_ID,
        turnId: TURN_ID,
        audioSegmentId: AUDIO_SEGMENT_ID,
        standardText: "Could I get a medium latte?",
        userId: USER_ID,
      },
      {
        db: {} as never,
        queueAdapter: { enqueue },
        getSessionById: async () => baseSession,
        getTurnById: async () => baseTurn,
        getAudioSegmentById: async () => baseAudioSegment,
      },
    );

    expect(job.id).toBe("job-shadowing-1");
    expect(enqueue).toHaveBeenCalledWith(
      "evaluation.shadowing",
      {
        sessionId: SESSION_ID,
        turnId: TURN_ID,
        audioSegmentId: AUDIO_SEGMENT_ID,
        standardText: "Could I get a medium latte?",
      },
      undefined,
    );
  });
});
