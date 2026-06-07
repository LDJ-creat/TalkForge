import type { LoadedPronunciationAudioObject } from "@/providers/iflytek-ise";

import { loadAudioObjectForAsr } from "@/server/asr/audio-loader";

export async function loadAudioObjectForPronunciation(
  objectKey: string,
): Promise<LoadedPronunciationAudioObject> {
  const audio = await loadAudioObjectForAsr(objectKey);
  return {
    objectKey: audio.objectKey,
    body: audio.body,
    contentType: audio.contentType,
  };
}
