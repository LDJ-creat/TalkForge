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
import type { WriteUploadedObjectInput } from "@/server/storage/upload-capable";
import { addSecondsIso } from "./utils";

type StoredObject = {
  contentType: string;
  sizeBytes: number;
  visibility: "private";
  createdAt: string;
};

type PendingUpload = {
  contentType: string;
  sizeBytes?: number;
  visibility: "private";
  createdAt: string;
  expiresAt: string;
};

export type MockStorageProviderOptions = {
  name?: string;
  baseUrl?: string;
  defaultExpiresInSec?: number;
  failOnUploadTarget?: boolean;
  createUploadUrl?: (input: {
    objectKey: string;
    contentType: string;
    sizeBytes?: number;
    expiresAt: string;
  }) => string;
};

export class MockStorageProvider implements StorageProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly defaultExpiresInSec: number;
  private readonly failOnUploadTarget: boolean;
  private readonly createUploadUrl?: MockStorageProviderOptions["createUploadUrl"];
  private readonly pendingUploads = new Map<string, PendingUpload>();
  private readonly objects = new Map<string, StoredObject>();

  constructor(options: MockStorageProviderOptions = {}) {
    this.name = options.name ?? "mock-storage";
    this.baseUrl = options.baseUrl ?? "https://mock-storage.talkforge.local";
    this.defaultExpiresInSec = options.defaultExpiresInSec ?? 900;
    this.failOnUploadTarget = options.failOnUploadTarget ?? false;
    this.createUploadUrl = options.createUploadUrl;
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
    const expiresAt = addSecondsIso(now, expiresInSec);

    this.pendingUploads.set(input.objectKey, {
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      visibility,
      createdAt: now,
      expiresAt,
    });

    const uploadUrl = this.createUploadUrl
      ? this.createUploadUrl({
          objectKey: input.objectKey,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          expiresAt,
        })
      : `${this.baseUrl}/upload/${encodeURIComponent(input.objectKey)}`;

    return {
      objectKey: input.objectKey,
      uploadUrl,
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
        "x-talkforge-visibility": visibility,
      },
      expiresAt,
    };
  }

  async writeUploadedObject(input: WriteUploadedObjectInput): Promise<void> {
    const pending = this.pendingUploads.get(input.objectKey);
    if (!pending) {
      throw createProviderError({
        provider: this.name,
        code: "not_found",
        message: `Pending upload for ${input.objectKey} was not found.`,
      });
    }

    this.pendingUploads.delete(input.objectKey);
    this.objects.set(input.objectKey, {
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      visibility: pending.visibility,
      createdAt: pending.createdAt,
    });
  }

  async getUploadedObjectSize(objectKey: string): Promise<number> {
    const stored = this.objects.get(objectKey);
    if (!stored) {
      throw createProviderError({
        provider: this.name,
        code: "not_found",
        message: `Object ${objectKey} was not found.`,
      });
    }
    return stored.sizeBytes;
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
    const deletedPending = this.pendingUploads.delete(input.objectKey);
    const deletedObject = this.objects.delete(input.objectKey);
    if (!deletedPending && !deletedObject) {
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

  getPendingUpload(objectKey: string): PendingUpload | undefined {
    return this.pendingUploads.get(objectKey);
  }
}

export function createMockStorageProvider(
  options?: MockStorageProviderOptions,
): MockStorageProvider {
  return new MockStorageProvider(options);
}
