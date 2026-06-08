import { MockStorageProvider } from "@/providers/mock/storage";
import { createProviderError } from "@/providers/errors";
import { getStorageProvider } from "@/server/storage/provider";
import { buildTurnAudioObjectKey } from "@/server/storage/object-keys";
import { isUploadCapableStorageProvider } from "@/server/storage/upload-capable";

export type PersistTurnPracticeAudioInput = {
  sessionId: string;
  turnId: string;
  body: Buffer;
  contentType?: string;
};

export async function persistTurnPracticeAudio(
  input: PersistTurnPracticeAudioInput,
): Promise<{ objectKey: string; sizeBytes: number }> {
  const provider = getStorageProvider();
  const contentType = input.contentType ?? "audio/webm";
  const objectKey = buildTurnAudioObjectKey(input.sessionId, input.turnId);
  const sizeBytes = input.body.byteLength;

  if (!isUploadCapableStorageProvider(provider)) {
    throw createProviderError({
      provider: provider.name,
      code: "configuration",
      message: `Storage provider "${provider.name}" does not support server-side practice audio uploads.`,
      retryable: false,
    });
  }

  if (provider instanceof MockStorageProvider) {
    const exists = await provider.objectExists?.({ objectKey });
    if (!exists) {
      await provider.createUploadTarget({
        objectKey,
        contentType,
        sizeBytes,
      });
    }
  }

  await provider.writeUploadedObject({
    objectKey,
    body: input.body,
    contentType,
  });

  return { objectKey, sizeBytes };
}
