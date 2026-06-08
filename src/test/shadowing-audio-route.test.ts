import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/sessions/[sessionId]/shadowing/[itemId]/audio/route";

const getSessionById = vi.fn();
const getShadowingItemById = vi.fn();
const loadAudioObjectForAsr = vi.fn();

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/server/db/repositories", () => ({
  getSessionById: (...args: unknown[]) => getSessionById(...args),
  getShadowingItemById: (...args: unknown[]) => getShadowingItemById(...args),
}));

vi.mock("@/server/asr/audio-loader", () => ({
  loadAudioObjectForAsr: (...args: unknown[]) => loadAudioObjectForAsr(...args),
}));

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "99999999-9999-4999-8999-999999999999";
const ITEM_ID = "shadowing-item-0";

function createRequest() {
  return new Request(
    `http://localhost/api/sessions/${SESSION_ID}/shadowing/${ITEM_ID}/audio`,
    {
      headers: {
        "x-talkforge-user-id": USER_ID,
      },
    },
  );
}

describe("GET /api/sessions/[sessionId]/shadowing/[itemId]/audio", () => {
  it("returns standard audio bytes for an authorized session owner", async () => {
    getSessionById.mockResolvedValue({
      id: SESSION_ID,
      userId: USER_ID,
      scenarioId: "coffee_ordering_a2",
      status: "completed",
    });
    getShadowingItemById.mockResolvedValue({
      id: ITEM_ID,
      sessionId: SESSION_ID,
      standardText: "Could I get a medium latte?",
      source: "report_recommendation",
      standardAudioStatus: "ready",
      standardAudio: {
        provider: "cosyvoice",
        objectKey: "tts/abc123.wav",
        format: "wav",
        sizeBytes: 4096,
        voice: "longxiaochun_v3",
        speed: 1,
        language: "en",
        cacheKey: "cache-key",
      },
    });
    loadAudioObjectForAsr.mockResolvedValue({
      objectKey: "tts/abc123.wav",
      body: Buffer.from("RIFFtest"),
      contentType: "audio/wav",
    });

    const response = await GET(createRequest(), {
      params: Promise.resolve({ sessionId: SESSION_ID, itemId: ITEM_ID }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/wav");
    expect(await response.text()).toBe("RIFFtest");
  });

  it("returns 404 when standard audio is not ready", async () => {
    getSessionById.mockResolvedValue({
      id: SESSION_ID,
      userId: USER_ID,
    });
    getShadowingItemById.mockResolvedValue({
      id: ITEM_ID,
      sessionId: SESSION_ID,
      standardAudioStatus: "pending",
    });

    const response = await GET(createRequest(), {
      params: Promise.resolve({ sessionId: SESSION_ID, itemId: ITEM_ID }),
    });

    expect(response.status).toBe(404);
  });
});
