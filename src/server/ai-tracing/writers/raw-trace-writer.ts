import type { AiTracingConfig } from "@/server/config/types";
import {
  getStorageProvider,
  resetStorageProviderForTests,
} from "@/server/storage/provider";
import {
  isUploadCapableStorageProvider,
  type UploadCapableStorageProvider,
} from "@/server/storage/upload-capable";

import type { AiTraceArtifactKind } from "../object-keys";
import {
  shouldCaptureRawRequest,
  shouldCaptureRawResponse,
} from "../config";
import { logAiTracingWarning } from "../log";
import { formatRawTraceReference } from "../trace-ref";
import { writeLocalRawTrace } from "./file-raw-writer";
import { writeObjectStorageRawTrace } from "./object-storage-raw-writer";

export type RawTraceWriteResult = {
  rawRequestObjectKey?: string;
  rawResponseObjectKey?: string;
};

export type RawTraceWriterDependencies = {
  config: AiTracingConfig;
  storage?: UploadCapableStorageProvider;
  writeLocal?: typeof writeLocalRawTrace;
  writeObject?: typeof writeObjectStorageRawTrace;
};

let cachedStorage: UploadCapableStorageProvider | undefined;
let warnedMissingObjectStorage = false;

function resolveStorage(
  deps: RawTraceWriterDependencies,
): UploadCapableStorageProvider | undefined {
  if (deps.storage) {
    return deps.storage;
  }
  if (cachedStorage) {
    return cachedStorage;
  }
  const provider = getStorageProvider();
  if (isUploadCapableStorageProvider(provider)) {
    cachedStorage = provider;
    return cachedStorage;
  }
  return undefined;
}

export function resetRawTraceWriterForTests(): void {
  cachedStorage = undefined;
  warnedMissingObjectStorage = false;
  resetStorageProviderForTests();
}

function warnMissingObjectStorageOnce(): void {
  if (warnedMissingObjectStorage) {
    return;
  }
  warnedMissingObjectStorage = true;
  logAiTracingWarning("raw_object_storage_unavailable", {
    message:
      "AI tracing raw capture is configured for object storage, but no upload-capable storage provider is available.",
  });
}

async function writeRawArtifact(
  deps: RawTraceWriterDependencies,
  logId: string,
  kind: AiTraceArtifactKind,
  payload: unknown,
): Promise<string | undefined> {
  const { config } = deps;
  const writeLocal = deps.writeLocal ?? writeLocalRawTrace;
  const writeObject = deps.writeObject ?? writeObjectStorageRawTrace;

  if (config.rawStorageBackend === "file") {
    const relativePath = await writeLocal({
      rootDir: config.localRoot,
      logId,
      kind,
      payload,
      redactPii: config.redactPii,
    });
    return formatRawTraceReference("file", relativePath);
  }

  if (config.rawStorageBackend === "object") {
    const storage = resolveStorage(deps);
    if (!storage) {
      warnMissingObjectStorageOnce();
      return undefined;
    }
    const objectKey = await writeObject({
      storage,
      logId,
      kind,
      payload,
      redactPii: config.redactPii,
    });
    return formatRawTraceReference("object", objectKey);
  }

  return undefined;
}

export async function writeRawTraces(
  deps: RawTraceWriterDependencies,
  input: {
    logId: string;
    rawRequest?: unknown;
    rawResponse?: unknown;
  },
): Promise<RawTraceWriteResult> {
  const { config } = deps;
  const result: RawTraceWriteResult = {};

  if (
    input.rawRequest !== undefined &&
    shouldCaptureRawRequest(config)
  ) {
    result.rawRequestObjectKey = await writeRawArtifact(
      deps,
      input.logId,
      "request",
      input.rawRequest,
    );
  }

  if (
    input.rawResponse !== undefined &&
    shouldCaptureRawResponse(config)
  ) {
    result.rawResponseObjectKey = await writeRawArtifact(
      deps,
      input.logId,
      "response",
      input.rawResponse,
    );
  }

  return result;
}
