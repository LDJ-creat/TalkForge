import { AudioUploadServiceError } from "./errors";

export const TURN_AUDIO_OBJECT_KEY_PATTERN =
  /^audio\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webm$/i;

export function buildTurnAudioObjectKey(sessionId: string, turnId: string): string {
  return `audio/${sessionId}/${turnId}.webm`;
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

export function assertValidTurnAudioObjectKey(objectKey: string): void {
  if (!TURN_AUDIO_OBJECT_KEY_PATTERN.test(objectKey)) {
    throw new AudioUploadServiceError(
      400,
      "invalid_object_key",
      "Turn audio object keys must match audio/{sessionId}/{turnId}.webm.",
    );
  }
}
