import { createMockStorageProvider } from "@/providers/mock/storage";
import { getRuntimeConfig } from "@/server/config";
import type { RuntimeSecrets, StorageProviderName } from "@/server/config/types";

import { LocalFilesystemStorageProvider } from "./local-storage";
import { createS3CompatibleStorageProvider } from "./s3-compatible-storage";
import {
  createStorageUploadToken,
  createStorageUploadUrl,
  getAppBaseUrl,
} from "./upload-token";

const REAL_S3_COMPATIBLE_PROVIDERS = new Set<StorageProviderName>([
  "s3",
  "r2",
  "oss",
  "minio",
]);

let mockStorageProvider: ReturnType<typeof createMockStorageProvider> | undefined;
let localStorageProvider: LocalFilesystemStorageProvider | undefined;
let s3CompatibleStorageProvider: ReturnType<
  typeof createS3CompatibleStorageProvider
> | undefined;
let s3CompatibleStorageCacheKey: string | undefined;

function buildS3StorageCacheKey(
  providerName: StorageProviderName,
  secrets: RuntimeSecrets,
): string {
  return [
    providerName,
    secrets.storageEndpoint ?? "",
    secrets.storageBucket ?? "",
    secrets.storageAccessKeyId ?? "",
    secrets.storageRegion ?? "",
  ].join("|");
}

function createRealStorageProvider(providerName: StorageProviderName) {
  const { secrets } = getRuntimeConfig();
  if (
    !secrets.storageEndpoint ||
    !secrets.storageBucket ||
    !secrets.storageAccessKeyId ||
    !secrets.storageSecretAccessKey
  ) {
    throw new Error(
      `Storage provider "${providerName}" is misconfigured. Required secrets are missing.`,
    );
  }

  return createS3CompatibleStorageProvider({
    providerName,
    endpoint: secrets.storageEndpoint,
    bucket: secrets.storageBucket,
    accessKeyId: secrets.storageAccessKeyId,
    secretAccessKey: secrets.storageSecretAccessKey,
    region: secrets.storageRegion,
  });
}

export function getStorageProvider() {
  const config = getRuntimeConfig();
  const providerName = config.providers.storage.name;

  if (providerName === "local") {
    localStorageProvider ??= new LocalFilesystemStorageProvider();
    return localStorageProvider;
  }

  if (REAL_S3_COMPATIBLE_PROVIDERS.has(providerName)) {
    const cacheKey = buildS3StorageCacheKey(providerName, config.secrets);
    if (!s3CompatibleStorageProvider || s3CompatibleStorageCacheKey !== cacheKey) {
      s3CompatibleStorageProvider = createRealStorageProvider(providerName);
      s3CompatibleStorageCacheKey = cacheKey;
    }
    return s3CompatibleStorageProvider;
  }

  mockStorageProvider ??= createMockStorageProvider({
    createUploadUrl: ({ objectKey, contentType, sizeBytes, expiresAt }) => {
      const token = createStorageUploadToken({
        objectKey,
        contentType,
        sizeBytes,
        expiresAt,
      });
      return createStorageUploadUrl(token, getAppBaseUrl());
    },
  });

  return mockStorageProvider;
}

export function resetStorageProviderForTests(): void {
  mockStorageProvider = undefined;
  localStorageProvider = undefined;
  s3CompatibleStorageProvider = undefined;
  s3CompatibleStorageCacheKey = undefined;
}
