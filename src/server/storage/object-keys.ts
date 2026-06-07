import { AI_TRACE_OBJECT_KEY_PATTERN } from "@/server/ai-tracing/object-keys";

import { AudioUploadServiceError } from "./errors";

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export { AI_TRACE_OBJECT_KEY_PATTERN };

export const TURN_AUDIO_OBJECT_KEY_PATTERN = new RegExp(
  `^audio/${UUID_PATTERN}/${UUID_PATTERN}\\.webm$`,
  "i",
);

export const TTS_STANDARD_AUDIO_OBJECT_KEY_PATTERN = /^tts\/[a-z0-9]+\.wav$/i;

export const CONVERTED_AUDIO_ARTIFACT_OBJECT_KEY_PATTERN = new RegExp(
  `^artifacts/${UUID_PATTERN}/${UUID_PATTERN}/[a-z0-9_-]+\\.wav$`,
  "i",
);

export const STORAGE_OBJECT_KEY_PATTERNS = [
  TURN_AUDIO_OBJECT_KEY_PATTERN,
  TTS_STANDARD_AUDIO_OBJECT_KEY_PATTERN,
  CONVERTED_AUDIO_ARTIFACT_OBJECT_KEY_PATTERN,
  AI_TRACE_OBJECT_KEY_PATTERN,
] as const;

export function buildTurnAudioObjectKey(sessionId: string, turnId: string): string {
  return `audio/${sessionId}/${turnId}.webm`;
}

export function buildTtsStandardAudioObjectKey(contentHash: string): string {
  const normalizedHash = contentHash.trim().toLowerCase();
  if (!/^[a-z0-9]+$/.test(normalizedHash)) {
    throw new AudioUploadServiceError(
      400,
      "invalid_object_key",
      "TTS standard audio object key hashes must be lowercase alphanumeric strings.",
    );
  }
  return `tts/${normalizedHash}.wav`;
}

export function buildConvertedAudioArtifactObjectKey(
  sessionId: string,
  turnId: string,
  artifactId: string,
): string {
  const normalizedArtifactId = artifactId.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(normalizedArtifactId)) {
    throw new AudioUploadServiceError(
      400,
      "invalid_object_key",
      "Converted audio artifact ids must use lowercase letters, numbers, underscores, or hyphens.",
    );
  }
  return `artifacts/${sessionId}/${turnId}/${normalizedArtifactId}.wav`;
}

export function parseTurnAudioObjectKey(objectKey: string): {
  sessionId: string;
  turnId: string;
} {
  assertValidTurnAudioObjectKey(objectKey);
  const match = objectKey.match(
    /^audio\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.webm$/i,
  );
  if (!match) {
    throw new AudioUploadServiceError(400, "invalid_object_key", "Object key format is invalid.");
  }
  return { sessionId: match[1], turnId: match[2] };
}

export function assertValidStorageObjectKey(objectKey: string): void {
  if (STORAGE_OBJECT_KEY_PATTERNS.some((pattern) => pattern.test(objectKey))) {
    return;
  }

  throw new AudioUploadServiceError(
    400,
    "invalid_object_key",
    "Object keys must match TalkForge storage conventions for turn audio, TTS standard audio, converted artifacts, or AI trace payloads.",
  );
}

export function assertValidTurnAudioObjectKey(objectKey: string): void {
  if (!TURN_AUDIO_OBJECT_KEY_PATTERN.test(objectKey)) {
    throw new AudioUploadServiceError(
      400,
      "invalid_object_key",
      "Turn audio object keys must match audio/{sessionId}/{turnId}.webm.",
    );
  }
}
