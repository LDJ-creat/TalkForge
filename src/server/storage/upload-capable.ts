import type { StorageProvider } from "@/providers/storage/contract";

export type WriteUploadedObjectInput = {
  objectKey: string;
  body: Buffer | Uint8Array;
  contentType: string;
};

export interface UploadCapableStorageProvider extends StorageProvider {
  writeUploadedObject(input: WriteUploadedObjectInput): Promise<void>;
  getUploadedObjectSize?(objectKey: string): Promise<number>;
}

export function isUploadCapableStorageProvider(
  provider: StorageProvider,
): provider is UploadCapableStorageProvider {
  return typeof (provider as UploadCapableStorageProvider).writeUploadedObject === "function";
}

export function hasUploadedObjectSize(
  provider: StorageProvider,
): provider is StorageProvider & {
  getUploadedObjectSize: (objectKey: string) => Promise<number>;
} {
  return typeof (provider as UploadCapableStorageProvider).getUploadedObjectSize ===
    "function";
}
