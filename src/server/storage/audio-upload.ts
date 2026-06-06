import type { StorageProvider } from "@/providers/storage/contract";
import type { UploadTarget } from "@/providers/storage/types";
import type { CreateAudioSegmentInput } from "@/domain/audio-segment";

import type { TalkForgeDatabase } from "@/server/db/client";
import {
  createAudioSegment,
  deleteAudioSegment,
  getAudioSegmentById,
  getAudioSegmentByTurnId,
} from "@/server/db/repositories/audio-segment-repository";
import { getSessionById } from "@/server/db/repositories/scenario-session-repository";
import {
  clearTurnAudioSegment,
  getTurnById,
  linkTurnAudioSegment,
} from "@/server/db/repositories/turn-repository";

import { AudioUploadServiceError } from "./errors";
import { buildTurnAudioObjectKey, parseTurnAudioObjectKey } from "./object-keys";
import { isUploadCapableStorageProvider } from "./upload-capable";

const DEFAULT_AUDIO_CONTENT_TYPE = "audio/webm";

export type TurnAudioAccessInput = {
  sessionId: string;
  turnId: string;
  userId: string;
};

export type CreateTurnAudioUploadTargetInput = TurnAudioAccessInput & {
  sizeBytes?: number;
  contentType?: string;
};

export type FinalizeTurnAudioUploadInput = TurnAudioAccessInput & {
  objectKey: string;
  durationMs: number;
  sizeBytes: number;
  format?: CreateAudioSegmentInput["format"];
  codec?: CreateAudioSegmentInput["codec"];
  sampleRate?: number;
};

export type TurnAudioUploadTargetResult = {
  turnId: string;
  objectKey: string;
  uploadTarget: UploadTarget;
};

export async function assertSessionTurnAccess(
  db: TalkForgeDatabase,
  input: TurnAudioAccessInput,
) {
  const session = await getSessionById(db, input.sessionId);
  if (!session) {
    throw new AudioUploadServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== input.userId) {
    throw new AudioUploadServiceError(403, "forbidden", "Session does not belong to this user.");
  }

  const turn = await getTurnById(db, input.turnId);
  if (!turn || turn.sessionId !== input.sessionId) {
    throw new AudioUploadServiceError(404, "turn_not_found", "Turn was not found.");
  }

  return { session, turn };
}

export async function assertUploadedObjectMatchesMetadata(
  storageProvider: StorageProvider,
  input: { objectKey: string; sizeBytes: number },
) {
  const exists = await storageProvider.objectExists?.({ objectKey: input.objectKey });
  if (!exists) {
    throw new AudioUploadServiceError(
      400,
      "uploaded_object_missing",
      "Uploaded audio object was not found in storage.",
    );
  }

  if (isUploadCapableStorageProvider(storageProvider) && storageProvider.getUploadedObjectSize) {
    const uploadedSize = await storageProvider.getUploadedObjectSize(input.objectKey);
    if (uploadedSize !== input.sizeBytes) {
      throw new AudioUploadServiceError(
        400,
        "uploaded_object_size_mismatch",
        "Uploaded audio size does not match the finalize request.",
      );
    }
  }
}

export async function createTurnAudioUploadTarget(
  db: TalkForgeDatabase,
  storageProvider: StorageProvider,
  input: CreateTurnAudioUploadTargetInput,
): Promise<TurnAudioUploadTargetResult> {
  await assertSessionTurnAccess(db, input);
  const objectKey = buildTurnAudioObjectKey(input.sessionId, input.turnId);
  const uploadTarget = await storageProvider.createUploadTarget({
    objectKey,
    contentType: input.contentType ?? DEFAULT_AUDIO_CONTENT_TYPE,
    sizeBytes: input.sizeBytes,
    visibility: "private",
  });

  return {
    turnId: input.turnId,
    objectKey,
    uploadTarget,
  };
}

export async function finalizeTurnAudioUpload(
  db: TalkForgeDatabase,
  storageProvider: StorageProvider,
  input: FinalizeTurnAudioUploadInput,
) {
  await assertSessionTurnAccess(db, input);

  const parsedObjectKey = parseTurnAudioObjectKey(input.objectKey);
  if (
    parsedObjectKey.sessionId !== input.sessionId ||
    parsedObjectKey.turnId !== input.turnId
  ) {
    throw new AudioUploadServiceError(
      400,
      "invalid_object_key",
      "Object key does not match the requested session and turn.",
    );
  }

  if (input.durationMs <= 0 || input.sizeBytes <= 0) {
    throw new AudioUploadServiceError(
      400,
      "invalid_audio_metadata",
      "Audio duration and size must be greater than zero.",
    );
  }

  await assertUploadedObjectMatchesMetadata(storageProvider, {
    objectKey: input.objectKey,
    sizeBytes: input.sizeBytes,
  });

  return db.transaction(async (tx) => {
    const existing = await getAudioSegmentByTurnId(tx, input.turnId);
    if (existing) {
      return {
        turnId: input.turnId,
        audioSegment: existing,
      };
    }

    const audioSegment = await createAudioSegment(tx, {
      turnId: input.turnId,
      objectKey: input.objectKey,
      format: input.format ?? "webm",
      codec: input.codec ?? "opus",
      sampleRate: input.sampleRate,
      durationMs: input.durationMs,
      sizeBytes: input.sizeBytes,
    });

    await linkTurnAudioSegment(tx, input.turnId, audioSegment.id);

    return {
      turnId: input.turnId,
      audioSegment,
    };
  });
}

export async function deleteTurnAudio(
  db: TalkForgeDatabase,
  storageProvider: StorageProvider,
  input: TurnAudioAccessInput,
) {
  const { turn } = await assertSessionTurnAccess(db, input);
  if (!turn.audioSegmentId) {
    return { deleted: false };
  }

  const audioSegment = await getAudioSegmentById(db, turn.audioSegmentId);
  if (!audioSegment) {
    await clearTurnAudioSegment(db, input.turnId);
    return { deleted: false };
  }

  if (await storageProvider.objectExists?.({ objectKey: audioSegment.objectKey })) {
    await storageProvider.deleteObject({ objectKey: audioSegment.objectKey });
  }

  await db.transaction(async (tx) => {
    await deleteAudioSegment(tx, audioSegment.id);
    await clearTurnAudioSegment(tx, input.turnId);
  });

  return { deleted: true, objectKey: audioSegment.objectKey };
}
