import { describe, expect, it } from "vitest";

import { MockStorageProvider } from "@/providers/mock/storage";
import { writeStorageUpload } from "@/server/storage/internal-upload";
import { createStorageUploadToken } from "@/server/storage/upload-token";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const OBJECT_KEY = `audio/${SESSION_ID}/${TURN_ID}.webm`;

describe("writeStorageUpload", () => {
  it("accepts signed uploads for pending mock storage objects", async () => {
    const provider = new MockStorageProvider();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    await provider.createUploadTarget({
      objectKey: OBJECT_KEY,
      contentType: "audio/webm",
      sizeBytes: 5,
    });

    const token = createStorageUploadToken({
      objectKey: OBJECT_KEY,
      contentType: "audio/webm",
      sizeBytes: 5,
      expiresAt,
    });

    await writeStorageUpload(provider, token, Buffer.from("audio"));
    expect(await provider.objectExists({ objectKey: OBJECT_KEY })).toBe(true);
    expect(await provider.getUploadedObjectSize(OBJECT_KEY)).toBe(5);
  });
});
