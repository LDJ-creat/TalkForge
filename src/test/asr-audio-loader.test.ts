import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createMockStorageProvider } from "@/providers/mock/storage";
import { resetRuntimeConfigForTests } from "@/server/config";
import { loadAudioObjectForAsr } from "@/server/asr/audio-loader";
import {
  resetStorageProviderForTests,
  getStorageProvider,
} from "@/server/storage/provider";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const OBJECT_KEY = `audio/${SESSION_ID}/${TURN_ID}.webm`;

describe("loadAudioObjectForAsr", () => {
  afterEach(async () => {
    resetRuntimeConfigForTests();
    resetStorageProviderForTests();
    delete process.env.LOCAL_STORAGE_ROOT;
    await rm(path.join(process.cwd(), ".data", "test-asr-audio"), {
      recursive: true,
      force: true,
    });
  });

  it("reads uploaded audio bytes from mock storage", async () => {
    process.env.STORAGE_PROVIDER = "mock";
    resetRuntimeConfigForTests();
    resetStorageProviderForTests();

    const storage = getStorageProvider() as ReturnType<typeof createMockStorageProvider>;
    await storage.createUploadTarget({
      objectKey: OBJECT_KEY,
      contentType: "audio/webm",
      sizeBytes: 12,
    });
    await storage.writeUploadedObject({
      objectKey: OBJECT_KEY,
      body: Buffer.from("mock-audio"),
      contentType: "audio/webm",
    });

    const loaded = await loadAudioObjectForAsr(OBJECT_KEY);

    expect(loaded.objectKey).toBe(OBJECT_KEY);
    expect(loaded.body.toString()).toBe("mock-audio");
    expect(loaded.contentType).toBe("audio/webm");
  });

  it("reads audio from the local filesystem storage provider", async () => {
    const rootDir = path.join(process.cwd(), ".data", "test-asr-audio");
    const objectPath = path.join(rootDir, OBJECT_KEY);

    await mkdir(path.dirname(objectPath), { recursive: true });
    await writeFile(objectPath, Buffer.from("local-audio"));

    process.env.STORAGE_PROVIDER = "local";
    process.env.LOCAL_STORAGE_ROOT = rootDir;
    resetRuntimeConfigForTests();
    resetStorageProviderForTests();

    const audio = await loadAudioObjectForAsr(OBJECT_KEY);
    expect(audio.body.toString()).toBe("local-audio");
    expect(audio.contentType).toBe("audio/webm");
  });

  it("fails with not_found when the audio object is missing", async () => {
    process.env.STORAGE_PROVIDER = "mock";
    resetRuntimeConfigForTests();
    resetStorageProviderForTests();

    await expect(loadAudioObjectForAsr(OBJECT_KEY)).rejects.toMatchObject({
      code: "not_found",
      retryable: false,
    });
  });
});
