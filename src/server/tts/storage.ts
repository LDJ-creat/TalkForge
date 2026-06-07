import { MockStorageProvider } from "@/providers/mock/storage";
import { createProviderError } from "@/providers/errors";
import type { PersistStandardAudioObjectInput } from "@/providers/dashscope-cosyvoice";
import { getStorageProvider } from "@/server/storage/provider";
import {
  isUploadCapableStorageProvider,
} from "@/server/storage/upload-capable";

export async function objectExistsInStorage(objectKey: string): Promise<boolean> {
  const provider = getStorageProvider();
  if (typeof provider.objectExists !== "function") {
    return false;
  }

  return provider.objectExists({ objectKey });
}

export async function persistStandardAudioObject(
  input: PersistStandardAudioObjectInput,
): Promise<void> {
  const provider = getStorageProvider();

  if (!isUploadCapableStorageProvider(provider)) {
    throw createProviderError({
      provider: provider.name,
      code: "configuration",
      message: `Storage provider "${provider.name}" does not support server-side TTS audio uploads.`,
      retryable: false,
    });
  }

  if (provider instanceof MockStorageProvider) {
    const exists = await provider.objectExists?.({ objectKey: input.objectKey });
    if (!exists) {
      await provider.createUploadTarget({
        objectKey: input.objectKey,
        contentType: input.contentType,
        sizeBytes: input.body.byteLength,
      });
    }
  }

  await provider.writeUploadedObject({
    objectKey: input.objectKey,
    body: input.body,
    contentType: input.contentType,
  });
}
