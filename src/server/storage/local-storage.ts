import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { addSecondsIso } from "@/providers/mock/utils";
import { getRuntimeSecret } from "@/server/config";
import type {
  CreateDownloadUrlInput,
  CreateUploadTargetInput,
  DeleteObjectInput,
  DownloadUrl,
  ObjectExistsInput,
  UploadTarget,
} from "@/providers/storage/types";

import { assertValidTurnAudioObjectKey } from "./object-keys";
import {
  createStorageUploadToken,
  createStorageUploadUrl,
  getStorageSigningSecret,
} from "./upload-token";
import type { UploadCapableStorageProvider, WriteUploadedObjectInput } from "./upload-capable";

const DEFAULT_EXPIRES_IN_SEC = 900;

export type LocalFilesystemStorageProviderOptions = {
  rootDir?: string;
  defaultExpiresInSec?: number;
};

function getDefaultRootDir(): string {
  return getRuntimeSecret("localStorageRoot") ?? path.join(process.cwd(), ".data", "storage");
}

function assertResolvedObjectPath(rootDir: string, objectKey: string): string {
  assertValidTurnAudioObjectKey(objectKey);
  const resolvedRoot = path.resolve(rootDir);
  const resolvedObjectPath = path.resolve(resolvedRoot, objectKey);
  const relativePath = path.relative(resolvedRoot, resolvedObjectPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to resolve object path outside storage root: ${objectKey}`);
  }
  return resolvedObjectPath;
}

export class LocalFilesystemStorageProvider implements UploadCapableStorageProvider {
  readonly name = "local-filesystem-storage";
  private readonly rootDir: string;
  private readonly defaultExpiresInSec: number;

  constructor(options: LocalFilesystemStorageProviderOptions = {}) {
    this.rootDir = options.rootDir ?? getDefaultRootDir();
    this.defaultExpiresInSec = options.defaultExpiresInSec ?? DEFAULT_EXPIRES_IN_SEC;
  }

  async createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget> {
    assertValidTurnAudioObjectKey(input.objectKey);
    const expiresInSec = input.expiresInSec ?? this.defaultExpiresInSec;
    const now = new Date().toISOString();
    const expiresAt = addSecondsIso(now, expiresInSec);
    const token = createStorageUploadToken(
      {
        objectKey: input.objectKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        expiresAt,
      },
      getStorageSigningSecret(),
    );

    return {
      objectKey: input.objectKey,
      uploadUrl: createStorageUploadUrl(token),
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
      },
      expiresAt,
    };
  }

  async writeUploadedObject(input: WriteUploadedObjectInput): Promise<void> {
    const objectPath = assertResolvedObjectPath(this.rootDir, input.objectKey);
    await mkdir(path.dirname(objectPath), { recursive: true });
    await writeFile(objectPath, input.body);
  }

  async getUploadedObjectSize(objectKey: string): Promise<number> {
    const objectPath = assertResolvedObjectPath(this.rootDir, objectKey);
    const fileStat = await stat(objectPath);
    return fileStat.size;
  }

  async createDownloadUrl(input: CreateDownloadUrlInput): Promise<DownloadUrl> {
    const objectPath = assertResolvedObjectPath(this.rootDir, input.objectKey);
    const expiresInSec = input.expiresInSec ?? this.defaultExpiresInSec;
    const now = new Date().toISOString();
    try {
      await stat(objectPath);
    } catch {
      throw new Error(`Object ${input.objectKey} was not found.`);
    }

    return {
      objectKey: input.objectKey,
      downloadUrl: `file://${objectPath}`,
      expiresAt: addSecondsIso(now, expiresInSec),
    };
  }

  async deleteObject(input: DeleteObjectInput): Promise<void> {
    const objectPath = assertResolvedObjectPath(this.rootDir, input.objectKey);
    await rm(objectPath, { force: true });
  }

  async objectExists(input: ObjectExistsInput): Promise<boolean> {
    const objectPath = assertResolvedObjectPath(this.rootDir, input.objectKey);
    try {
      await stat(objectPath);
      return true;
    } catch {
      return false;
    }
  }
}
