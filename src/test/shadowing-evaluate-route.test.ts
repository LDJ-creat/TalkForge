import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as evaluateShadowingPost } from "@/app/api/sessions/[sessionId]/shadowing/evaluate/route";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";
import { enqueueShadowingEvaluation } from "@/server/shadowing/enqueue-evaluation";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const AUDIO_SEGMENT_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "99999999-9999-4999-8999-999999999999";

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/server/queue/provider", () => ({
  getQueueAdapter: () => ({ enqueue: vi.fn() }),
}));

vi.mock("@/server/queue/dev-worker", () => ({
  processEnqueuedJobsSafely: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/shadowing/enqueue-evaluation", () => ({
  enqueueShadowingEvaluation: vi.fn(),
}));

const enqueueShadowingEvaluationMock = vi.mocked(enqueueShadowingEvaluation);

describe("POST /api/sessions/:sessionId/shadowing/evaluate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when called without a user header", async () => {
    const response = await evaluateShadowingPost(
      new Request("http://localhost/api/sessions/test/shadowing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnId: TURN_ID,
          audioSegmentId: AUDIO_SEGMENT_ID,
          standardText: "Could I get a medium latte?",
        }),
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(401);
    expect(enqueueShadowingEvaluationMock).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await evaluateShadowingPost(
      new Request("http://localhost/api/sessions/test/shadowing/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
        body: JSON.stringify({
          turnId: TURN_ID,
          audioSegmentId: AUDIO_SEGMENT_ID,
          standardText: "   ",
        }),
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_request");
    expect(enqueueShadowingEvaluationMock).not.toHaveBeenCalled();
  });

  it("enqueues a shadowing evaluation job for authorized requests", async () => {
    enqueueShadowingEvaluationMock.mockResolvedValue({
      id: "job-shadowing-1",
      name: "evaluation.shadowing",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      payload: {
        sessionId: SESSION_ID,
        turnId: TURN_ID,
        audioSegmentId: AUDIO_SEGMENT_ID,
        standardText: "Could I get a medium latte?",
      },
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    });

    const response = await evaluateShadowingPost(
      new Request("http://localhost/api/sessions/test/shadowing/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
        body: JSON.stringify({
          turnId: TURN_ID,
          audioSegmentId: AUDIO_SEGMENT_ID,
          standardText: "Could I get a medium latte?",
        }),
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(200);
    expect(enqueueShadowingEvaluationMock).toHaveBeenCalledWith(
      {
        sessionId: SESSION_ID,
        turnId: TURN_ID,
        audioSegmentId: AUDIO_SEGMENT_ID,
        standardText: "Could I get a medium latte?",
        userId: USER_ID,
      },
      expect.objectContaining({
        getSessionById: expect.any(Function),
        getTurnById: expect.any(Function),
        getAudioSegmentById: expect.any(Function),
      }),
    );

    const body = (await response.json()) as { job: { id: string } };
    expect(body.job.id).toBe("job-shadowing-1");
  });

  it("returns service errors from the enqueue layer", async () => {
    const { ShadowingServiceError } = await import("@/server/shadowing/errors");
    enqueueShadowingEvaluationMock.mockRejectedValue(
      new ShadowingServiceError(
        404,
        "turn_not_found",
        `Turn ${TURN_ID} was not found for session ${SESSION_ID}.`,
      ),
    );

    const response = await evaluateShadowingPost(
      new Request("http://localhost/api/sessions/test/shadowing/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
        body: JSON.stringify({
          turnId: TURN_ID,
          audioSegmentId: AUDIO_SEGMENT_ID,
          standardText: "Could I get a medium latte?",
        }),
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("turn_not_found");
  });
});
