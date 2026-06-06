import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildTurnAudioObjectKey } from "@/server/storage/object-keys";
import { LocalFilesystemStorageProvider } from "@/server/storage/local-storage";
import { decodeStorageUploadToken } from "@/server/storage/upload-token";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";

describe("LocalFilesystemStorageProvider", () => {
  let tempDir: string;
  let provider: LocalFilesystemStorageProvider;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("creates signed upload URLs and persists uploaded objects", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "talkforge-storage-"));
    provider = new LocalFilesystemStorageProvider({ rootDir: tempDir });
    const objectKey = buildTurnAudioObjectKey(SESSION_ID, TURN_ID);

    const uploadTarget = await provider.createUploadTarget({
      objectKey,
      contentType: "audio/webm",
      sizeBytes: 5,
    });

    expect(uploadTarget.uploadUrl).toContain("/api/internal/storage/upload?token=");
    const token = new URL(uploadTarget.uploadUrl).searchParams.get("token");
    expect(decodeStorageUploadToken(token!)).toMatchObject({ objectKey });

    await provider.writeUploadedObject({
      objectKey,
      body: Buffer.from("audio"),
      contentType: "audio/webm",
    });

    expect(await provider.objectExists({ objectKey })).toBe(true);
    expect(await provider.getUploadedObjectSize(objectKey)).toBe(5);
  });

  it("rejects path traversal object keys", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "talkforge-storage-"));
    provider = new LocalFilesystemStorageProvider({ rootDir: tempDir });

    await expect(
      provider.writeUploadedObject({
        objectKey: "../../../etc/passwd",
        body: Buffer.from("nope"),
        contentType: "text/plain",
      }),
    ).rejects.toThrow();
  });
});
