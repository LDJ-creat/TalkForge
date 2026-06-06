export const STORAGE_OBJECT_VISIBILITY = ["private"] as const;
export type StorageObjectVisibility = (typeof STORAGE_OBJECT_VISIBILITY)[number];

export const STORAGE_UPLOAD_METHODS = ["PUT", "POST"] as const;
export type StorageUploadMethod = (typeof STORAGE_UPLOAD_METHODS)[number];

export type CreateUploadTargetInput = {
  objectKey: string;
  contentType: string;
  sizeBytes?: number;
  expiresInSec?: number;
  visibility?: StorageObjectVisibility;
};

export type UploadTarget = {
  objectKey: string;
  uploadUrl: string;
  method: StorageUploadMethod;
  headers?: Record<string, string>;
  expiresAt: string;
};

export type CreateDownloadUrlInput = {
  objectKey: string;
  expiresInSec?: number;
};

export type DownloadUrl = {
  objectKey: string;
  downloadUrl: string;
  expiresAt: string;
};

export type DeleteObjectInput = {
  objectKey: string;
};

export type ObjectExistsInput = {
  objectKey: string;
};
