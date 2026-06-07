import { S3Client } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTurnAudioUploadTarget,
  finalizeTurnAudioUpload,
} from "@/server/storage/audio-upload";
import { MockStorageProvider } from "@/providers/mock/storage";
import { createS3CompatibleStorageProvider } from "@/server/storage/s3-compatible-storage";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const OBJECT_KEY = `audio/${SESSION_ID}/${TURN_ID}.webm`;

const getSessionById = vi.fn();
const getScenarioById = vi.fn();
const listTurnsBySessionId = vi.fn();
const getTurnById = vi.fn();
const createAudioSegment = vi.fn();
const linkTurnAudioSegment = vi.fn();

vi.mock("@/server/db/repositories/scenario-session-repository", () => ({
  getSessionById: (...args: unknown[]) => getSessionById(...args),
  getScenarioById: (...args: unknown[]) => getScenarioById(...args),
}));

vi.mock("@/server/db/repositories/turn-repository", () => ({
  getTurnById: (...args: unknown[]) => getTurnById(...args),
  linkTurnAudioSegment: (...args: unknown[]) => linkTurnAudioSegment(...args),
  listTurnsBySessionId: (...args: unknown[]) => listTurnsBySessionId(...args),
}));

const getAudioSegmentByTurnId = vi.fn();
const enqueueTurnPostAudioJobs = vi.fn();

vi.mock("@/server/db/repositories/audio-segment-repository", () => ({
  createAudioSegment: (...args: unknown[]) => createAudioSegment(...args),
  getAudioSegmentByTurnId: (...args: unknown[]) => getAudioSegmentByTurnId(...args),
}));

vi.mock("@/server/turn-post-audio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/turn-post-audio")>();
  return {
    ...actual,
    enqueueTurnPostAudioJobs: (...args: unknown[]) => enqueueTurnPostAudioJobs(...args),
  };
});

describe("audio upload service", () => {
  const db = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };
  let storage: MockStorageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new MockStorageProvider();
    getSessionById.mockResolvedValue({
      id: SESSION_ID,
      userId: USER_ID,
      scenarioId: coffeeOrderingScenario.id,
      startedAt: new Date().toISOString(),
    });
    getScenarioById.mockResolvedValue(coffeeOrderingScenario);
    listTurnsBySessionId.mockResolvedValue([]);
    getTurnById.mockResolvedValue({
      id: TURN_ID,
      sessionId: SESSION_ID,
    });
    getAudioSegmentByTurnId.mockResolvedValue(null);
  });

  it("creates upload targets for authorized turns", async () => {
    const result = await createTurnAudioUploadTarget(db as never, storage, {
      sessionId: SESSION_ID,
      turnId: TURN_ID,
      userId: USER_ID,
      sizeBytes: 128,
    });

    expect(result.objectKey).toBe(OBJECT_KEY);
    expect(result.uploadTarget.method).toBe("PUT");
    expect(await storage.objectExists({ objectKey: OBJECT_KEY })).toBe(false);
  });

  it("finalizes uploaded audio metadata in a transaction", async () => {
    const uploadTarget = await storage.createUploadTarget({
      objectKey: OBJECT_KEY,
      contentType: "audio/webm",
      sizeBytes: 5,
    });
    await storage.writeUploadedObject({
      objectKey: uploadTarget.objectKey,
      body: Buffer.from("audio"),
      contentType: "audio/webm",
    });

    createAudioSegment.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      turnId: TURN_ID,
      objectKey: OBJECT_KEY,
      format: "webm",
      codec: "opus",
      durationMs: 1200,
      sizeBytes: 5,
      createdAt: "2026-06-06T00:00:00.000Z",
    });
    linkTurnAudioSegment.mockResolvedValue({ id: TURN_ID, audioSegmentId: "44444444-4444-4444-8444-444444444444" });

    const result = await finalizeTurnAudioUpload(db as never, storage, {
      sessionId: SESSION_ID,
      turnId: TURN_ID,
      userId: USER_ID,
      objectKey: OBJECT_KEY,
      durationMs: 1200,
      sizeBytes: 5,
    });

    expect(createAudioSegment).toHaveBeenCalled();
    expect(linkTurnAudioSegment).toHaveBeenCalledWith(db, TURN_ID, "44444444-4444-4444-8444-444444444444");
    expect(result.audioSegment.objectKey).toBe(OBJECT_KEY);
    expect(result.postAudioJobsEnqueued).toBe(false);
  });

  it("enqueues post-audio jobs when a queue adapter is provided", async () => {
    const uploadTarget = await storage.createUploadTarget({
      objectKey: OBJECT_KEY,
      contentType: "audio/webm",
      sizeBytes: 5,
    });
    await storage.writeUploadedObject({
      objectKey: uploadTarget.objectKey,
      body: Buffer.from("audio"),
      contentType: "audio/webm",
    });

    createAudioSegment.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      turnId: TURN_ID,
      objectKey: OBJECT_KEY,
      format: "webm",
      codec: "opus",
      durationMs: 1200,
      sizeBytes: 5,
      createdAt: "2026-06-06T00:00:00.000Z",
    });
    linkTurnAudioSegment.mockResolvedValue({ id: TURN_ID, audioSegmentId: "44444444-4444-4444-8444-444444444444" });
    enqueueTurnPostAudioJobs.mockResolvedValue(true);

    const queueAdapter = { enqueue: vi.fn() };
    const result = await finalizeTurnAudioUpload(
      db as never,
      storage,
      {
        sessionId: SESSION_ID,
        turnId: TURN_ID,
        userId: USER_ID,
        objectKey: OBJECT_KEY,
        durationMs: 1200,
        sizeBytes: 5,
      },
      { queueAdapter: queueAdapter as never },
    );

    expect(enqueueTurnPostAudioJobs).toHaveBeenCalledWith(
      {
        turnId: TURN_ID,
        sessionId: SESSION_ID,
        audioSegmentId: "44444444-4444-4444-8444-444444444444",
      },
      expect.objectContaining({
        queueAdapter,
        getTurnById: expect.any(Function),
      }),
    );
    expect(result.postAudioJobsEnqueued).toBe(true);
  });

  it("returns existing audio segment metadata idempotently", async () => {
    await storage.createUploadTarget({
      objectKey: OBJECT_KEY,
      contentType: "audio/webm",
      sizeBytes: 5,
    });
    await storage.writeUploadedObject({
      objectKey: OBJECT_KEY,
      body: Buffer.from("audio"),
      contentType: "audio/webm",
    });

    getAudioSegmentByTurnId.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      turnId: TURN_ID,
      objectKey: OBJECT_KEY,
      format: "webm",
      codec: "opus",
      durationMs: 1200,
      sizeBytes: 5,
      createdAt: "2026-06-06T00:00:00.000Z",
    });

    const result = await finalizeTurnAudioUpload(db as never, storage, {
      sessionId: SESSION_ID,
      turnId: TURN_ID,
      userId: USER_ID,
      objectKey: OBJECT_KEY,
      durationMs: 1200,
      sizeBytes: 5,
    });

    expect(createAudioSegment).not.toHaveBeenCalled();
    expect(result.audioSegment.id).toBe("44444444-4444-4444-8444-444444444444");
    expect(result.postAudioJobsEnqueued).toBe(false);
  });

  it("enqueues post-audio jobs for an existing audio segment when a queue adapter is provided", async () => {
    await storage.createUploadTarget({
      objectKey: OBJECT_KEY,
      contentType: "audio/webm",
      sizeBytes: 5,
    });
    await storage.writeUploadedObject({
      objectKey: OBJECT_KEY,
      body: Buffer.from("audio"),
      contentType: "audio/webm",
    });

    getAudioSegmentByTurnId.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      turnId: TURN_ID,
      objectKey: OBJECT_KEY,
      format: "webm",
      codec: "opus",
      durationMs: 1200,
      sizeBytes: 5,
      createdAt: "2026-06-06T00:00:00.000Z",
    });
    enqueueTurnPostAudioJobs.mockResolvedValue(true);

    const queueAdapter = { enqueue: vi.fn() };
    const result = await finalizeTurnAudioUpload(
      db as never,
      storage,
      {
        sessionId: SESSION_ID,
        turnId: TURN_ID,
        userId: USER_ID,
        objectKey: OBJECT_KEY,
        durationMs: 1200,
        sizeBytes: 5,
      },
      { queueAdapter: queueAdapter as never },
    );

    expect(createAudioSegment).not.toHaveBeenCalled();
    expect(enqueueTurnPostAudioJobs).toHaveBeenCalled();
    expect(result.postAudioJobsEnqueued).toBe(true);
  });
});

describe("S3-compatible storage finalize validation", () => {
  const db = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };
  const send = vi.fn();

  const s3Storage = createS3CompatibleStorageProvider({
    providerName: "oss",
    endpoint: "https://oss-cn-hangzhou.aliyuncs.com",
    bucket: "talkforge-audio",
    accessKeyId: "access",
    secretAccessKey: "secret",
    region: "oss-cn-hangzhou",
    client: { send } as unknown as S3Client,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getSessionById.mockResolvedValue({
      id: SESSION_ID,
      userId: USER_ID,
    });
    getTurnById.mockResolvedValue({
      id: TURN_ID,
      sessionId: SESSION_ID,
    });
    getAudioSegmentByTurnId.mockResolvedValue(null);
  });

  it("rejects finalize when uploaded object size does not match", async () => {
    send.mockResolvedValueOnce({});
    send.mockResolvedValueOnce({ ContentLength: 10 });

    await expect(
      finalizeTurnAudioUpload(db as never, s3Storage, {
        sessionId: SESSION_ID,
        turnId: TURN_ID,
        userId: USER_ID,
        objectKey: OBJECT_KEY,
        durationMs: 1200,
        sizeBytes: 5,
      }),
    ).rejects.toMatchObject({
      code: "uploaded_object_size_mismatch",
    });
  });

  it("finalizes when uploaded object size matches HeadObject metadata", async () => {
    send.mockResolvedValueOnce({});
    send.mockResolvedValueOnce({ ContentLength: 5 });

    createAudioSegment.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      turnId: TURN_ID,
      objectKey: OBJECT_KEY,
      format: "webm",
      codec: "opus",
      durationMs: 1200,
      sizeBytes: 5,
      createdAt: "2026-06-06T00:00:00.000Z",
    });
    linkTurnAudioSegment.mockResolvedValue({
      id: TURN_ID,
      audioSegmentId: "44444444-4444-4444-8444-444444444444",
    });

    const result = await finalizeTurnAudioUpload(db as never, s3Storage, {
      sessionId: SESSION_ID,
      turnId: TURN_ID,
      userId: USER_ID,
      objectKey: OBJECT_KEY,
      durationMs: 1200,
      sizeBytes: 5,
    });

    expect(result.audioSegment.sizeBytes).toBe(5);
    expect(createAudioSegment).toHaveBeenCalled();
  });
});
