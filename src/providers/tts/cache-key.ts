import type { TtsCacheKeyInput } from "./types";

export const DEFAULT_TTS_VOICE = "en-us-neutral";
export const DEFAULT_TTS_SPEED = 1;
export const DEFAULT_TTS_LANGUAGE = "en" as const;

export function buildTtsCacheKey(input: TtsCacheKeyInput): string {
  return [
    input.text,
    input.voice ?? DEFAULT_TTS_VOICE,
    String(input.speed ?? DEFAULT_TTS_SPEED),
    input.language ?? DEFAULT_TTS_LANGUAGE,
  ].join("|");
}
