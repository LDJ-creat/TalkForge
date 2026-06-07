import { buildTtsStandardAudioObjectKey } from "@/server/storage/object-keys";

import type { TtsCacheKeyInput } from "./types";

export const DEFAULT_TTS_VOICE = "longxiaochun_v3";
export const DEFAULT_TTS_SPEED = 1;
export const DEFAULT_TTS_LANGUAGE = "en" as const;

export function buildTtsCacheKey(input: TtsCacheKeyInput): string {
  return [
    input.text,
    input.voice ?? DEFAULT_TTS_VOICE,
    String(input.speed ?? DEFAULT_TTS_SPEED),
    input.provider,
    input.language ?? DEFAULT_TTS_LANGUAGE,
  ].join("|");
}

export function hashTtsCacheKey(cacheKey: string): string {
  let hash = 0;
  for (let index = 0; index < cacheKey.length; index += 1) {
    hash = (hash << 5) - hash + cacheKey.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function buildTtsObjectKeyFromCacheKey(cacheKey: string): string {
  return buildTtsStandardAudioObjectKey(hashTtsCacheKey(cacheKey));
}
