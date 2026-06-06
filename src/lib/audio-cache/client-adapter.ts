import { createIndexedDbTurnAudioCacheAdapter } from "./indexed-db";
import { createMemoryTurnAudioCacheAdapter } from "./memory-adapter";
import type { TurnAudioCacheAdapter } from "./types";

let clientAdapter: TurnAudioCacheAdapter | undefined;

export function getClientTurnAudioCacheAdapter(): TurnAudioCacheAdapter {
  if (clientAdapter) {
    return clientAdapter;
  }

  if (typeof indexedDB !== "undefined") {
    clientAdapter = createIndexedDbTurnAudioCacheAdapter();
  } else {
    clientAdapter = createMemoryTurnAudioCacheAdapter();
  }

  return clientAdapter;
}

export function resetClientTurnAudioCacheAdapterForTests(): void {
  clientAdapter = undefined;
}
