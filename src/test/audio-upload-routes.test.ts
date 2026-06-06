import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as finalizePost } from "@/app/api/sessions/[sessionId]/turns/[turnId]/audio/finalize/route";
import { POST as uploadTargetPost } from "@/app/api/sessions/[sessionId]/turns/[turnId]/audio/upload-target/route";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const OBJECT_KEY = `audio/${SESSION_ID}/${TURN_ID}.webm`;

const createTurnAudioUploadTarget = vi.fn();
const finalizeTurnAudioUpload = vi.fn();

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/server/storage/provider", () => ({
  getStorageProvider: () => ({}),
}));

vi.mock("@/server/queue/provider", () => ({
  getQueueAdapter: () => ({ enqueue: vi.fn() }),
}));

vi.mock("@/server/storage/audio-upload", () => ({
  createTurnAudioUploadTarget: (...args: unknown[]) => createTurnAudioUploadTarget(...args),
  finalizeTurnAudioUpload: (...args: unknown[]) => finalizeTurnAudioUpload(...args),
}));

describe("audio upload API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when upload-target is called without a user header", async () => {
    const response = await uploadTargetPost(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ sizeBytes: 128 }),
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID, turnId: TURN_ID }) },
    );

    expect(response.status).toBe(401);
  });

  it("creates an upload target for an authorized request", async () => {
    createTurnAudioUploadTarget.mockResolvedValue({
      turnId: TURN_ID,
      objectKey: OBJECT_KEY,
      uploadTarget: {
        objectKey: OBJECT_KEY,
        uploadUrl: "http://localhost:3000/api/internal/storage/upload?token=test",
        method: "PUT",
        expiresAt: "2026-06-06T01:00:00.000Z",
      },
    });

    const response = await uploadTargetPost(
      new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
        body: JSON.stringify({ sizeBytes: 128 }),
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID, turnId: TURN_ID }) },
    );

    expect(response.status).toBe(200);
    expect(createTurnAudioUploadTarget).toHaveBeenCalledWith(
      {},
      {},
      expect.objectContaining({
        sessionId: SESSION_ID,
        turnId: TURN_ID,
        userId: USER_ID,
      }),
    );
  });

  it("returns 400 for invalid finalize payloads and malformed JSON", async () => {
    const invalidResponse = await finalizePost(
      new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
        body: JSON.stringify({ durationMs: 0, sizeBytes: 10 }),
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID, turnId: TURN_ID }) },
    );

    expect(invalidResponse.status).toBe(400);

    const malformedResponse = await finalizePost(
      new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
        body: "{",
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID, turnId: TURN_ID }) },
    );

    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toMatchObject({
      error: { code: "invalid_json" },
    });
  });
});
