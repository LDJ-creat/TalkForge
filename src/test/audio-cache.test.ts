import { describe, expect, it } from "vitest";

import { createMemoryTurnAudioCacheAdapter } from "@/lib/audio-cache/memory-adapter";
import { retryPendingTurnAudioUploads } from "@/lib/audio-cache/handoff";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const DURATION_MS = 1_500;

type MockFetchHandler = {
  match: RegExp;
  response: {
    ok?: boolean;
    status?: number;
    json?: () => Promise<unknown>;
  };
};

describe("memory turn audio cache", () => {
  it("stores pending turn audio blobs by turn id", async () => {
    const adapter = createMemoryTurnAudioCacheAdapter();
    await adapter.save({
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      blob: new Blob(["audio"], { type: "audio/webm" }),
      durationMs: DURATION_MS,
    });

    const entry = await adapter.get(TURN_ID);
    expect(entry?.uploadStatus).toBe("pending");
    expect(entry?.durationMs).toBe(DURATION_MS);
    expect(await adapter.listPending()).toHaveLength(1);
  });

  it("retries pending uploads through the handoff helper", async () => {
    const adapter = createMemoryTurnAudioCacheAdapter();
    const blob = new Blob(["audio"], { type: "audio/webm" });
    await adapter.save({
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      blob,
      durationMs: DURATION_MS,
    });

    const uploadTargetBodies: unknown[] = [];
    const finalizeBodies: unknown[] = [];

    const fetchImpl = viFetch([
      {
        match: /upload-target$/,
        response: {
          ok: true,
          json: async () => ({
            objectKey: `audio/${SESSION_ID}/${TURN_ID}.webm`,
            uploadTarget: {
              uploadUrl: "http://localhost/upload",
              method: "PUT",
              headers: { "Content-Type": "audio/webm" },
            },
          }),
        },
        captureBody: uploadTargetBodies,
      },
      { match: /upload$/, response: { ok: true } },
      {
        match: /finalize$/,
        response: { ok: true },
        captureBody: finalizeBodies,
      },
    ]);

    const results = await retryPendingTurnAudioUploads({
      userId: USER_ID,
      adapter,
      fetchImpl,
      appBaseUrl: "http://localhost",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.objectKey).toBe(`audio/${SESSION_ID}/${TURN_ID}.webm`);
    expect((await adapter.get(TURN_ID))?.uploadStatus).toBe("uploaded");
    expect(uploadTargetBodies[0]).toEqual({ sizeBytes: blob.size });
    expect(finalizeBodies[0]).toEqual({
      objectKey: `audio/${SESSION_ID}/${TURN_ID}.webm`,
      durationMs: DURATION_MS,
      sizeBytes: blob.size,
    });
  });
});

function viFetch(
  handlers: Array<
    MockFetchHandler & {
      captureBody?: unknown[];
    }
  >,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const handler = handlers.find((item) => item.match.test(url));
    if (!handler) {
      throw new Error(`Unexpected fetch URL: ${url}`);
    }

    if (handler.captureBody && init?.body) {
      handler.captureBody.push(JSON.parse(String(init.body)));
    }

    return {
      ok: handler.response.ok ?? true,
      status: handler.response.status ?? 200,
      json: handler.response.json ?? (async () => ({})),
    } as Response;
  }) as typeof fetch;
}
