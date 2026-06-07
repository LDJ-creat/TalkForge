import { S3Client } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as uploadTargetPost } from "@/app/api/sessions/[sessionId]/turns/[turnId]/audio/upload-target/route";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";
import { createS3CompatibleStorageProvider } from "@/server/storage/s3-compatible-storage";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const PRESIGNED_UPLOAD_URL =
  "https://oss-cn-hangzhou.aliyuncs.com/talkforge-audio/upload-signed";

const getSessionById = vi.fn();
const getTurnById = vi.fn();

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => PRESIGNED_UPLOAD_URL),
}));

vi.mock("@/server/db/repositories/scenario-session-repository", () => ({
  getSessionById: (...args: unknown[]) => getSessionById(...args),
}));

vi.mock("@/server/db/repositories/turn-repository", () => ({
  getTurnById: (...args: unknown[]) => getTurnById(...args),
}));

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

const s3StorageProvider = createS3CompatibleStorageProvider({
  providerName: "oss",
  endpoint: "https://oss-cn-hangzhou.aliyuncs.com",
  bucket: "talkforge-audio",
  accessKeyId: "access",
  secretAccessKey: "secret",
  region: "oss-cn-hangzhou",
  client: { send: vi.fn() } as unknown as S3Client,
});

vi.mock("@/server/storage/provider", () => ({
  getStorageProvider: () => s3StorageProvider,
}));

describe("storage upload API with S3-compatible provider", () => {
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
  });

  it("returns external presigned upload URLs instead of internal upload routes", async () => {
    const response = await uploadTargetPost(
      new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
        body: JSON.stringify({ sizeBytes: 128, contentType: "audio/webm" }),
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID, turnId: TURN_ID }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.uploadTarget.uploadUrl).toBe(PRESIGNED_UPLOAD_URL);
    expect(body.uploadTarget.uploadUrl).not.toContain("/api/internal/storage/upload");
    expect(body.uploadTarget.method).toBe("PUT");
    expect(body.objectKey).toBe(`audio/${SESSION_ID}/${TURN_ID}.webm`);
  });
});
