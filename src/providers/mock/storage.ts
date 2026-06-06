import { createProviderError } from "../errors";
import type { StorageProvider } from "../storage/contract";
import type {
  CreateDownloadUrlInput,
  CreateUploadTargetInput,
  DeleteObjectInput,
  DownloadUrl,
  ObjectExistsInput,
  UploadTarget,
} from "../storage/types";
import { addSecondsIso } from "./utils";

type StoredObject = {
  contentType: string;
  sizeBytes?: number;
  visibility: "private";
  createdAt: string;
};

export type MockStorageProviderOptions = {
  name?: string;
  baseUrl?: string;
  defaultExpiresInSec?: number;
  failOnUploadTarget?: boolean;
};

export class MockStorageProvider implements StorageProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly defaultExpiresInSec: number;
  private readonly failOnUploadTarget: boolean;
  private readonly objects = new Map<string, StoredObject>();

  constructor(options: MockStorageProviderOptions = {}) {
    this.name = options.name ?? "mock-storage";
    this.baseUrl = options.baseUrl ?? "https://mock-storage.talkforge.local";
    this.defaultExpiresInSec = options.defaultExpiresInSec ?? 900;
    this.failOnUploadTarget = options.failOnUploadTarget ?? false;
  }

  async createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget> {
    if (this.failOnUploadTarget) {
      throw createProviderError({
        provider: this.name,
        code: "provider_unavailable",
        message: "Mock storage provider is configured to fail upload target creation.",
      });
    }

    const expiresInSec = input.expiresInSec ?? this.defaultExpiresInSec;
    const now = new Date().toISOString();
    const visibility = input.visibility ?? "private";

    this.objects.set(input.objectKey, {
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      visibility,
      createdAt: now,
    });

    return {
      objectKey: input.objectKey,
      uploadUrl: `${this.baseUrl}/upload/${encodeURIComponent(input.objectKey)}`,
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
        "x-talkforge-visibility": visibility,
      },
      expiresAt: addSecondsIso(now, expiresInSec),
    };
  }

  async createDownloadUrl(input: CreateDownloadUrlInput): Promise<DownloadUrl> {
    if (!this.objects.has(input.objectKey)) {
      throw createProviderError({
        provider: this.name,
        code: "not_found",
        message: `Object ${input.objectKey} was not found.`,
      });
    }

    const expiresInSec = input.expiresInSec ?? this.defaultExpiresInSec;
    const now = new Date().toISOString();

    return {
      objectKey: input.objectKey,
      downloadUrl: `${this.baseUrl}/download/${encodeURIComponent(input.objectKey)}`,
      expiresAt: addSecondsIso(now, expiresInSec),
    };
  }

  async deleteObject(input: DeleteObjectInput): Promise<void> {
    if (!this.objects.delete(input.objectKey)) {
      throw createProviderError({
        provider: this.name,
        code: "not_found",
        message: `Object ${input.objectKey} was not found.`,
      });
    }
  }

  async objectExists(input: ObjectExistsInput): Promise<boolean> {
    return this.objects.has(input.objectKey);
  }

  getStoredObject(objectKey: string): StoredObject | undefined {
    return this.objects.get(objectKey);
  }
}

export function createMockStorageProvider(
  options?: MockStorageProviderOptions,
): MockStorageProvider {
  return new MockStorageProvider(options);
}
