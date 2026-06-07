import { afterEach, describe, expect, it } from "vitest";

import { resetRuntimeConfigForTests } from "@/server/config";
import {
  getStorageProvider,
  resetStorageProviderForTests,
} from "@/server/storage/provider";

const ORIGINAL_ENV = { ...process.env };

describe("getStorageProvider", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetRuntimeConfigForTests();
    resetStorageProviderForTests();
  });

  it("returns mock storage by default", () => {
    process.env.NODE_ENV = "test";
    process.env.STORAGE_PROVIDER = "mock";
    resetRuntimeConfigForTests();
    resetStorageProviderForTests();

    expect(getStorageProvider().name).toBe("mock-storage");
  });

  it("returns an S3-compatible provider when real storage is configured", () => {
    process.env.NODE_ENV = "test";
    process.env.STORAGE_PROVIDER = "s3";
    process.env.STORAGE_ENDPOINT = "https://s3.amazonaws.com";
    process.env.STORAGE_BUCKET = "talkforge-audio";
    process.env.STORAGE_ACCESS_KEY_ID = "access";
    process.env.STORAGE_SECRET_ACCESS_KEY = "secret";
    process.env.STORAGE_REGION = "us-east-1";
    resetRuntimeConfigForTests();
    resetStorageProviderForTests();

    expect(getStorageProvider().name).toBe("s3-storage");
  });

  it("returns local filesystem storage for local provider mode", () => {
    process.env.NODE_ENV = "test";
    process.env.STORAGE_PROVIDER = "local";
    resetRuntimeConfigForTests();
    resetStorageProviderForTests();

    expect(getStorageProvider().name).toBe("local-filesystem-storage");
  });

  it("recreates the S3-compatible provider when storage config changes", () => {
    process.env.NODE_ENV = "test";
    process.env.STORAGE_PROVIDER = "s3";
    process.env.STORAGE_ENDPOINT = "https://s3.amazonaws.com";
    process.env.STORAGE_BUCKET = "talkforge-audio";
    process.env.STORAGE_ACCESS_KEY_ID = "access";
    process.env.STORAGE_SECRET_ACCESS_KEY = "secret";
    process.env.STORAGE_REGION = "us-east-1";
    resetRuntimeConfigForTests();
    resetStorageProviderForTests();

    const first = getStorageProvider();

    process.env.STORAGE_BUCKET = "talkforge-audio-staging";
    resetRuntimeConfigForTests();

    const second = getStorageProvider();

    expect(first.name).toBe("s3-storage");
    expect(second.name).toBe("s3-storage");
    expect(second).not.toBe(first);
  });
});
