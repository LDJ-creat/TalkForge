import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { createProviderError, normalizeProviderError } from "@/providers/errors";
import { addSecondsIso } from "@/shared/time";
import type {
  CreateDownloadUrlInput,
  CreateUploadTargetInput,
  DeleteObjectInput,
  DownloadUrl,
  ObjectExistsInput,
  UploadTarget,
} from "@/providers/storage/types";
import type { StorageProviderName } from "@/server/config/types";

import { assertValidStorageObjectKey } from "./object-keys";
import type { StorageProvider } from "@/providers/storage/contract";

const DEFAULT_EXPIRES_IN_SEC = 900;
const DEFAULT_REGION = "us-east-1";

function isS3NotFoundError(error: unknown): boolean {
  if (error instanceof NotFound) {
    return true;
  }

  if (typeof error === "object" && error !== null) {
    const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
    if (metadata?.httpStatusCode === 404) {
      return true;
    }

    const name = (error as { name?: string }).name;
    if (name === "NotFound" || name === "NoSuchKey") {
      return true;
    }
  }

  return false;
}

export type S3CompatibleStorageProviderOptions = {
  name: string;
  bucket: string;
  client: S3Client;
  defaultExpiresInSec?: number;
};

export type CreateS3CompatibleStorageProviderOptions = {
  providerName: StorageProviderName;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  forcePathStyle?: boolean;
  defaultExpiresInSec?: number;
  client?: S3Client;
};

function resolveProviderDisplayName(providerName: StorageProviderName): string {
  switch (providerName) {
    case "s3":
      return "s3-storage";
    case "r2":
      return "r2-storage";
    case "oss":
      return "oss-storage";
    case "minio":
      return "minio-storage";
    default:
      return `${providerName}-storage`;
  }
}

function resolveS3Region(
  providerName: StorageProviderName,
  region?: string,
): string {
  if (region) {
    return region;
  }
  if (providerName === "r2") {
    return "auto";
  }
  return DEFAULT_REGION;
}

export function shouldForcePathStyle(
  providerName: StorageProviderName,
  endpoint: string,
): boolean {
  if (providerName === "minio") {
    return true;
  }
  return /localhost|127\.0\.0\.1/i.test(endpoint);
}

export function createS3ClientConfig(
  options: CreateS3CompatibleStorageProviderOptions,
): S3ClientConfig {
  return {
    endpoint: options.endpoint,
    region: resolveS3Region(options.providerName, options.region),
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    forcePathStyle:
      options.forcePathStyle ??
      shouldForcePathStyle(options.providerName, options.endpoint),
  };
}

export function createS3CompatibleStorageProvider(
  options: CreateS3CompatibleStorageProviderOptions,
): S3CompatibleStorageProvider {
  const client =
    options.client ??
    new S3Client(createS3ClientConfig(options));

  return new S3CompatibleStorageProvider({
    name: resolveProviderDisplayName(options.providerName),
    bucket: options.bucket,
    client,
    defaultExpiresInSec: options.defaultExpiresInSec,
  });
}

export class S3CompatibleStorageProvider implements StorageProvider {
  readonly name: string;
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly defaultExpiresInSec: number;

  constructor(options: S3CompatibleStorageProviderOptions) {
    this.name = options.name;
    this.bucket = options.bucket;
    this.client = options.client;
    this.defaultExpiresInSec = options.defaultExpiresInSec ?? DEFAULT_EXPIRES_IN_SEC;
  }

  async createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget> {
    assertValidStorageObjectKey(input.objectKey);
    const expiresInSec = input.expiresInSec ?? this.defaultExpiresInSec;
    const now = new Date().toISOString();
    const expiresAt = addSecondsIso(now, expiresInSec);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        ContentType: input.contentType,
        ...(input.sizeBytes !== undefined ? { ContentLength: input.sizeBytes } : {}),
      });
      const uploadUrl = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSec,
      });

      return {
        objectKey: input.objectKey,
        uploadUrl,
        method: "PUT",
        headers: {
          "Content-Type": input.contentType,
          ...(input.sizeBytes !== undefined
            ? { "Content-Length": String(input.sizeBytes) }
            : {}),
        },
        expiresAt,
      };
    } catch (error) {
      throw normalizeProviderError(error, { provider: this.name });
    }
  }

  async createDownloadUrl(input: CreateDownloadUrlInput): Promise<DownloadUrl> {
    assertValidStorageObjectKey(input.objectKey);
    const exists = await this.objectExists({ objectKey: input.objectKey });
    if (!exists) {
      throw createProviderError({
        provider: this.name,
        code: "not_found",
        message: `Object ${input.objectKey} was not found.`,
      });
    }

    const expiresInSec = input.expiresInSec ?? this.defaultExpiresInSec;
    const now = new Date().toISOString();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
      });
      const downloadUrl = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSec,
      });

      return {
        objectKey: input.objectKey,
        downloadUrl,
        expiresAt: addSecondsIso(now, expiresInSec),
      };
    } catch (error) {
      throw normalizeProviderError(error, { provider: this.name });
    }
  }

  async deleteObject(input: DeleteObjectInput): Promise<void> {
    assertValidStorageObjectKey(input.objectKey);

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: input.objectKey,
        }),
      );
    } catch (error) {
      throw normalizeProviderError(error, { provider: this.name });
    }
  }

  async objectExists(input: ObjectExistsInput): Promise<boolean> {
    assertValidStorageObjectKey(input.objectKey);

    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: input.objectKey,
        }),
      );
      return true;
    } catch (error) {
      if (isS3NotFoundError(error)) {
        return false;
      }
      throw normalizeProviderError(error, { provider: this.name });
    }
  }

  async getUploadedObjectSize(objectKey: string): Promise<number> {
    assertValidStorageObjectKey(objectKey);

    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );

      if (response.ContentLength === undefined) {
        throw createProviderError({
          provider: this.name,
          code: "internal",
          message: `Object ${objectKey} is missing Content-Length metadata.`,
        });
      }

      return response.ContentLength;
    } catch (error) {
      throw normalizeProviderError(error, { provider: this.name });
    }
  }
}
