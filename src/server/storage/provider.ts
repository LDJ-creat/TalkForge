import { createMockStorageProvider } from "@/providers/mock/storage";

import { LocalFilesystemStorageProvider } from "./local-storage";
import {
  createStorageUploadToken,
  createStorageUploadUrl,
  getAppBaseUrl,
} from "./upload-token";

let mockStorageProvider: ReturnType<typeof createMockStorageProvider> | undefined;
let localStorageProvider: LocalFilesystemStorageProvider | undefined;

export function getStorageProvider() {
  const providerName = process.env.STORAGE_PROVIDER ?? "mock";

  if (providerName === "local") {
    localStorageProvider ??= new LocalFilesystemStorageProvider();
    return localStorageProvider;
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
