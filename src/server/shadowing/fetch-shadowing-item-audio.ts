import type { ShadowingItem } from "@/domain/shadowing";
import type { Session } from "@/domain/session";
import { loadAudioObjectForAsr } from "@/server/asr/audio-loader";

import { ShadowingServiceError } from "./errors";

const AUDIO_FORMAT_CONTENT_TYPE: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  webm: "audio/webm",
};

export type FetchShadowingItemAudioDeps = {
  getSessionById: (sessionId: string) => Promise<Session | null>;
  getShadowingItemById: (itemId: string) => Promise<ShadowingItem | null>;
};

export async function fetchShadowingItemAudioForUser(
  sessionId: string,
  itemId: string,
  userId: string,
  deps: FetchShadowingItemAudioDeps,
): Promise<Response> {
  const session = await deps.getSessionById(sessionId);
  if (!session) {
    throw new ShadowingServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== userId) {
    throw new ShadowingServiceError(
      403,
      "forbidden",
      "You do not have access to this session.",
    );
  }

  const item = await deps.getShadowingItemById(itemId);
  if (!item || item.sessionId !== sessionId) {
    throw new ShadowingServiceError(
      404,
      "shadowing_item_not_found",
      "Shadowing item was not found.",
    );
  }

  if (item.standardAudioStatus !== "ready" || !item.standardAudio?.objectKey) {
    throw new ShadowingServiceError(
      404,
      "standard_audio_unavailable",
      "Standard audio is not ready for this shadowing item.",
    );
  }

  const loaded = await loadAudioObjectForAsr(item.standardAudio.objectKey);
  const contentType =
    loaded.contentType ??
    AUDIO_FORMAT_CONTENT_TYPE[item.standardAudio.format] ??
    "application/octet-stream";

  return new Response(new Uint8Array(loaded.body), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(loaded.body.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
