import type { StorageProvider } from "@/providers/storage/contract";

import { AudioUploadServiceError } from "./errors";
import { assertValidTurnAudioObjectKey } from "./object-keys";
import { isUploadCapableStorageProvider } from "./upload-capable";
import { decodeStorageUploadToken } from "./upload-token";

export async function writeStorageUpload(
  provider: StorageProvider,
  token: string,
  body: Buffer,
): Promise<void> {
  const claims = decodeStorageUploadToken(token);
  assertValidTurnAudioObjectKey(claims.objectKey);

  if (!isUploadCapableStorageProvider(provider)) {
    throw new AudioUploadServiceError(
      500,
      "storage_not_upload_capable",
      "Configured storage provider does not accept direct uploads.",
    );
  }

  if (claims.sizeBytes !== undefined && body.byteLength !== claims.sizeBytes) {
    throw new AudioUploadServiceError(
      400,
      "upload_size_mismatch",
      "Uploaded object size does not match the signed upload token.",
    );
  }

  await provider.writeUploadedObject({
    objectKey: claims.objectKey,
    body,
    contentType: claims.contentType,
  });
}
