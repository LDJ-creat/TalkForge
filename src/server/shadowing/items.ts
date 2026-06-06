import type { ShadowingItem } from "@/domain/shadowing";
import type { TtsProvider } from "@/providers/tts/contract";

import {
  resolveStandardAudio,
  type ResolveStandardAudioDeps,
} from "./standard-audio";

export async function attachStandardAudioToShadowingItem(
  item: ShadowingItem,
  deps: ResolveStandardAudioDeps,
): Promise<ShadowingItem> {
  const standardAudio = await resolveStandardAudio(
    { text: item.standardText },
    deps,
  );

  return {
    ...item,
    standardAudio,
  };
}

export async function attachStandardAudioToShadowingItems(
  items: ShadowingItem[],
  deps: { ttsProvider: TtsProvider; defaultVoice?: string },
): Promise<ShadowingItem[]> {
  return Promise.all(
    items.map((item) => attachStandardAudioToShadowingItem(item, deps)),
  );
}
