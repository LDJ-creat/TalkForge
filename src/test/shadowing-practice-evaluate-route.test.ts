import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/sessions/[sessionId]/shadowing/[itemId]/evaluate/route";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";
import { submitShadowingPracticeEvaluation } from "@/server/shadowing/submit-practice-evaluation";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "shadowing-item-0";
const USER_ID = "99999999-9999-4999-8999-999999999999";

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/server/pronunciation/provider", () => ({
  getPronunciationProvider: () => ({ name: "mock-pronunciation" }),
}));

vi.mock("@/server/shadowing/submit-practice-evaluation", () => ({
  submitShadowingPracticeEvaluation: vi.fn(),
}));

const submitShadowingPracticeEvaluationMock = vi.mocked(
  submitShadowingPracticeEvaluation,
);

function buildFormRequest(durationMs: string, includeAudio = true) {
  const formData = new FormData();
  if (includeAudio) {
    formData.append("audio", new File(["audio-bytes"], "practice.webm", { type: "audio/webm" }));
  }
  formData.append("durationMs", durationMs);

  return new Request(
    `http://localhost/api/sessions/${SESSION_ID}/shadowing/${ITEM_ID}/evaluate`,
    {
      method: "POST",
      headers: {
        [REQUEST_USER_ID_HEADER]: USER_ID,
      },
      body: formData,
    },
  );
}

describe("POST /api/sessions/[sessionId]/shadowing/[itemId]/evaluate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pronunciation feedback for a valid practice upload", async () => {
    submitShadowingPracticeEvaluationMock.mockResolvedValue({
      turnId: "turn-1",
      feedback: {
        evaluationStatus: "done",
        overallScore: 86,
        accuracyScore: 84,
        completenessScore: 88,
        words: [{ word: "latte", score: 72, status: "weak" }],
      },
    });

    const response = await POST(buildFormRequest("1500"), {
      params: Promise.resolve({ sessionId: SESSION_ID, itemId: ITEM_ID }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      turnId: string;
      feedback: { overallScore?: number };
    };
    expect(body.turnId).toBe("turn-1");
    expect(body.feedback.overallScore).toBe(86);
    expect(submitShadowingPracticeEvaluationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        itemId: ITEM_ID,
        userId: USER_ID,
        durationMs: 1500,
      }),
      expect.any(Object),
    );
  });

  it("returns 400 when audio is missing", async () => {
    const response = await POST(buildFormRequest("1500", false), {
      params: Promise.resolve({ sessionId: SESSION_ID, itemId: ITEM_ID }),
    });

    expect(response.status).toBe(400);
    expect(submitShadowingPracticeEvaluationMock).not.toHaveBeenCalled();
  });
});
