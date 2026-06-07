import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildTurnAudioObjectKey,
  buildTtsStandardAudioObjectKey,
} from "@/server/storage/object-keys";
import {
  createS3ClientConfig,
  createS3CompatibleStorageProvider,
  shouldForcePathStyle,
} from "@/server/storage/s3-compatible-storage";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async (client, command) => {
    if (command instanceof PutObjectCommand) {
      return "https://storage.example/upload-signed";
    }
    if (command instanceof GetObjectCommand) {
      return "https://storage.example/download-signed";
    }
    return "https://storage.example/signed";
  }),
}));

describe("S3-compatible storage provider", () => {
  const send = vi.fn();
  const client = { send } as unknown as S3Client;
  let provider: ReturnType<typeof createS3CompatibleStorageProvider>;

  beforeEach(() => {
    send.mockReset();
    provider = createS3CompatibleStorageProvider({
      providerName: "s3",
      endpoint: "https://s3.amazonaws.com",
      bucket: "talkforge-audio",
      accessKeyId: "access",
      secretAccessKey: "secret",
      region: "us-east-1",
      client,
    });
  });

  it("creates short-lived signed upload targets for private objects", async () => {
    const objectKey = buildTurnAudioObjectKey(SESSION_ID, TURN_ID);
    const uploadTarget = await provider.createUploadTarget({
      objectKey,
      contentType: "audio/webm",
      sizeBytes: 128,
      visibility: "private",
    });

    expect(uploadTarget.method).toBe("PUT");
    expect(uploadTarget.uploadUrl).toBe("https://storage.example/upload-signed");
    expect(uploadTarget.headers).toEqual({
      "Content-Type": "audio/webm",
      "Content-Length": "128",
    });
    expect(new Date(uploadTarget.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("checks object existence and size through HeadObject", async () => {
    const objectKey = buildTtsStandardAudioObjectKey("abc123");

    send.mockResolvedValueOnce({ ContentLength: 4096 });
    await expect(provider.getUploadedObjectSize(objectKey)).resolves.toBe(4096);
    expect(send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));

    send.mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } });
    await expect(provider.objectExists({ objectKey })).resolves.toBe(false);
  });

  it("creates signed download URLs only for existing objects", async () => {
    const objectKey = buildTurnAudioObjectKey(SESSION_ID, TURN_ID);

    send.mockResolvedValueOnce({});
    const download = await provider.createDownloadUrl({ objectKey });

    expect(download.downloadUrl).toBe("https://storage.example/download-signed");
    expect(send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
  });

  it("deletes objects with DeleteObject", async () => {
    const objectKey = buildTurnAudioObjectKey(SESSION_ID, TURN_ID);

    send.mockResolvedValueOnce({});
    await provider.deleteObject({ objectKey });

    expect(send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
  });

  it("configures path-style access for MinIO and local endpoints", () => {
    expect(shouldForcePathStyle("minio", "https://minio.example.com")).toBe(true);
    expect(shouldForcePathStyle("s3", "http://localhost:9000")).toBe(true);
    expect(shouldForcePathStyle("s3", "https://s3.amazonaws.com")).toBe(false);

    const config = createS3ClientConfig({
      providerName: "minio",
      endpoint: "http://localhost:9000",
      bucket: "talkforge-audio",
      accessKeyId: "access",
      secretAccessKey: "secret",
    });

    expect(config.forcePathStyle).toBe(true);
    expect(config.region).toBe("us-east-1");
  });
});
