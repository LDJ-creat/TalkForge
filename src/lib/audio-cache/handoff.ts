import { REQUEST_USER_ID_HEADER } from "@/shared/request-user";

import type { TurnAudioCacheAdapter } from "./types";

export type UploadTurnAudioHandoffInput = {
  userId: string;
  turnId: string;
  sessionId: string;
  durationMs: number;
  fetchImpl?: typeof fetch;
  appBaseUrl?: string;
};

export type UploadTurnAudioHandoffResult = {
  turnId: string;
  objectKey: string;
};

export type RetryPendingTurnAudioUploadsInput = {
  userId: string;
  adapter: TurnAudioCacheAdapter;
  fetchImpl?: typeof fetch;
  appBaseUrl?: string;
};

function getBaseUrl(appBaseUrl?: string): string {
  return appBaseUrl ?? process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";
}

async function createUploadTarget(
  input: UploadTurnAudioHandoffInput,
  sizeBytes: number,
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl(
    `${getBaseUrl(input.appBaseUrl)}/api/sessions/${input.sessionId}/turns/${input.turnId}/audio/upload-target`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [REQUEST_USER_ID_HEADER]: input.userId,
      },
      body: JSON.stringify({ sizeBytes }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to create upload target (${response.status}).`);
  }

  return response.json() as Promise<{
    objectKey: string;
    uploadTarget: { uploadUrl: string; method: string; headers?: Record<string, string> };
  }>;
}

async function finalizeUpload(
  input: UploadTurnAudioHandoffInput,
  objectKey: string,
  sizeBytes: number,
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl(
    `${getBaseUrl(input.appBaseUrl)}/api/sessions/${input.sessionId}/turns/${input.turnId}/audio/finalize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [REQUEST_USER_ID_HEADER]: input.userId,
      },
      body: JSON.stringify({
        objectKey,
        durationMs: input.durationMs,
        sizeBytes,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to finalize audio upload (${response.status}).`);
  }
}

export async function uploadTurnAudioFromCacheEntry(
  adapter: TurnAudioCacheAdapter,
  input: UploadTurnAudioHandoffInput,
): Promise<UploadTurnAudioHandoffResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const entry = await adapter.get(input.turnId);
  if (!entry) {
    throw new Error(`Turn audio cache entry ${input.turnId} was not found.`);
  }

  const sizeBytes = entry.blob.size;
  const durationMs = input.durationMs > 0 ? input.durationMs : entry.durationMs;
  if (durationMs <= 0) {
    throw new Error(`Turn audio cache entry ${input.turnId} is missing a valid durationMs.`);
  }

  const handoffInput = { ...input, durationMs, fetchImpl };
  const target = await createUploadTarget(handoffInput, sizeBytes, fetchImpl);
  const uploadResponse = await fetchImpl(target.uploadTarget.uploadUrl, {
    method: target.uploadTarget.method,
    headers: target.uploadTarget.headers,
    body: entry.blob,
  });

  if (!uploadResponse.ok) {
    await adapter.markFailed(input.turnId, `Upload failed with status ${uploadResponse.status}.`);
    throw new Error(`Audio upload failed (${uploadResponse.status}).`);
  }

  await finalizeUpload(handoffInput, target.objectKey, sizeBytes, fetchImpl);
  await adapter.markUploaded(input.turnId, target.objectKey);

  return {
    turnId: input.turnId,
    objectKey: target.objectKey,
  };
}

export async function retryPendingTurnAudioUploads(
  input: RetryPendingTurnAudioUploadsInput,
): Promise<UploadTurnAudioHandoffResult[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const pendingEntries = await input.adapter.listPending();
  const results: UploadTurnAudioHandoffResult[] = [];

  for (const entry of pendingEntries) {
    try {
      const result = await uploadTurnAudioFromCacheEntry(input.adapter, {
        userId: input.userId,
        turnId: entry.turnId,
        sessionId: entry.sessionId,
        durationMs: entry.durationMs,
        fetchImpl,
        appBaseUrl: input.appBaseUrl,
      });
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown upload failure.";
      await input.adapter.markFailed(entry.turnId, message);
    }
  }

  return results;
}
