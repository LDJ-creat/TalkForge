import { readFile } from "node:fs/promises";
import path from "node:path";

import { createProviderError } from "@/providers/errors";
import { MockStorageProvider } from "@/providers/mock/storage";
import { getStorageProvider } from "@/server/storage/provider";
import { LocalFilesystemStorageProvider } from "@/server/storage/local-storage";
import { S3CompatibleStorageProvider } from "@/server/storage/s3-compatible-storage";
import type { LoadedAudioObject } from "@/providers/dashscope-paraformer";

const EXTENSION_CONTENT_TYPE_MAP: Record<string, string> = {
  flac: "audio/flac",
  m4a: "audio/m4a",
  mp3: "audio/mp3",
  mp4: "audio/mp4",
  mpeg: "audio/mpeg",
  mpga: "audio/mpga",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};

function inferContentTypeFromObjectKey(objectKey: string): string | undefined {
  const match = objectKey.match(/\.([a-z0-9]+)$/i);
  const extension = match?.[1]?.toLowerCase();
  return extension ? EXTENSION_CONTENT_TYPE_MAP[extension] : undefined;
}

async function readFromS3Provider(
  provider: S3CompatibleStorageProvider,
  objectKey: string,
): Promise<LoadedAudioObject> {
  const exists = await provider.objectExists?.({ objectKey });
  if (!exists) {
    throw createProviderError({
      provider: provider.name,
      code: "not_found",
      message: `Audio object ${objectKey} was not found.`,
      retryable: false,
    });
  }

  const internal = provider as S3CompatibleStorageProvider & {
    readObjectBody(objectKey: string): Promise<LoadedAudioObject>;
  };

  return internal.readObjectBody(objectKey);
}

async function readFromLocalProvider(
  provider: LocalFilesystemStorageProvider,
  objectKey: string,
): Promise<LoadedAudioObject> {
  const exists = await provider.objectExists?.({ objectKey });
  if (!exists) {
    throw createProviderError({
      provider: provider.name,
      code: "not_found",
      message: `Audio object ${objectKey} was not found.`,
      retryable: false,
    });
  }

  const download = await provider.createDownloadUrl({ objectKey });
  const filePath = download.downloadUrl.startsWith("file://")
    ? download.downloadUrl.slice("file://".length)
    : path.resolve(download.downloadUrl);

  return {
    objectKey,
    body: await readFile(filePath),
    contentType: inferContentTypeFromObjectKey(objectKey),
  };
}

async function readFromMockProvider(
  provider: MockStorageProvider,
  objectKey: string,
): Promise<LoadedAudioObject> {
  const body = provider.getStoredObjectBody(objectKey);
  if (!body) {
    throw createProviderError({
      provider: provider.name,
      code: "not_found",
      message: `Audio object ${objectKey} was not found.`,
      retryable: false,
    });
  }

  const stored = provider.getStoredObject(objectKey);
  return {
    objectKey,
    body,
    contentType: stored?.contentType ?? inferContentTypeFromObjectKey(objectKey),
  };
}

export async function loadAudioObjectForAsr(
  objectKey: string,
): Promise<LoadedAudioObject> {
  const provider = getStorageProvider();

  if (provider instanceof S3CompatibleStorageProvider) {
    return readFromS3Provider(provider, objectKey);
  }

  if (provider instanceof LocalFilesystemStorageProvider) {
    return readFromLocalProvider(provider, objectKey);
  }

  if (provider instanceof MockStorageProvider) {
    return readFromMockProvider(provider, objectKey);
  }

  const providerName = (provider as { name: string }).name;
  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: `Storage provider "${providerName}" does not support server-side audio reads for ASR.`,
    retryable: false,
  });
}
